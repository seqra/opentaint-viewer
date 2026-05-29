import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EditorZoom } from './EditorZoom';
import { useStore } from '../state/store';

beforeEach(() => useStore.getState().reset());

describe('EditorZoom', () => {
  it('shows the current zoom percentage', () => {
    render(<EditorZoom />);
    expect(screen.getByTestId('editor-zoom-value')).toHaveTextContent('100%');
  });

  it('+ and − step by 10', async () => {
    render(<EditorZoom />);
    await userEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(useStore.getState().editorZoom).toBe(110);
    await userEvent.click(screen.getByRole('button', { name: /zoom out/i }));
    expect(useStore.getState().editorZoom).toBe(100);
  });

  it('disables − at 50 and + at 200', () => {
    useStore.getState().setEditorZoom(50);
    render(<EditorZoom />);
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /zoom in/i })).not.toBeDisabled();

    act(() => { useStore.getState().setEditorZoom(200); });
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /zoom out/i })).not.toBeDisabled();
  });
});
