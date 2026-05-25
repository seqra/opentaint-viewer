import { describe, it, expect, vi } from 'vitest';
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
import { loadContent } from './content/loadContent';

const firstVulnClass = loadContent().findings[0].vulnClass;

describe('App', () => {
  it('renders the shell with a finding visible on first paint', () => {
    render(<App />);
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByTestId('findings-tree')).toBeInTheDocument();
    expect(screen.getAllByText(firstVulnClass).length).toBeGreaterThan(0);
    expect(screen.getByTestId('editor-area')).toBeInTheDocument();
  });

  it('opens the share dialog from the top bar', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(screen.getByTestId('share-url')).toBeInTheDocument();
  });

  it('switches the sidebar between Findings and Rules from the activity bar (mutually exclusive)', async () => {
    render(<App />);
    expect(screen.getByTestId('findings-tree')).toBeInTheDocument();
    expect(screen.queryByTestId('rules-tree')).toBeNull();

    await userEvent.click(screen.getByTestId('activity-rules'));
    expect(screen.getByTestId('rules-tree')).toBeInTheDocument();
    expect(screen.queryByTestId('findings-tree')).toBeNull();

    // Clicking the active view again collapses the sidebar (no tree shown).
    await userEvent.click(screen.getByTestId('activity-rules'));
    expect(screen.queryByTestId('rules-tree')).toBeNull();
    expect(screen.queryByTestId('findings-tree')).toBeNull();
  });
});
