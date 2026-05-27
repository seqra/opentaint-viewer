import { describe, it, expect } from 'vitest';
import { pathDecorations } from './decorations';
import type { TaintStep } from '../types/content';

const steps: TaintStep[] = [
  { index: 0, kind: 'source', file: 'A.java', line: 4, label: 'src', crossesFile: false },
  { index: 1, kind: 'propagation', file: 'A.java', line: 5, startColumn: 7, endLine: 5, endColumn: 20, label: 'mid', crossesFile: false },
  { index: 2, kind: 'sink', file: 'B.java', line: 4, startColumn: 3, endLine: 4, endColumn: 9, label: 'sink', crossesFile: true },
];

describe('pathDecorations', () => {
  it('falls back to whole-line without columns and uses the precise span with them', () => {
    const decos = pathDecorations(steps, 'A.java', 1);
    expect(decos[0]).toMatchObject({ startLine: 4, startColumn: 1, endColumn: 1, wholeLine: true, className: 'taint-faint', isCurrent: false });
    expect(decos[1]).toMatchObject({
      startLine: 5,
      startColumn: 7,
      endLine: 5,
      endColumn: 20,
      wholeLine: false,
      className: 'taint-current',
      glyphClassName: 'taint-arrow',
      isCurrent: true,
    });
  });

  it('returns only steps on the given file and flags the current one', () => {
    const decos = pathDecorations(steps, 'B.java', 2);
    expect(decos.map((d) => d.startLine)).toEqual([4]);
    expect(decos[0]).toMatchObject({ startColumn: 3, endColumn: 9, wholeLine: false, isCurrent: true });
  });

  it('carries each step message for the hover tooltip', () => {
    expect(pathDecorations(steps, 'A.java', 1).map((d) => d.message)).toEqual(['src', 'mid']);
    expect(pathDecorations(steps, 'B.java', 2)[0].message).toBe('sink');
  });

  it('always highlights the last step (sink) with the red sink class', () => {
    // The sink is the current step -> red, still flagged current (keeps the gutter arrow).
    expect(pathDecorations(steps, 'B.java', 2)[0]).toMatchObject({
      className: 'taint-sink',
      glyphClassName: 'taint-arrow',
      isCurrent: true,
    });
    // The current step is elsewhere -> the sink stays red, just not current.
    expect(pathDecorations(steps, 'B.java', 0)[0]).toMatchObject({ className: 'taint-sink', isCurrent: false });
  });
});
