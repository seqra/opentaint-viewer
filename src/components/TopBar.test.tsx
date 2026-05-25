import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from './TopBar';
import { useTheme } from '../state/theme';

const CMD = 'curl -fsSL https://opentaint.org/install.sh | bash';
const originalClipboard = navigator.clipboard;

afterEach(() => {
  Object.assign(navigator, { clipboard: originalClipboard });
});

describe('TopBar', () => {
  it('shows the install command and links the brand to opentaint.org', () => {
    render(<TopBar onShare={() => {}} />);
    expect(screen.getByText(CMD)).toBeInTheDocument();
    const brand = screen.getByRole('link', { name: /opentaint/i });
    expect(brand).toHaveAttribute('href', expect.stringContaining('opentaint.org'));
  });

  it('copies the install command to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<TopBar onShare={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /copy install command/i }));
    expect(writeText).toHaveBeenCalledWith(CMD);
  });

  it('falls back to a failed state (no throw) when the clipboard API is unavailable', async () => {
    Object.assign(navigator, { clipboard: undefined });
    render(<TopBar onShare={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /copy install command/i }));
    expect(await screen.findByRole('button', { name: /copy failed/i })).toBeInTheDocument();
  });

  it('clicking Share invokes the onShare handler', async () => {
    const onShare = vi.fn();
    render(<TopBar onShare={onShare} />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(onShare).toHaveBeenCalledOnce();
  });

  it('toggles the theme', async () => {
    useTheme.getState().setTheme('dark');
    render(<TopBar onShare={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /toggle theme/i }));
    expect(useTheme.getState().theme).toBe('light');
  });
});
