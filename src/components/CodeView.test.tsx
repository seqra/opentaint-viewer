import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { createDecorationsCollection } = vi.hoisted(() => ({
  createDecorationsCollection: vi.fn(() => ({ clear: vi.fn() })),
}));

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string; path?: string; onMount?: (e: unknown, m: unknown) => void }) => {
    props.onMount?.(
      { createDecorationsCollection },
      { Range: class { constructor(public sl: number, public sc: number, public el: number, public ec: number) {} } },
    );
    return <div data-testid="monaco" data-path={props.path}>{props.value}</div>;
  },
}));

import { CodeView } from './CodeView';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

describe('CodeView', () => {
  beforeEach(() => {
    createDecorationsCollection.mockClear();
    useStore.getState().reset();
    useStore.getState().loadContent(loadContent());
  });

  it('renders the active file content into the editor', () => {
    render(<CodeView />);
    const editor = screen.getByTestId('monaco');
    expect(editor.getAttribute('data-path')).toBe('UserController.java');
    expect(editor.textContent).toContain('@RequestParam');
  });

  it('shows file tabs for files touched by the active finding', () => {
    render(<CodeView />);
    expect(screen.getByRole('tab', { name: /UserController.java/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /UserRepository.java/ })).toBeInTheDocument();
  });

  it('applies taint decorations for the active file on mount', () => {
    render(<CodeView />);
    expect(createDecorationsCollection).toHaveBeenCalled();
    // UserController.java has 3 steps (lines 4,5,6); the sink (UserRepository.java) is excluded
    const calls = createDecorationsCollection.mock.calls as unknown[][];
    const decos = calls.at(-1)?.[0];
    expect(decos).toHaveLength(3);
  });
});
