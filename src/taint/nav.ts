import type { TaintStep } from '../types/content';

export type StepOp = 'back' | 'next' | 'backOver' | 'nextOver' | 'out';

/**
 * Call depth per step, inferred from file transitions: entering a not-yet-open
 * file is a call (push a frame); returning to a file already on the stack pops
 * back to it. Used to give step-over / step-out semantics even though opentaint
 * SARIF carries no explicit nestingLevel.
 */
export function stepDepths(steps: TaintStep[]): number[] {
  const stack: string[] = [];
  return steps.map((s) => {
    if (stack.length === 0) {
      stack.push(s.file);
    } else if (stack[stack.length - 1] !== s.file) {
      if (stack.includes(s.file)) {
        while (stack[stack.length - 1] !== s.file) stack.pop();
      } else {
        stack.push(s.file);
      }
    }
    return stack.length - 1;
  });
}

/** Index of the step reached by a navigation op. `out` always steps back out to the caller. */
export function navigate(steps: TaintStep[], current: number, op: StepOp): number {
  const n = steps.length;
  if (n === 0) return current;
  const cur = Math.max(0, Math.min(n - 1, current));

  if (op === 'back') return Math.max(0, cur - 1);
  if (op === 'next') return Math.min(n - 1, cur + 1);

  const depths = stepDepths(steps);
  if (op === 'nextOver') {
    let j = cur + 1;
    while (j < n && depths[j] > depths[cur]) j++;
    return Math.min(n - 1, j);
  }
  if (op === 'backOver') {
    let j = cur - 1;
    while (j >= 0 && depths[j] > depths[cur]) j--;
    return Math.max(0, j);
  }
  // out: walk backward to the most recent shallower step (the call site).
  const d = depths[cur];
  let j = cur - 1;
  while (j >= 0 && depths[j] >= d) j--;
  return Math.max(0, j);
}
