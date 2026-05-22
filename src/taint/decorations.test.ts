import { describe, it, expect } from 'vitest';
import { pathDecorations } from './decorations';
import type { TaintStep } from '../types/content';

const steps: TaintStep[] = [
  { index: 0, kind: 'source', file: 'A.java', line: 4, label: 'src', crossesFile: false },
  { index: 1, kind: 'propagation', file: 'A.java', line: 5, label: 'mid', crossesFile: false },
  { index: 2, kind: 'sink', file: 'B.java', line: 4, label: 'sink', crossesFile: true },
];

describe('pathDecorations', () => {
  it('marks the current step strong and other same-file steps faint', () => {
    expect(pathDecorations(steps, 'A.java', 1)).toEqual([
      { line: 4, className: 'taint-faint', glyphClassName: undefined, marker: 1, isCurrent: false },
      { line: 5, className: 'taint-current', glyphClassName: 'taint-arrow', marker: 2, isCurrent: true },
    ]);
  });

  it('returns only steps on the given file and flags the current one', () => {
    const decos = pathDecorations(steps, 'B.java', 2);
    expect(decos.map((d) => d.line)).toEqual([4]);
    expect(decos[0].isCurrent).toBe(true);
  });
});
