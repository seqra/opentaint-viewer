import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from './TopBar';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

describe('TopBar', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(loadContent());
  });

  it('shows the Install the CLI CTA linking to opentaint.org', () => {
    render(<TopBar onShare={() => {}} />);
    const cta = screen.getByRole('link', { name: /Install the CLI/i });
    expect(cta).toHaveAttribute('href', expect.stringContaining('opentaint.org'));
  });

  it('selecting a scenario updates the store', async () => {
    render(<TopBar onShare={() => {}} />);
    expect(screen.getByRole('combobox')).toHaveValue('sqli');
  });

  it('clicking Share invokes the onShare handler', async () => {
    const onShare = vi.fn();
    render(<TopBar onShare={onShare} />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(onShare).toHaveBeenCalledOnce();
  });
});
