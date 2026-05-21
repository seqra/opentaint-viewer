import type { StepKind, TaintStep } from '../types/content';

export interface LineDecoration {
  line: number;
  className: string;
  marker: number; // 1-based step number shown in the gutter
}

export function classForKind(kind: StepKind): string {
  return `taint-${kind}`;
}

export function decorationsForFile(steps: TaintStep[], file: string): LineDecoration[] {
  return steps
    .filter((s) => s.file === file)
    .map((s) => ({ line: s.line, className: classForKind(s.kind), marker: s.index + 1 }));
}
