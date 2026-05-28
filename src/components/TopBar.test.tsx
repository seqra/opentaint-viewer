import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from './TopBar';
import { useTheme } from '../state/theme';
import { useStore } from '../state/store';

describe('TopBar', () => {
  beforeEach(() => useStore.setState({ content: null }));

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

  it('shows the semver and the build version (calver+hash) side by side, with the full analyzer string in title', () => {
    useStore.setState({ content: { projectId: 'p', tool: { name: 'OpenTaint', semanticVersion: '0.3.0', version: 'analyzer/abc' }, files: [], rules: [], findings: [] } as never });
    render(<TopBar />);
    const chip = screen.getByTestId('tool-version');
    expect(chip.textContent).toBe('v0.3.0 · abc'); // 'analyzer/' prefix stripped from display
    expect(chip.getAttribute('title')).toContain('analyzer/abc'); // full string still in tooltip
  });

  it('shows just the build version when there is no semver', () => {
    useStore.setState({ content: { projectId: 'p', tool: { name: 'OpenTaint', version: 'analyzer/2026.05.15.f15ed3a' }, files: [], rules: [], findings: [] } as never });
    render(<TopBar />);
    expect(screen.getByTestId('tool-version').textContent).toBe('2026.05.15.f15ed3a');
  });

  it('renders no version chip when the content has no tool versions', () => {
    useStore.setState({ content: { projectId: 'p', tool: { name: 'OpenTaint' }, files: [], rules: [], findings: [] } as never });
    render(<TopBar />);
    expect(screen.queryByTestId('tool-version')).toBeNull();
  });
});
