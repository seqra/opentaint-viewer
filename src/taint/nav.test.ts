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
  it('back/next move by one and clamp at bounds', () => {
    expect(navigate(steps, 0, 'back')).toBe(0);
    expect(navigate(steps, 3, 'back')).toBe(2);
    expect(navigate(steps, 0, 'next')).toBe(1);
    expect(navigate(steps, 7, 'next')).toBe(7);
  });

  it('nextOver skips a deeper call forward', () => {
    expect(navigate(steps, 1, 'nextOver')).toBe(4); // skip RenderRequest interior (2,3)
    expect(navigate(steps, 0, 'nextOver')).toBe(1); // no call ahead -> like next
  });

  it('nextOver on a trailing call (no return in-path) acts like step in', () => {
    // step 5 calls into TemplateRenderingService which never returns within the path;
    // stepping over has nowhere to land, so it steps in instead of overshooting to the end.
    expect(navigate(steps, 5, 'nextOver')).toBe(6);
  });

  it('backOver skips a deeper call backward', () => {
    expect(navigate(steps, 4, 'backOver')).toBe(1); // skip RenderRequest interior backward
    expect(navigate(steps, 1, 'backOver')).toBe(0); // no deeper call behind -> like back
    expect(navigate(steps, 6, 'backOver')).toBe(5); // prev is shallower -> like back
  });

  it('out steps back out to the caller (shallower step before the current frame)', () => {
    expect(navigate(steps, 2, 'out')).toBe(1); // exit RR frame -> the call site
    expect(navigate(steps, 6, 'out')).toBe(5); // exit TRS frame -> its call site
    expect(navigate(steps, 0, 'out')).toBe(0); // already at top -> stay
  });

  it('start/end jump to the first/last step', () => {
    expect(navigate(steps, 4, 'start')).toBe(0);
    expect(navigate(steps, 4, 'end')).toBe(7);
  });
});
