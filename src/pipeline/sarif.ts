import type { Finding, Severity, TaintStep } from '../types/content';
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

/**
 * Pick the most complete trace for a result. opentaint emits several codeFlows for stored
 * taint: an abbreviated flow that starts where the value is read back out of storage, plus
 * the full flow from the original source through storage to the sink. They all end at the
 * same sink, so the longest threadFlow is the full source-to-sink path we want to show.
 */
function longestFlow(res: SarifResult): SarifTfl[] {
  let best: SarifTfl[] = [];
  for (const cf of res.codeFlows ?? []) {
    for (const tf of cf.threadFlows ?? []) {
      const locs = tf.locations ?? [];
      if (locs.length > best.length) best = locs;
    }
  }
  return best;
}

function buildFinding(res: SarifResult, idx: number, meta: Map<string, RuleMeta>): Finding {
  const ruleId = res.ruleId ?? 'unknown';
  const locs = longestFlow(res);
  const steps: TaintStep[] = locs.map((tfl, i) => {
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
  return {
    id: `${ruleId}-${idx}`,
    ruleId,
    vulnClass: vulnClassForRule(ruleId),
    severity: severityFromLevel(res.level),
    endpoint: null,
    location: primaryLocation(res),
    file: primaryFile(res),
    ruleFile: null,
    cwe: meta.get(ruleId)?.cwe ?? [],
    description: meta.get(ruleId)?.description,
    message: res.message?.text ?? '',
    steps,
  };
}

export function transformSarif(log: SarifLog): Finding[] {
  const meta = ruleMetaByRule(log);
  const results = log.runs?.flatMap((r) => r.results ?? []) ?? [];
  return results.map((res, idx) => buildFinding(res, idx, meta));
}
