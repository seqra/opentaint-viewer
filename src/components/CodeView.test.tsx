import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { createDecorationsCollection, defineTheme, onKeyDown, onKeyDownHandlers } = vi.hoisted(() => {
  const handlers: Array<(e: { code: string; preventDefault: () => void; stopPropagation: () => void }) => void> = [];
  return {
    createDecorationsCollection: vi.fn(() => ({ clear: vi.fn() })),
    defineTheme: vi.fn(),
    onKeyDown: vi.fn((cb: (e: { code: string; preventDefault: () => void; stopPropagation: () => void }) => void) => {
      handlers.push(cb);
      return { dispose: vi.fn() };
    }),
    onKeyDownHandlers: handlers,
  };
});

vi.mock('@monaco-editor/react', () => ({
  default: (props: {
    value?: string;
    path?: string;
    beforeMount?: (m: { editor: { defineTheme: (name: string, data: unknown) => void } }) => void;
    onMount?: (e: unknown, m: unknown) => void;
  }) => {
    props.beforeMount?.({ editor: { defineTheme } });
    props.onMount?.(
      { createDecorationsCollection, onKeyDown },
      { Range: class { constructor(public sl: number, public sc: number, public el: number, public ec: number) {} } },
    );
    return <div data-testid="monaco" data-path={props.path}>{props.value}</div>;
  },
}));

import { CodeView, phoneEditorOverrides } from './CodeView';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

const content = loadContent();
const active = content.findings[0];
const activeSteps = active.flows[active.defaultFlowIndex].steps;
const activeFile = activeSteps[activeSteps.length - 1].file;
const decoCount = activeSteps.filter((s) => s.file === activeFile).length;
const tabBasenames = [...new Set(activeSteps.map((s) => s.file))].map((f) => f.split('/').pop()!);
const fileHead = content.files.find((f) => f.path === activeFile)!.content.slice(0, 20);
const multiFlow = content.findings.find((f) => f.flows.length > 1)!;

describe('CodeView', () => {
  beforeEach(() => {
    createDecorationsCollection.mockClear();
    defineTheme.mockClear();
    onKeyDown.mockClear();
    onKeyDownHandlers.length = 0;
    useStore.getState().reset();
    useStore.getState().loadContent(content);
  });

  it('renders the active file content into the editor', () => {
    render(<CodeView />);
    const editor = screen.getByTestId('monaco');
    expect(editor.getAttribute('data-path')).toBe(activeFile);
    expect(editor.textContent).toContain(fileHead);
  });

  it('registers the ot-dark and ot-light Monaco themes before mount', () => {
    render(<CodeView />);
    const names = defineTheme.mock.calls.map((c) => c[0]);
    expect(names).toContain('ot-dark');
    expect(names).toContain('ot-light');
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

  it('gives only the current step a hover showing its message', () => {
    render(<CodeView />);
    const calls = createDecorationsCollection.mock.calls as unknown[][];
    const decos = (calls.at(-1)?.[0] ?? []) as Array<{ options: { hoverMessage?: { value: string } } }>;
    const withHover = decos.filter((d) => d.options.hoverMessage);
    expect(withHover).toHaveLength(1);
    // On load the current step is the sink (last step).
    expect(withHover[0].options.hoverMessage!.value).toBe(activeSteps[activeSteps.length - 1].label);
  });

  it('hides the flow nav for single-flow findings', () => {
    const single = content.findings.find((f) => f.flows.length === 1)!;
    useStore.getState().selectFinding(single.id);
    render(<CodeView />);
    expect(screen.queryByTestId('flow-nav')).toBeNull();
  });

  it('blocks Monaco caret/scroll keys via the editor onKeyDown hook', () => {
    render(<CodeView />);
    expect(onKeyDownHandlers.length).toBeGreaterThan(0);
    for (const code of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']) {
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      onKeyDownHandlers.forEach((cb) => cb({ code, preventDefault, stopPropagation }));
      expect(preventDefault).toHaveBeenCalled();
      expect(stopPropagation).toHaveBeenCalled();
    }
  });

  it('lets non-navigation keys through to Monaco', () => {
    render(<CodeView />);
    for (const code of ['KeyA', 'KeyC', 'Tab', 'Escape']) {
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      onKeyDownHandlers.forEach((cb) => cb({ code, preventDefault, stopPropagation }));
      expect(preventDefault).not.toHaveBeenCalled();
      expect(stopPropagation).not.toHaveBeenCalled();
    }
  });

  it('shows the flow nav and switches flows for multi-flow findings', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    useStore.getState().selectFinding(multiFlow.id);
    render(<CodeView />);
    expect(screen.getByTestId('flow-nav')).toBeInTheDocument();
    const before = useStore.getState().activeFlowIndex;
    const prevDisabled = before <= 0;
    await userEvent.click(screen.getByTestId(prevDisabled ? 'flow-next' : 'flow-prev'));
    expect(useStore.getState().activeFlowIndex).not.toBe(before);
  });
});

describe('phoneEditorOverrides', () => {
  const origMM = window.matchMedia;
  afterEach(() => {
    window.matchMedia = origMM;
  });

  it('returns {} when matchMedia does not match', () => {
    window.matchMedia = (() => ({
      matches: false, media: '', onchange: null,
      addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {},
      dispatchEvent() { return false; },
    })) as unknown as typeof window.matchMedia;
    expect(phoneEditorOverrides()).toEqual({});
  });

  it('returns phone overrides when matchMedia matches', () => {
    window.matchMedia = (() => ({
      matches: true, media: '', onchange: null,
      addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {},
      dispatchEvent() { return false; },
    })) as unknown as typeof window.matchMedia;
    expect(phoneEditorOverrides()).toMatchObject({
      readOnly: true,
      minimap: { enabled: false },
      lineNumbersMinChars: 3,
      scrollBeyondLastLine: false,
      wordWrap: 'off',
    });
    // fontSize is owned by the persisted editorZoom slice, not by the phone overrides.
    expect((phoneEditorOverrides() as { fontSize?: number }).fontSize).toBeUndefined();
  });
});
