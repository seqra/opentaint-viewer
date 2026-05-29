import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode, Ref } from 'react';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string }) => <div data-testid="monaco">{props.value}</div>,
}));

// react-resizable-panels needs real browser layout (it asserts on measured sizes),
// so mock it for this jsdom smoke test — panel behaviour is covered by e2e.
vi.mock('react-resizable-panels', async () => {
  const React = await import('react');
  const handle = {
    collapse() {}, expand() {}, resize() {},
    isCollapsed: () => false, isExpanded: () => true, getId: () => '', getSize: () => 0,
  };
  return {
    PanelGroup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Panel: React.forwardRef(function Panel({ children }: { children?: ReactNode }, ref: Ref<unknown>) {
      React.useImperativeHandle(ref, () => handle);
      return <div>{children}</div>;
    }),
    PanelResizeHandle: () => <div role="separator" />,
  };
});

import App from './App';
import { useStore } from './state/store';
import { loadContent } from './content/loadContent';

const content = loadContent();
const active = content.findings[0];

describe('App', () => {
  // Sidebar/info-tab state now lives in the store (a singleton), so reset between tests.
  beforeEach(() => useStore.getState().reset());

  it('renders the shell with a finding visible on first paint', () => {
    render(<App />);
    expect(screen.getAllByTestId('top-bar').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('findings-tree').length).toBeGreaterThan(0);
    expect(screen.getAllByText(active.location!).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('editor-area').length).toBeGreaterThan(0);
  });

  it('switches the sidebar between Findings and Rules from the activity bar (mutually exclusive)', async () => {
    render(<App />);
    expect(screen.getAllByTestId('findings-tree').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('rules-tree').length).toBe(0);

    await userEvent.click(screen.getByTestId('activity-rules'));
    expect(screen.getAllByTestId('rules-tree').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('findings-tree').length).toBe(0);

    // Clicking the active view again collapses the sidebar (no tree shown).
    await userEvent.click(screen.getByTestId('activity-rules'));
    expect(screen.queryAllByTestId('rules-tree').length).toBe(0);
    expect(screen.queryAllByTestId('findings-tree').length).toBe(0);
  });
});
