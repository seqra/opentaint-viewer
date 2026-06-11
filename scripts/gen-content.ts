/**
 * Generates the viewer content file (data/content.json) from an existing analysis.
 *
 * Usage:
 *   tsx scripts/gen-content.ts --sarif <file> --src <dir> --rules <dir> [--name <id>] [--root <dir>] [--out <file>]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { generateContent } from '../src/cli/generateContent';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { args[argv[i].slice(2)] = argv[i + 1]; i++; }
  }
  return args;
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

  const sarifLog = JSON.parse(readFileSync(sarifPath, 'utf8'));
  const content = generateContent({ sarifLog, srcDir, root, rulesDir: resolve(rulesArg), projectId });

  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, JSON.stringify(content, null, 2));
  console.log(`Wrote ${out}: ${content.findings.length} findings, ${content.files.length} files, ${content.rules.length} rules`);
}

try {
  main();
} catch (error) {
  console.error('gen-content failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
