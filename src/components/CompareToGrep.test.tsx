import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompareToGrep } from './CompareToGrep';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

describe('CompareToGrep', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(loadContent());
  });

  it('reports how many cross-file hops a single-file grep view would miss', () => {
    render(<CompareToGrep />);
    expect(screen.getByTestId('grep-missed')).toHaveTextContent('1');
  });

  it('shows the full opentaint step count', () => {
    render(<CompareToGrep />);
    expect(screen.getByTestId('opentaint-steps')).toHaveTextContent('4');
  });
});
