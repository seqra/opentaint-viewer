import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { transformSarif, toolInfo } from '../pipeline/sarif';
import { isViewerContent } from '../types/content';
import type { Finding, Language, ProjectFile, RuleOrigin, RuleSpec, ViewerContent } from '../types/content';

const LANG_BY_EXT: Record<string, Language> = {
  '.java': 'java', '.kt': 'kotlin', '.yml': 'yaml', '.yaml': 'yaml', '.xml': 'xml', '.properties': 'properties',
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    // skip VCS and build-artefact directories
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

function readRules(rulesDir: string, origin: RuleOrigin): RuleSpec[] {
  return walk(rulesDir)
    .filter((p) => extname(p) === '.yaml' || extname(p) === '.yml')
    .map((p) => relative(rulesDir, p))
    .sort()
    .map((path) => ({ id: path, origin, path, content: readFileSync(join(rulesDir, path), 'utf8') }));
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

export interface GenerateOptions {
  sarifLog: unknown;
  /** Directory walked for source files. */
  srcDir: string;
  /** Base that collected file paths (and SARIF URIs) are relative to. */
  root: string;
  /** Builtin ruleset directory; every .yaml/.yml under it is included (origin 'builtin'). */
  rulesDir: string;
  /** Optional custom ruleset directory (origin 'custom'); custom wins on id/path collision. */
  customRulesDir?: string;
  /** Project name surfaced in the viewer UI. */
  projectId: string;
}

export function generateContent(opts: GenerateOptions): ViewerContent {
  if (typeof opts.sarifLog !== 'object' || opts.sarifLog === null) {
    throw new Error('SARIF log must be a JSON object');
  }
  const sarif = opts.sarifLog as Parameters<typeof transformSarif>[0];
  const builtin = readRules(opts.rulesDir, 'builtin');
  const custom = opts.customRulesDir ? readRules(opts.customRulesDir, 'custom') : [];
  // On an identical relative path, the custom rule replaces the builtin one. RuleSpec.id is the
  // path (not the YAML `id:`), so dropping the path-collision keeps every RuleSpec.id unique.
  const customPaths = new Set(custom.map((r) => r.path));
  const builtinKept = builtin.filter((r) => !customPaths.has(r.path));
  // Display order: builtin group first, then custom.
  const rules = [...builtinKept, ...custom];
  // Resolution order: custom first, so a custom `id:` wins on collision (index is first-write-wins).
  const index = buildRuleIndex([...custom, ...builtinKept]);
  const findings: Finding[] = transformSarif(sarif).map((f) => ({ ...f, ruleFile: ruleFileFor(f.ruleId, index) }));
  const referenced = new Set(findings.flatMap((f) => f.flows.flatMap((fl) => fl.steps.map((s) => s.file))));
  const files = collectFiles(opts.srcDir, opts.root, referenced);
  const tool = toolInfo(sarif);
  const content: ViewerContent = { projectId: opts.projectId, tool, files, rules, findings };
  if (!isViewerContent(content)) throw new Error('Generated content failed contract validation');
  return content;
}
