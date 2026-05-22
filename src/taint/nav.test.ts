import { describe, it, expect } from 'vitest';
import { stepDepths, navigate } from './nav';
import type { TaintStep } from '../types/content';

const mk = (files: string[]): TaintStep[] =>
  files.map((file, index) => ({
    index,
    kind: 'propagation',
    file,
    line: index + 1,
    label: '',
    crossesFile: index > 0 && file !== files[index - 1],
  }));

// Mirrors the SSTI flow: CampaignController -> RenderRequest -> back -> TemplateRenderingService
const steps = mk(['CC', 'CC', 'RR', 'RR', 'CC', 'CC', 'TRS', 'TRS']);

describe('stepDepths', () => {
  it('derives call depth from file transitions (enter file = deeper frame)', () => {
    expect(stepDepths(steps)).toEqual([0, 0, 1, 1, 0, 0, 1, 1]);
  });
});

describe('navigate', () => {
  it('back/in move by one and clamp at bounds', () => {
    expect(navigate(steps, 0, 'back')).toBe(0);
    expect(navigate(steps, 3, 'back')).toBe(2);
    expect(navigate(steps, 0, 'in')).toBe(1);
    expect(navigate(steps, 7, 'in')).toBe(7);
  });

  it('over skips a deeper call, landing back at the same level', () => {
    expect(navigate(steps, 1, 'over')).toBe(4); // skip RenderRequest interior (2,3)
    expect(navigate(steps, 0, 'over')).toBe(1); // no call ahead -> like step in
  });

  it('out exits the current frame to the caller (or end)', () => {
    expect(navigate(steps, 2, 'out')).toBe(4); // exit RR frame
    expect(navigate(steps, 6, 'out')).toBe(7); // nothing shallower after -> last
    expect(navigate(steps, 0, 'out')).toBe(7); // top frame -> end
  });

  it('start/end jump to the first/last step', () => {
    expect(navigate(steps, 4, 'start')).toBe(0);
    expect(navigate(steps, 4, 'end')).toBe(7);
  });
});
