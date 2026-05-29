import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string }) => <div data-testid="monaco">{props.value}</div>,
}));

import { MobileShell } from './MobileShell';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

beforeEach(() => {
  useStore.getState().reset();
  useStore.getState().loadContent(loadContent());
});

describe('MobileShell', () => {
  it('renders TopBar, top tabs, context strip, and step footer', () => {
    render(<MobileShell />);
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-context-strip')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-step-footer')).toBeInTheDocument();
  });

  it('defaults to the Code tab', () => {
    render(<MobileShell />);
    expect(screen.getByTestId('mobile-tab-code')).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to Details and shows Info / Steps sub-tabs', async () => {
    render(<MobileShell />);
    await userEvent.click(screen.getByTestId('mobile-tab-details'));
    expect(useStore.getState().mobileTab).toBe('details');
    expect(screen.getByTestId('info-tab-info')).toBeInTheDocument();
    expect(screen.getByTestId('info-tab-steps')).toBeInTheDocument();
  });

  it('switches to Rule tab', async () => {
    render(<MobileShell />);
    await userEvent.click(screen.getByTestId('mobile-tab-rule'));
    expect(useStore.getState().mobileTab).toBe('rule');
  });

  it('opens the drawer when the TopBar menu is tapped', async () => {
    useStore.setState({ sidebarView: null });
    render(<MobileShell />);
    expect(screen.queryByTestId('mobile-drawer')).toBeNull();
    await userEvent.click(screen.getByTestId('top-bar-menu'));
    expect(screen.getByTestId('mobile-drawer')).toBeInTheDocument();
  });

  it('closes the drawer when a finding is selected from inside it', async () => {
    useStore.setState({ sidebarView: 'findings' });
    render(<MobileShell />);
    expect(screen.getByTestId('mobile-drawer')).toBeInTheDocument();

    // FindingsTree doesn't use `finding-` testids; findings are rendered as
    // role="button" divs whose visible text is the location. Scope the query
    // to the findings-tree subtree so fold rows aren't confused with findings.
    const tree = screen.getByTestId('findings-tree');
    const firstFinding = useStore.getState().content!.findings[0];
    const findingNode = within(tree).getByText(firstFinding.location ?? '');
    await userEvent.click(findingNode);

    expect(useStore.getState().sidebarView).toBeNull();
    expect(useStore.getState().mobileTab).toBe('code');
  });
});
