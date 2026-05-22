import type { TaintStep } from '../types/content';

export interface LineDecoration {
  line: number;
  /** Whole-line / lines-decoration class: strong for current, faint for the rest. */
  className: string;
  /** Gutter glyph class (arrow) for the current step only. */
  glyphClassName: string | undefined;
  /** 1-based step number. */
  marker: number;
  isCurrent: boolean;
}

/**
 * Decorations for the taint path on a single file: the current step is strong
 * (with a gutter arrow); every other step on the file is faint.
 */
export function pathDecorations(steps: TaintStep[], file: string, currentIndex: number): LineDecoration[] {
  return steps
    .filter((s) => s.file === file)
    .map((s) => {
      const isCurrent = s.index === currentIndex;
      return {
        line: s.line,
        className: isCurrent ? 'taint-current' : 'taint-faint',
        glyphClassName: isCurrent ? 'taint-arrow' : undefined,
        marker: s.index + 1,
        isCurrent,
      };
    });
}
