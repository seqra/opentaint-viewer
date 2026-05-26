import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoPanel } from './InfoPanel';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

const content = loadContent();

describe('InfoPanel', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(content);
  });

  it('shows the Info tab by default and switches between Info and Steps', async () => {
    render(<InfoPanel />);
    expect(screen.getByTestId('finding-info')).toBeInTheDocument();
    expect(screen.queryByTestId('steps-list')).toBeNull();

    await userEvent.click(screen.getByTestId('info-tab-steps'));
    expect(screen.getByTestId('steps-list')).toBeInTheDocument();
    expect(screen.queryByTestId('finding-info')).toBeNull();

    await userEvent.click(screen.getByTestId('info-tab-info'));
    expect(screen.getByTestId('finding-info')).toBeInTheDocument();
    expect(screen.queryByTestId('steps-list')).toBeNull();
  });

  it('the layout toggle splits Info and Steps side by side', async () => {
    render(<InfoPanel />);
    expect(screen.getByTestId('finding-info')).toBeInTheDocument();
    expect(screen.queryByTestId('steps-list')).toBeNull();

    await userEvent.click(screen.getByTestId('layout-toggle'));
    expect(screen.getByTestId('finding-info')).toBeInTheDocument();
    expect(screen.getByTestId('steps-list')).toBeInTheDocument();
  });
});
