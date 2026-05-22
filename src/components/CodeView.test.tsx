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

const content = loadContent();
const active = content.findings.find((f) => f.id === content.scenarios[0].defaultFindingId)!;
const activeFile = content.scenarios[0].startFile;
const decoCount = active.steps.filter((s) => s.file === activeFile).length;
const tabBasenames = [...new Set(active.steps.map((s) => s.file))].map((f) => f.split('/').pop()!);
const fileHead = content.files.find((f) => f.path === activeFile)!.content.slice(0, 20);

describe('CodeView', () => {
  beforeEach(() => {
    createDecorationsCollection.mockClear();
    useStore.getState().reset();
    useStore.getState().loadContent(content);
  });

  it('renders the active file content into the editor', () => {
    render(<CodeView />);
    const editor = screen.getByTestId('monaco');
    expect(editor.getAttribute('data-path')).toBe(activeFile);
    expect(editor.textContent).toContain(fileHead);
  });

  it('shows file tabs for every file touched by the active finding', () => {
    render(<CodeView />);
    for (const name of tabBasenames) {
      expect(screen.getByRole('tab', { name: (n) => n.includes(name) })).toBeInTheDocument();
    }
  });

  it('applies taint decorations for the active file on mount', () => {
    render(<CodeView />);
    expect(createDecorationsCollection).toHaveBeenCalled();
    const calls = createDecorationsCollection.mock.calls as unknown[][];
    expect(calls.at(-1)?.[0]).toHaveLength(decoCount);
  });
});
