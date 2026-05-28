/**
 * Generates the viewer content file (data/content.json) from an existing analysis.
 *
 * Usage:
 *   tsx scripts/gen-content.ts --sarif <file> --src <dir> --rules <dir> [--name <id>] [--root <dir>] [--out <file>]
 *
 * You produce the SARIF yourself by running the analyzer. Inputs:
 *   --sarif  SARIF report
 *   --src    source dir (files are pruned to those a finding references)
 *   --rules  ruleset dir (the full ruleset is included)
 *   --name   projectId (default: basename of --src)
 *   --root   base the SARIF artifact URIs are relative to (default: dirname(--src))
 *   --out    output file (default: data/content.json)
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, extname, basename, dirname, resolve } from 'node:path';
import { transformSarif, toolInfo } from '../src/pipeline/sarif';
import { isViewerContent } from '../src/types/content';
import type { Finding, Language, ProjectFile, RuleSpec } from '../src/types/content';

const LANG_BY_EXT: Record<string, Language> = {
  '.java': 'java', '.kt': 'kotlin', '.yml': 'yaml', '.yaml': 'yaml', '.xml': 'xml', '.properties': 'properties',
};

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { args[argv[i].slice(2)] = argv[i + 1]; i++; }
  }
  return args;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'build' || name === '.gradle') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function collectFiles(srcDir: string, root: string, referenced: Set<string>): ProjectFile[] {
  return walk(srcDir)
    .filter((p) => LANG_BY_EXT[extname(p)])
    .map((p) => ({ path: relative(root, p), language: LANG_BY_EXT[extname(p)] ?? 'plaintext', content: readFileSync(p, 'utf8') }))
    .filter((f) => referenced.has(f.path));
}

function readRules(rulesDir: string): RuleSpec[] {
  return walk(rulesDir)
    .filter((p) => extname(p) === '.yaml' || extname(p) === '.yml')
    .map((p) => relative(rulesDir, p))
    .sort()
    .map((path) => ({ id: path, origin: 'builtin' as const, path, content: readFileSync(join(rulesDir, path), 'utf8') }));
}

function buildRuleIndex(rules: RuleSpec[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const rule of rules) for (const m of rule.content.matchAll(/\bid:\s*([A-Za-z0-9._-]+)/g)) if (!index.has(m[1])) index.set(m[1], rule.path);
  return index;
}

function ruleFileFor(ruleId: string, index: Map<string, string>): string | null {
  const bare = ruleId.replace(/^java\.[a-z]+\./, '');
  return index.get(bare) ?? index.get(ruleId) ?? null;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const sarifPath = args.sarif, srcArg = args.src, rulesArg = args.rules;
  if (!sarifPath || !srcArg || !rulesArg) {
    console.error('Usage: tsx scripts/gen-content.ts --sarif <file> --src <dir> --rules <dir> [--name <id>] [--root <dir>] [--out <file>]');
    process.exit(1);
  }
  for (const [flag, p] of [['--sarif', sarifPath], ['--src', srcArg], ['--rules', rulesArg]] as const) {
    if (!existsSync(p)) { console.error(`${flag} path not found: ${p}`); process.exit(1); }
  }
  const srcDir = resolve(srcArg);
  const root = resolve(args.root ?? dirname(srcDir));
  const out = args.out ?? 'data/content.json';
  const projectId = args.name ?? basename(srcDir);

  const sarif = JSON.parse(readFileSync(sarifPath, 'utf8'));
  const rules = readRules(resolve(rulesArg));
  const index = buildRuleIndex(rules);
  const findings: Finding[] = transformSarif(sarif).map((f) => ({ ...f, ruleFile: ruleFileFor(f.ruleId, index) }));
  const referenced = new Set(findings.flatMap((f) => f.flows.flatMap((fl) => fl.steps.map((s) => s.file))));
  const files = collectFiles(srcDir, root, referenced);
  const tool = toolInfo(sarif);

  const content = { projectId, tool, files, rules, findings };
  if (!isViewerContent(content)) throw new Error('Generated content failed contract validation');
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, JSON.stringify(content, null, 2));
  console.log(`Wrote ${out}: ${findings.length} findings, ${files.length} files, ${rules.length} rules`);
}

try {
  main();
} catch (error) {
  console.error('gen-content failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
