import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string }) => <div data-testid="monaco">{props.value}</div>,
}));

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

  it('shows both the findings and rules trees with a resize handle between them', () => {
    render(<App />);
    expect(screen.getByTestId('findings-tree')).toBeInTheDocument();
    expect(screen.getByTestId('rules-tree')).toBeInTheDocument();
    expect(screen.getAllByRole('separator').length).toBeGreaterThan(0);
  });
});
