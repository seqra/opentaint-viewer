import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingsTree } from './FindingsTree';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

describe('FindingsTree', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(loadContent());
  });

  it('lists findings by vuln class and endpoint', () => {
    render(<FindingsTree />);
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
    expect(screen.getByText('GET /users/search')).toBeInTheDocument();
  });

  it('renders each step of the active finding', () => {
    render(<FindingsTree />);
    expect(screen.getByText(/@RequestParam name/)).toBeInTheDocument();
    expect(screen.getByText(/stmt.execute/)).toBeInTheDocument();
  });

  it('clicking a step selects it in the store', async () => {
    render(<FindingsTree />);
    await userEvent.click(screen.getByText(/stmt.execute/));
    expect(useStore.getState().activeStepIndex).toBe(3);
    expect(useStore.getState().activeFile).toBe('UserRepository.java');
  });
});
