import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string; path?: string }) => (
    <div data-testid="monaco" data-path={props.path}>{props.value}</div>
  ),
}));

import { CodeView } from './CodeView';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

describe('CodeView', () => {
  beforeEach(() => {
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
});
