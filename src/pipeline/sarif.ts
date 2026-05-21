import type { Finding, Severity, TaintStep } from '../types/content';

const VULN_CLASS_BY_RULE: Record<string, string> = {
  sqli: 'SQL Injection',
  'sql-injection': 'SQL Injection',
  ssrf: 'SSRF',
  'path-traversal': 'Path Traversal',
  xss: 'XSS',
  'command-injection': 'Command Injection',
  'open-redirect': 'Open Redirect',
};

export function vulnClassForRule(ruleId: string): string {
  return VULN_CLASS_BY_RULE[ruleId] ?? ruleId;
}

function severityFromLevel(level: unknown): Severity {
  return level === 'warning' || level === 'note' ? level : 'error';
}

function kindForPosition(i: number, total: number): TaintStep['kind'] {
  if (i === 0) return 'source';
  if (i === total - 1) return 'sink';
  return 'propagation';
}

interface SarifTfl {
  location?: {
    physicalLocation?: { artifactLocation?: { uri?: string }; region?: { startLine?: number } };
    message?: { text?: string };
  };
  kinds?: string[];
}
interface SarifResult {
  ruleId?: string;
  level?: string;
  message?: { text?: string };
  properties?: { endpoint?: string };
  codeFlows?: Array<{ threadFlows?: Array<{ locations?: SarifTfl[] }> }>;
}
interface SarifLog { runs?: Array<{ results?: SarifResult[] }> }

function fileOf(tfl: SarifTfl | undefined): string {
  return tfl?.location?.physicalLocation?.artifactLocation?.uri ?? '';
}

function buildFinding(res: SarifResult, idx: number): Finding {
  const ruleId = res.ruleId ?? 'unknown';
  const locs = res.codeFlows?.[0]?.threadFlows?.[0]?.locations ?? [];
  const steps: TaintStep[] = locs.map((tfl, i) => {
    const file = fileOf(tfl);
    const prevFile = i > 0 ? fileOf(locs[i - 1]) : file;
    const explicit = tfl.kinds?.find((k): k is TaintStep['kind'] =>
      k === 'source' || k === 'sink' || k === 'sanitizer',
    );
    return {
      index: i,
      kind: explicit ?? kindForPosition(i, locs.length),
      file,
      line: tfl.location?.physicalLocation?.region?.startLine ?? 1,
      label: tfl.location?.message?.text ?? '',
      crossesFile: i > 0 && file !== prevFile,
    };
  });
  return {
    id: `${ruleId}-${idx}`,
    ruleId,
    vulnClass: vulnClassForRule(ruleId),
    severity: severityFromLevel(res.level),
    endpoint: res.properties?.endpoint ?? null,
    message: res.message?.text ?? '',
    steps,
  };
}

export function transformSarif(log: SarifLog): Finding[] {
  const results = log.runs?.flatMap((r) => r.results ?? []) ?? [];
  return results.map(buildFinding);
}
