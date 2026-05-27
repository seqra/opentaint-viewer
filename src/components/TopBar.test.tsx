import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from './TopBar';
import { useTheme } from '../state/theme';

describe('TopBar', () => {
  it('links the brand to opentaint.org', () => {
    render(<TopBar />);
    expect(screen.getByRole('link', { name: /opentaint/i })).toHaveAttribute('href', 'https://opentaint.org/');
  });

  it('shows a Star CTA linking to the GitHub repo', () => {
    render(<TopBar />);
    expect(screen.getByRole('link', { name: /star/i })).toHaveAttribute('href', 'https://github.com/seqra/opentaint');
  });

  it('shows an Install CTA linking to the repo quick-start', () => {
    render(<TopBar />);
    expect(screen.getByRole('link', { name: /install/i })).toHaveAttribute(
      'href',
      'https://github.com/seqra/opentaint#quick-start',
    );
  });

  it('toggles the theme', async () => {
    useTheme.getState().setTheme('dark');
    render(<TopBar />);
    await userEvent.click(screen.getByRole('button', { name: /toggle theme/i }));
    expect(useTheme.getState().theme).toBe('light');
  });
});
