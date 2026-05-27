/**
 * Regenerates src/content/java-spring-demo.json from a real opentaint run.
 *
 * Prerequisites:
 *   - Docker running
 *   - The demo checked out at ./java-spring-demo  (git clone https://github.com/seqra/java-spring-demo)
 *
 * Run: npm run regen
 *
 * What it does (each step is skipped if its artifact already exists, so re-runs are cheap):
 *   1. If java-spring-demo/results.sarif is missing → docker run opentaint scan.
 *   2. If .opentaint-rules is empty → copy the builtin ruleset out of the engine image.
 *   3. transformSarif(results.sarif) → findings; link each finding to the rule file that defines it.
 *   4. Read project sources + the builtin rule files.
 *   5. Curate one scenario per vulnerability class.
 *   6. Write + contract-validate src/content/java-spring-demo.json.
 *
 * The engine is pinned by digest so regenerated content is reproducible against the exact
 * version that produced the committed results (see [[live-backend-deferred]] / premortem drift risk).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { transformSarif } from '../src/pipeline/sarif';
import { isViewerContent } from '../src/types/content';
import type { Finding, Language, ProjectFile, RuleSpec, Scenario } from '../src/types/content';

const IMAGE =
  'ghcr.io/seqra/opentaint@sha256:cd545080aca60f5583523277589f5e086fd630e6555eb5e718384afc7469cf7d';
const DEMO_DIR = 'java-spring-demo';
const CACHE_DIR = '.opentaint-cache';
const RULES_DIR = '.opentaint-rules';
const SARIF = join(DEMO_DIR, 'results.sarif');
const OUT = 'src/content/java-spring-demo.json';

const LANG_BY_EXT: Record<string, Language> = {
  '.java': 'java',
  '.kt': 'kotlin',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.xml': 'xml',
  '.properties': 'properties',
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

function readRules(): RuleSpec[] {
  return walk(RULES_DIR)
    .filter((p) => extname(p) === '.yaml' || extname(p) === '.yml')
    .map((p) => relative(RULES_DIR, p))
    .sort()
    .map((path) => ({
      id: path,
      origin: 'builtin' as const,
      path,
      content: readFileSync(join(RULES_DIR, path), 'utf8'),
    }));
}

/** Map every rule id declared in the ruleset to the file that declares it. */
function buildRuleIndex(rules: RuleSpec[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const rule of rules) {
    for (const m of rule.content.matchAll(/\bid:\s*([A-Za-z0-9._-]+)/g)) {
      if (!index.has(m[1])) index.set(m[1], rule.path);
    }
  }
  return index;
}

function ruleFileFor(ruleId: string, index: Map<string, string>): string | null {
  const bare = ruleId.replace(/^java\.[a-z]+\./, '');
  return index.get(bare) ?? index.get(ruleId) ?? null;
}

const VULN_BLURB: Record<string, string> = {
  'Template Injection':
    'Untrusted request data flows across services into a template engine — server-side template injection.',
  SSRF: 'A user-controlled URL reaches an outbound network call (Kotlin) with no destination allow-list.',
  XSS: 'Untrusted input is written into an HTML response without encoding, often via helper classes.',
};
const VULN_ORDER = ['Template Injection', 'SSRF', 'XSS'];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildScenarios(findings: Finding[]): Scenario[] {
  const first = new Map<string, Finding>();
  for (const f of findings) if (!first.has(f.vulnClass)) first.set(f.vulnClass, f);
  const classes = [
    ...VULN_ORDER.filter((v) => first.has(v)),
    ...[...first.keys()].filter((v) => !VULN_ORDER.includes(v)),
  ];
  return classes.map((vulnClass) => {
    const f = first.get(vulnClass)!;
    return {
      id: slug(vulnClass),
      title: vulnClass,
      blurb: VULN_BLURB[vulnClass] ?? `${vulnClass} found by opentaint in this project.`,
      startFile: f.flows[f.defaultFlowIndex].steps[0]?.file ?? '',
      defaultFindingId: f.id,
    };
  });
}

function dockerScan(): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  execFileSync(
    'docker',
    ['run', '--rm', '-v', `${process.cwd()}/${CACHE_DIR}:/root/.opentaint`, '-v', `${process.cwd()}/${DEMO_DIR}:/project`, IMAGE, 'opentaint', '--quiet', 'scan', '--output', '/project/results.sarif', '/project'],
    { stdio: 'inherit' },
  );
}

function dockerExtractRules(): void {
  mkdirSync(RULES_DIR, { recursive: true });
  execFileSync(
    'docker',
    ['run', '--rm', '-v', `${process.cwd()}/${RULES_DIR}:/out`, '--entrypoint', 'sh', IMAGE, '-c', 'cp -r /usr/local/lib/opentaint/lib/rules/. /out/'],
    { stdio: 'inherit' },
  );
}

function main(): void {
  if (!existsSync(SARIF)) dockerScan();
  if (!existsSync(RULES_DIR) || readdirSync(RULES_DIR).length === 0) dockerExtractRules();

  const sarif = JSON.parse(readFileSync(SARIF, 'utf8'));
  const rules = readRules();
  const index = buildRuleIndex(rules);
  const findings = transformSarif(sarif).map((f) => ({ ...f, ruleFile: ruleFileFor(f.ruleId, index) }));
  const files = collectFiles();
  const scenarios = buildScenarios(findings);

  const filePaths = new Set(files.map((f) => f.path));
  for (const s of scenarios) {
    if (!filePaths.has(s.startFile)) {
      throw new Error(`Scenario "${s.id}" startFile not found in project: ${s.startFile}`);
    }
  }

  const content = { projectId: 'java-spring-demo', scenarios, files, findings, rules };
  if (!isViewerContent(content)) throw new Error('Generated content failed contract validation');
  writeFileSync(OUT, JSON.stringify(content, null, 2));
  console.log(
    `Wrote ${OUT}: ${findings.length} findings, ${files.length} files, ${rules.length} rules, ${scenarios.length} scenarios`,
  );
}

try {
  main();
} catch (error) {
  console.error('regen-content failed:', error instanceof Error ? error.message : error);
  console.error('Check that Docker is running and ./java-spring-demo is checked out.');
  process.exit(1);
}
