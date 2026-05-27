import type { Finding, Flow, Severity, TaintStep } from '../types/content';
import { basename } from '../util/path';

/** Substring patterns → short vuln-class label, checked in order. */
const VULN_CLASS_PATTERNS: Array<[RegExp, string]> = [
  [/xss/, 'XSS'],
  [/ssti|template[-_]?injection/, 'Template Injection'],
  [/ssrf/, 'SSRF'],
  [/sqli|sql[-_]?injection/, 'SQL Injection'],
  [/os[-_]?command|command[-_]?injection/, 'Command Injection'],
  [/path[-_]?traversal/, 'Path Traversal'],
  [/open[-_]?redirect|unvalidated[-_]?redirect/, 'Open Redirect'],
  [/xxe/, 'XXE'],
  [/ldap/, 'LDAP Injection'],
  [/deserializ/, 'Unsafe Deserialization'],
  [/code[-_]?injection/, 'Code Injection'],
  [/log[-_]?injection/, 'Log Injection'],
];

function titleCase(s: string): string {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function vulnClassForRule(ruleId: string): string {
  const id = ruleId.toLowerCase();
  for (const [re, label] of VULN_CLASS_PATTERNS) if (re.test(id)) return label;
  const last = ruleId.split('.').pop() ?? ruleId;
  return titleCase(last);
}

function severityFromLevel(level: unknown): Severity {
  return level === 'warning' || level === 'note' ? level : 'error';
}

function kindForPosition(i: number, total: number): TaintStep['kind'] {
  if (i === 0) return 'source';
  if (i === total - 1) return 'sink';
  return 'propagation';
}

interface SarifPhysical {
  artifactLocation?: { uri?: string };
  region?: { startLine?: number; startColumn?: number; endLine?: number; endColumn?: number };
}
interface SarifTfl {
  location?: { physicalLocation?: SarifPhysical; message?: { text?: string } };
  kinds?: string[];
}
interface SarifResult {
  ruleId?: string;
  level?: string;
  message?: { text?: string };
  locations?: Array<{ physicalLocation?: SarifPhysical }>;
  codeFlows?: Array<{ threadFlows?: Array<{ locations?: SarifTfl[] }> }>;
}
interface SarifRule {
  id?: string;
  properties?: { tags?: string[] };
  fullDescription?: { text?: string };
}
interface SarifLog {
  runs?: Array<{ results?: SarifResult[]; tool?: { driver?: { rules?: SarifRule[] } } }>;
}

interface RuleMeta {
  cwe: string[];
  description?: string;
}

/** Map ruleId -> CWE tags + full markdown description from the report's rule descriptors. */
function ruleMetaByRule(log: SarifLog): Map<string, RuleMeta> {
  const map = new Map<string, RuleMeta>();
  for (const run of log.runs ?? []) {
    for (const rule of run.tool?.driver?.rules ?? []) {
      if (!rule.id) continue;
      map.set(rule.id, {
        cwe: (rule.properties?.tags ?? []).filter((t) => /^CWE/i.test(t)),
        description: rule.fullDescription?.text,
      });
    }
  }
  return map;
}

const fileOf = (tfl: SarifTfl | undefined): string =>
  tfl?.location?.physicalLocation?.artifactLocation?.uri ?? '';

function primaryFile(res: SarifResult): string | null {
  return res.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? null;
}

function primaryLocation(res: SarifResult): string | null {
  const phys = res.locations?.[0]?.physicalLocation;
  const uri = phys?.artifactLocation?.uri;
  if (!uri) return null;
  const line = phys?.region?.startLine;
  return line ? `${basename(uri)}:${line}` : basename(uri);
}

/** Per-finding default code-flow override, keyed by `${ruleId} @ ${primaryLocation}`. */
const DEFAULT_FLOW_OVERRIDES: Record<string, number> = {
  'java.security.xss-in-spring-app @ MessageController.java:96': 1,
};

function pickDefaultFlow(ruleId: string, location: string | null, flows: Flow[]): number {
  const override = location ? DEFAULT_FLOW_OVERRIDES[`${ruleId} @ ${location}`] : undefined;
  if (override != null && override >= 0 && override < flows.length) return override;
  let best = 0; // longest flow wins; ties resolve to the lowest index
  for (let i = 1; i < flows.length; i++) if (flows[i].steps.length > flows[best].steps.length) best = i;
  return best;
}

function buildSteps(locs: SarifTfl[]): TaintStep[] {
  return locs.map((tfl, i) => {
    const file = fileOf(tfl);
    const prevFile = i > 0 ? fileOf(locs[i - 1]) : file;
    const explicit = tfl.kinds?.find(
      (k): k is TaintStep['kind'] => k === 'source' || k === 'sink' || k === 'sanitizer',
    );
    const region = tfl.location?.physicalLocation?.region;
    return {
      index: i,
      kind: explicit ?? kindForPosition(i, locs.length),
      file,
      line: region?.startLine ?? 1,
      startColumn: region?.startColumn,
      endLine: region?.endLine,
      endColumn: region?.endColumn,
      label: tfl.location?.message?.text ?? '',
      crossesFile: i > 0 && file !== prevFile,
    };
  });
}

function buildFinding(res: SarifResult, idx: number, meta: Map<string, RuleMeta>): Finding {
  const ruleId = res.ruleId ?? 'unknown';
  // One Flow per codeFlow. opentaint emits a single threadFlow per codeFlow, so we take the
  // first; the SARIF schema permits more (parallel threads), which we don't model here.
  const flows: Flow[] = (res.codeFlows ?? []).map((cf) => ({
    steps: buildSteps(cf.threadFlows?.[0]?.locations ?? []),
  }));
  if (flows.length === 0) flows.push({ steps: [] }); // keep `flows` non-empty
  const location = primaryLocation(res);
  const defaultFlowIndex = pickDefaultFlow(ruleId, location, flows);
  return {
    id: `${ruleId}-${idx}`,
    ruleId,
    vulnClass: vulnClassForRule(ruleId),
    severity: severityFromLevel(res.level),
    endpoint: null,
    location,
    file: primaryFile(res),
    ruleFile: null,
    cwe: meta.get(ruleId)?.cwe ?? [],
    description: meta.get(ruleId)?.description,
    message: res.message?.text ?? '',
    flows,
    defaultFlowIndex,
  };
}

export function transformSarif(log: SarifLog): Finding[] {
  const meta = ruleMetaByRule(log);
  const results = log.runs?.flatMap((r) => r.results ?? []) ?? [];
  return results.map((res, idx) => buildFinding(res, idx, meta));
}
