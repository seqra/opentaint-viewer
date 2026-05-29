import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string }) => <div data-testid="monaco">{props.value}</div>,
}));

import { MobileDrawer } from './MobileDrawer';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

beforeEach(() => {
  useStore.getState().reset();
  useStore.getState().loadContent(loadContent());
});

describe('MobileDrawer', () => {
  it('does not render when sidebarView is null', () => {
    useStore.setState({ sidebarView: null });
    const { container } = render(<MobileDrawer />);
    expect(container.querySelector('[data-testid="mobile-drawer"]')).toBeNull();
  });

  it('renders the Findings tree when sidebarView is "findings"', () => {
    useStore.setState({ sidebarView: 'findings' });
    render(<MobileDrawer />);
    expect(screen.getByTestId('mobile-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('findings-tree')).toBeInTheDocument();
    expect(screen.queryByTestId('rules-tree')).toBeNull();
  });

  it('switches to the Rules tree via the segmented control', async () => {
    useStore.setState({ sidebarView: 'findings' });
    render(<MobileDrawer />);
    await userEvent.click(screen.getByRole('tab', { name: /rules/i }));
    expect(useStore.getState().sidebarView).toBe('rules');
  });

  it('closes the drawer on scrim click', async () => {
    useStore.setState({ sidebarView: 'findings' });
    render(<MobileDrawer />);
    await userEvent.click(screen.getByTestId('mobile-drawer-scrim'));
    expect(useStore.getState().sidebarView).toBeNull();
  });

  it('closes the drawer on ✕ click', async () => {
    useStore.setState({ sidebarView: 'findings' });
    render(<MobileDrawer />);
    await userEvent.click(screen.getByLabelText(/close/i));
    expect(useStore.getState().sidebarView).toBeNull();
  });

  it('closes the drawer when Escape is pressed', async () => {
    useStore.setState({ sidebarView: 'findings' });
    render(<MobileDrawer />);
    await userEvent.keyboard('{Escape}');
    expect(useStore.getState().sidebarView).toBeNull();
  });
});
