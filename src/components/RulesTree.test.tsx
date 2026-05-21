import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesTree } from './RulesTree';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

describe('RulesTree', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(loadContent());
  });

  it('shows Builtin and Custom directories', () => {
    render(<RulesTree />);
    expect(screen.getByText('📁 Builtin')).toBeInTheDocument();
    expect(screen.getByText('📁 Custom')).toBeInTheDocument();
  });

  it('lists the three spec kinds under an origin', () => {
    render(<RulesTree />);
    expect(screen.getAllByText(/Rules/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Passthrough approximations/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Dataflow approximations/)[0]).toBeInTheDocument();
  });

  it('clicking a rule selects it and switches the editor to rules', async () => {
    render(<RulesTree />);
    await userEvent.click(screen.getByText((content) => content.includes('sqli.yaml')));
    expect(useStore.getState().activeRuleId).toBe('sqli');
    expect(useStore.getState().activeTab).toBe('rules');
  });

  it('exposes rule leaves as focusable buttons', () => {
    render(<RulesTree />);
    const leaf = screen.getByText((content) => content.includes('sqli.yaml'));
    expect(leaf).toHaveAttribute('role', 'button');
    expect(leaf).toHaveAttribute('tabindex', '0');
  });

  it('activates a rule leaf from the keyboard (Enter)', () => {
    render(<RulesTree />);
    fireEvent.keyDown(screen.getByText((content) => content.includes('sqli.yaml')), { key: 'Enter' });
    expect(useStore.getState().activeRuleId).toBe('sqli');
    expect(useStore.getState().activeTab).toBe('rules');
  });
});
