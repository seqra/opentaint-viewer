import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompareToGrep } from './CompareToGrep';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

const content = loadContent();
const active = content.findings.find((f) => f.id === content.scenarios[0].defaultFindingId)!;
const crossFileHops = active.steps.filter((s) => s.crossesFile).length;

describe('CompareToGrep', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(content);
  });

  it('reports how many cross-file hops a single-file grep view would miss', () => {
    render(<CompareToGrep />);
    expect(screen.getByTestId('grep-missed')).toHaveTextContent(String(crossFileHops));
  });

  it('shows the full opentaint step count', () => {
    render(<CompareToGrep />);
    expect(screen.getByTestId('opentaint-steps')).toHaveTextContent(String(active.steps.length));
  });
});
