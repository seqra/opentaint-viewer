import type { TaintStep } from '../types/content';

export interface StepDecoration {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  /** When true, no precise columns were available — highlight the whole line. */
  wholeLine: boolean;
  /** Strong for the current step, faint for the rest. */
  className: string;
  /** Gutter glyph (arrow) for the current step only. */
  glyphClassName: string | undefined;
  marker: number;
  isCurrent: boolean;
}

/**
 * Decorations for the taint path on a single file. Uses each step's column span
 * for a precise highlight when available, falling back to a whole-line highlight.
 * The current step is strong (with a gutter arrow); the rest of the path is faint.
 */
export function pathDecorations(steps: TaintStep[], file: string, currentIndex: number): StepDecoration[] {
  return steps
    .filter((s) => s.file === file)
    .map((s) => {
      const isCurrent = s.index === currentIndex;
      const hasColumns = s.startColumn != null && s.endColumn != null;
      return {
        startLine: s.line,
        startColumn: hasColumns ? s.startColumn! : 1,
        endLine: hasColumns ? s.endLine ?? s.line : s.line,
        endColumn: hasColumns ? s.endColumn! : 1,
        wholeLine: !hasColumns,
        className: isCurrent ? 'taint-current' : 'taint-faint',
        glyphClassName: isCurrent ? 'taint-arrow' : undefined,
        marker: s.index + 1,
        isCurrent,
      };
    });
}
