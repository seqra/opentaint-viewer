export type StepKind = 'source' | 'propagation' | 'sanitizer' | 'sink';
export type Severity = 'error' | 'warning' | 'note';
export type RuleOrigin = 'builtin' | 'custom';
export type Language = 'java' | 'kotlin' | 'yaml' | 'xml' | 'properties' | 'plaintext';

export interface TaintStep {
  index: number;
  kind: StepKind;
  file: string;
  line: number;
  label: string;
  crossesFile: boolean;
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
  message: string;
  steps: TaintStep[];
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

export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  startFile: string;
  defaultFindingId: string;
}

export interface PlaygroundContent {
  projectId: string;
  scenarios: Scenario[];
  files: ProjectFile[];
  findings: Finding[];
  rules: RuleSpec[];
}

export function isPlaygroundContent(value: unknown): value is PlaygroundContent {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.projectId === 'string' &&
    Array.isArray(c.scenarios) &&
    Array.isArray(c.files) &&
    Array.isArray(c.findings) &&
    Array.isArray(c.rules)
  );
}
