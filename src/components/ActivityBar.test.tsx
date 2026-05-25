import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityBar, toggleSidebarView } from './ActivityBar';

describe('toggleSidebarView', () => {
  it('opens a view when none or a different one is active', () => {
    expect(toggleSidebarView(null, 'findings')).toBe('findings');
    expect(toggleSidebarView('rules', 'findings')).toBe('findings');
  });

  it('collapses when the already-active view is clicked again', () => {
    expect(toggleSidebarView('findings', 'findings')).toBeNull();
  });
});

describe('ActivityBar', () => {
  it('marks the active view and reports clicks', async () => {
    const onSelect = vi.fn();
    render(<ActivityBar active="findings" onSelect={onSelect} />);
    expect(screen.getByTestId('activity-findings')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('activity-rules')).toHaveAttribute('aria-selected', 'false');

    await userEvent.click(screen.getByTestId('activity-rules'));
    expect(onSelect).toHaveBeenCalledWith('rules');
  });
});
