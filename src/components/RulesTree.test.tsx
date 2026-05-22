import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesTree } from './RulesTree';
import { useStore } from '../state/store';
import { loadContent, rulesByOrigin } from '../content/loadContent';

const content = loadContent();
const firstBuiltin = rulesByOrigin(content).builtin[0];
const leafName = firstBuiltin.path.split('/').pop()!;
const leafEl = () => screen.getAllByText((c) => c.includes(leafName))[0];

describe('RulesTree', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(content);
  });

  it('shows Builtin and Custom sections', () => {
    render(<RulesTree />);
    expect(screen.getByText(/📁 Builtin/)).toBeInTheDocument();
    expect(screen.getByText(/📁 Custom/)).toBeInTheDocument();
  });

  it('renders builtin rule files as leaves and selects on click', async () => {
    render(<RulesTree />);
    await userEvent.click(leafEl());
    expect(useStore.getState().activeRuleId).toBe(firstBuiltin.id);
    expect(useStore.getState().activeTab).toBe('rules');
  });

  it('exposes rule leaves as focusable buttons', () => {
    render(<RulesTree />);
    expect(leafEl()).toHaveAttribute('role', 'button');
    expect(leafEl()).toHaveAttribute('tabindex', '0');
  });

  it('activates a rule leaf from the keyboard (Enter)', () => {
    render(<RulesTree />);
    fireEvent.keyDown(leafEl(), { key: 'Enter' });
    expect(useStore.getState().activeRuleId).toBe(firstBuiltin.id);
    expect(useStore.getState().activeTab).toBe('rules');
  });
});
