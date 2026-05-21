/**
 * Regenerates src/content/java-spring-demo.json from a live opentaint run.
 *
 * Prerequisites:
 *   - Docker available
 *   - The demo checked out at ./java-spring-demo
 *       git clone https://github.com/seqra/java-spring-demo
 *
 * Run: npm run regen
 *
 * Steps performed:
 *   1. docker run opentaint scan -> results.sarif
 *   2. transformSarif(results.sarif) -> findings
 *   3. read project source files + builtin rules
 *   4. write src/content/java-spring-demo.json (validated against the contract)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { transformSarif } from '../src/pipeline/sarif';
import { isPlaygroundContent } from '../src/types/content';
import type { Language, ProjectFile, RuleSpec, Scenario } from '../src/types/content';

const DEMO_DIR = 'java-spring-demo';
const OUT = 'src/content/java-spring-demo.json';

const LANG_BY_EXT: Record<string, Language> = {
  '.java': 'java', '.kt': 'kotlin', '.yml': 'yaml', '.yaml': 'yaml',
  '.xml': 'xml', '.properties': 'properties',
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'build' || name === '.gradle') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function collectFiles(): ProjectFile[] {
  return walk(join(DEMO_DIR, 'src'))
    .filter((p) => LANG_BY_EXT[extname(p)])
    .map((p) => ({
      path: relative(DEMO_DIR, p),
      language: LANG_BY_EXT[extname(p)] ?? 'plaintext',
      content: readFileSync(p, 'utf8'),
    }));
}

// Scenarios are curated by hand. Before committing regenerated output, FINALIZE each entry:
//   - startFile must be a real path present in the scanned project (the value below is a
//     placeholder; replace the `.../` segment with the actual package path).
//   - defaultFindingId is currently set to the first finding for every scenario (see main);
//     when more than one scenario exists, point each at its own finding id.
//   - rules() returns [] for now; populate it (or read a committed seed) so regenerated
//     output keeps the rules the SPA expects.
const SCENARIOS: Omit<Scenario, 'defaultFindingId'>[] = [
  { id: 'sqli', title: 'SQL Injection', blurb: 'User input flows from an HTTP endpoint to a SQL sink across files.', startFile: 'src/main/java/.../UserController.java' },
];

function rules(): RuleSpec[] {
  // Builtin rules read from the engine's ruleset directory inside the demo run image / repo.
  // For regen we read them from ./rules if present; otherwise leave empty and let a follow-up fill them.
  return [];
}

function main(): void {
  execFileSync('docker', [
    'run', '--rm',
    '-v', `${process.cwd()}/${DEMO_DIR}:/project`,
    'ghcr.io/seqra/opentaint:latest',
    'opentaint', 'scan', '--output', '/project/results.sarif', '/project',
  ], { stdio: 'inherit' });

  const sarif = JSON.parse(readFileSync(join(DEMO_DIR, 'results.sarif'), 'utf8'));
  const findings = transformSarif(sarif);
  const scenarios: Scenario[] = SCENARIOS.map((s) => ({
    ...s,
    defaultFindingId: findings[0]?.id ?? '',
  }));

  const content = {
    projectId: 'java-spring-demo',
    scenarios,
    files: collectFiles(),
    findings,
    rules: rules(),
  };

  if (!isPlaygroundContent(content)) throw new Error('Generated content failed contract validation');
  writeFileSync(OUT, JSON.stringify(content, null, 2));
  console.log(`Wrote ${OUT}: ${findings.length} findings, ${content.files.length} files`);
}

try {
  main();
} catch (error) {
  console.error('regen-content failed:', error instanceof Error ? error.message : error);
  console.error('Check that Docker is running and ./java-spring-demo is checked out.');
  process.exit(1);
}
