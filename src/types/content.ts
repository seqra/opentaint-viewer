export type StepKind = 'source' | 'propagation' | 'sanitizer' | 'sink';
export type Severity = 'error' | 'warning' | 'note';
export type RuleOrigin = 'builtin' | 'custom';
export type RuleKind = 'rule' | 'passthrough' | 'dataflow';
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
  id: string;
  origin: RuleOrigin;
  kind: RuleKind;
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
