export type StepKind = 'source' | 'propagation' | 'sanitizer' | 'sink';
export type Severity = 'error' | 'warning' | 'note';
export type RuleOrigin = 'builtin' | 'custom';
export type Language = 'java' | 'kotlin' | 'yaml' | 'xml' | 'properties' | 'plaintext';

export interface ToolInfo {
  /** Analyzer name from the SARIF driver, e.g. "OpenTaint". */
  name: string;
  /** SARIF driver.semanticVersion, e.g. "0.3.0". */
  semanticVersion?: string;
  /** SARIF driver.version, e.g. "analyzer/2026.05.15.f15ed3a". */
  version?: string;
}

export interface TaintStep {
  index: number;
  kind: StepKind;
  file: string;
  /** 1-based start line. */
  line: number;
  /** Optional precise span (1-based) for column-accurate highlighting. */
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
  label: string;
  crossesFile: boolean;
}

export interface Flow {
  /** Ordered source → … → sink for one code flow. */
  steps: TaintStep[];
}

export interface Finding {
  id: string;
  ruleId: string;
  vulnClass: string;
  severity: Severity;
  endpoint: string | null;
  /** Primary location as `basename:line` — shown when there is no endpoint. */
  location: string | null;
  /** Full path of the primary-location file — used to group findings by directory. */
  file: string | null;
  /** Path of the rule file that defines `ruleId`, if known (filled during regen). */
  ruleFile: string | null;
  /** CWE tags from the report (e.g. ["CWE-94"]). */
  cwe?: string[];
  /** Full rule description from the report (markdown). */
  description?: string;
  message: string;
  /** Every code flow the engine reported for this finding (≥ 1, in SARIF order). */
  flows: Flow[];
  /** Which flow to show first (0-based, in range of `flows`). */
  defaultFlowIndex: number;
}

export interface ProjectFile {
  path: string;
  language: Language;
  content: string;
}

export interface RuleSpec {
  /** Stable id; equals `path` so findings can link to a rule file by path. */
  id: string;
  origin: RuleOrigin;
  /** Real ruleset-relative path, e.g. `java/security/xss.yaml`. Drives the tree. */
  path: string;
  content: string;
}

export interface ViewerContent {
  projectId: string;
  tool?: ToolInfo;
  files: ProjectFile[];
  rules: RuleSpec[];
  findings: Finding[];
}

export function isViewerContent(value: unknown): value is ViewerContent {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  if (
    typeof c.projectId !== 'string' ||
    !Array.isArray(c.files) ||
    !Array.isArray(c.findings) ||
    !Array.isArray(c.rules)
  ) {
    return false;
  }
  if (c.tool !== undefined) {
    const t = c.tool as Record<string, unknown> | null;
    if (typeof t !== 'object' || t === null || typeof t.name !== 'string') return false;
  }
  return (c.findings as unknown[]).every((f) => {
    if (typeof f !== 'object' || f === null) return false;
    const finding = f as Record<string, unknown>;
    const flows = finding.flows;
    const idx = finding.defaultFlowIndex;
    return (
      Array.isArray(flows) && flows.length > 0 &&
      typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx < flows.length
    );
  });
}
