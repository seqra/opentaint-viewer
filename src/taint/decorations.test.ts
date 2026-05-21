import { describe, it, expect } from 'vitest';
import { decorationsForFile, classForKind } from './decorations';
import type { TaintStep } from '../types/content';

const steps: TaintStep[] = [
  { index: 0, kind: 'source', file: 'A.java', line: 4, label: 'src', crossesFile: false },
  { index: 1, kind: 'propagation', file: 'A.java', line: 5, label: 'mid', crossesFile: false },
  { index: 2, kind: 'sink', file: 'B.java', line: 4, label: 'sink', crossesFile: true },
];

describe('decorationsForFile', () => {
  it('returns only steps on the given file, with line + class + marker', () => {
    const decos = decorationsForFile(steps, 'A.java');
    expect(decos).toEqual([
      { line: 4, className: 'taint-source', marker: 1 },
      { line: 5, className: 'taint-propagation', marker: 2 },
    ]);
  });

  it('classForKind maps kinds to css class names', () => {
    expect(classForKind('source')).toBe('taint-source');
    expect(classForKind('sink')).toBe('taint-sink');
  });
});
