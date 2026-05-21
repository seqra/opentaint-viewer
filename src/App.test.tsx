import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string }) => <div data-testid="monaco">{props.value}</div>,
}));

import App from './App';

describe('App', () => {
  it('renders the shell with a finding visible on first paint', () => {
    render(<App />);
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByTestId('findings-tree')).toBeInTheDocument();
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
    expect(screen.getByTestId('editor-area')).toBeInTheDocument();
  });

  it('opens the share dialog from the top bar', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(screen.getByTestId('share-url')).toBeInTheDocument();
  });
});
