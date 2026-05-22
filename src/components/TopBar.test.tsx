import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from './TopBar';

describe('TopBar', () => {
  it('shows the Install the CLI CTA linking to opentaint.org', () => {
    render(<TopBar onShare={() => {}} />);
    const cta = screen.getByRole('link', { name: /Install the CLI/i });
    expect(cta).toHaveAttribute('href', expect.stringContaining('opentaint.org'));
  });

  it('clicking Share invokes the onShare handler', async () => {
    const onShare = vi.fn();
    render(<TopBar onShare={onShare} />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(onShare).toHaveBeenCalledOnce();
  });
});
