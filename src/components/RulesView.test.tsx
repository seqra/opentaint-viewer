import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string }) => <div data-testid="monaco">{props.value}</div>,
}));

import { RulesView } from './RulesView';
import { useStore } from '../state/store';
import { loadContent, rulesByOrigin } from '../content/loadContent';

const content = loadContent();
const rule = rulesByOrigin(content).builtin[0];

describe('RulesView', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(content);
    useStore.getState().selectRule(rule.id);
  });

  it('renders the active rule content', () => {
    render(<RulesView />);
    expect(screen.getByTestId('monaco').textContent).toContain(rule.content.slice(0, 16));
  });

  it('shows the rule path as a breadcrumb', () => {
    render(<RulesView />);
    expect(screen.getByText(rule.path.split('/').join(' › '))).toBeInTheDocument();
  });
});
