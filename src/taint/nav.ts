import type { TaintStep } from '../types/content';

export type StepOp = 'back' | 'next' | 'backOver' | 'nextOver' | 'out' | 'start' | 'end';

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

  if (op === 'start') return 0;
  if (op === 'end') return n - 1;
  if (op === 'back') return Math.max(0, cur - 1);
  if (op === 'next') return Math.min(n - 1, cur + 1);

  const depths = stepDepths(steps);
  if (op === 'nextOver') {
    const next = cur + 1;
    if (next >= n) return cur;
    if (depths[next] <= depths[cur]) return next; // not a call -> step next
    let j = next;
    while (j < n && depths[j] > depths[cur]) j++;
    // If the call never returns to this frame in-path, step in rather than overshoot.
    return j < n ? j : next;
  }
  if (op === 'backOver') {
    const prev = cur - 1;
    if (prev < 0) return cur;
    if (depths[prev] <= depths[cur]) return prev; // not a call -> step back
    let j = prev;
    while (j >= 0 && depths[j] > depths[cur]) j--;
    return j >= 0 ? j : prev;
  }
  // out: walk backward to the most recent shallower step (the call site).
  const d = depths[cur];
  let j = cur - 1;
  while (j >= 0 && depths[j] >= d) j--;
  return Math.max(0, j);
}
