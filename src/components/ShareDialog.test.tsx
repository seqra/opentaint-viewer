import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareDialog } from './ShareDialog';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';
import { decodeViewState } from '../state/permalink';

const firstScenarioId = loadContent().scenarios[0].id;

describe('ShareDialog', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(loadContent());
    useStore.getState().setViewMode('split');
  });

  it('renders a share URL whose hash decodes to the current view state', () => {
    render(<ShareDialog onClose={() => {}} />);
    const input = screen.getByTestId('share-url') as HTMLInputElement;
    const hash = input.value.split('#')[1];
    const decoded = decodeViewState(hash);
    expect(decoded?.scenarioId).toBe(firstScenarioId);
    expect(decoded?.viewMode).toBe('split');
  });
});
