import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityBar } from './ActivityBar';

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
