import type { TaintStep } from '../types/content';

export type StepOp = 'back' | 'in' | 'over' | 'out' | 'start' | 'end';

/**
 * Call depth per step, inferred from file transitions: entering a not-yet-open
 * file is a call (push a frame); returning to a file already on the stack pops
 * back to it. Used to give step-over / step-out debugger semantics even though
 * opentaint SARIF carries no explicit nestingLevel.
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

/** Index of the step reached by a debugger-style navigation op. */
export function navigate(steps: TaintStep[], current: number, op: StepOp): number {
  const n = steps.length;
  if (n === 0) return current;
  const cur = Math.max(0, Math.min(n - 1, current));

  if (op === 'start') return 0;
  if (op === 'end') return n - 1;
  if (op === 'back') return Math.max(0, cur - 1);
  if (op === 'in') return Math.min(n - 1, cur + 1);

  const depths = stepDepths(steps);
  if (op === 'over') {
    let j = cur + 1;
    while (j < n && depths[j] > depths[cur]) j++;
    return Math.min(n - 1, j);
  }
  // out: advance until we drop below the current frame's depth
  const d = depths[cur];
  let j = cur + 1;
  while (j < n && depths[j] >= d) j++;
  return j < n ? j : n - 1;
}
