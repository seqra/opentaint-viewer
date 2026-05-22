import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string }) => <div data-testid="monaco">{props.value}</div>,
}));

import { EditorArea } from './EditorArea';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

describe('EditorArea', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(loadContent());
  });

  it('in tabs mode shows only the active view', () => {
    render(<EditorArea />);
    expect(screen.getByTestId('code-view')).toBeInTheDocument();
    expect(screen.queryByTestId('rules-view')).not.toBeInTheDocument();
  });

  it('toggling split shows both views', async () => {
    render(<EditorArea />);
    await userEvent.click(screen.getByRole('button', { name: /split/i }));
    expect(screen.getByTestId('code-view')).toBeInTheDocument();
    expect(screen.getByTestId('rules-view')).toBeInTheDocument();
    expect(useStore.getState().viewMode).toBe('split');
  });

  it('clicking the Rules tab switches the active view in tabs mode', async () => {
    render(<EditorArea />);
    await userEvent.click(screen.getByRole('tab', { name: /Rules/ }));
    expect(useStore.getState().activeTab).toBe('rules');
    expect(screen.getByTestId('rules-view')).toBeInTheDocument();
  });

  it('split mode places a draggable resize handle between Code and Rules', async () => {
    render(<EditorArea />);
    await userEvent.click(screen.getByRole('button', { name: /split/i }));
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });
});
