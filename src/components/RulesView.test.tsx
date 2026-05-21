import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string }) => <div data-testid="monaco">{props.value}</div>,
}));

import { RulesView } from './RulesView';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

describe('RulesView', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(loadContent());
    useStore.getState().selectRule('sqli');
  });

  it('renders the active rule YAML and a breadcrumb', () => {
    render(<RulesView />);
    expect(screen.getByTestId('monaco').textContent).toContain('mode: taint');
    expect(screen.getByText(/Builtin/)).toBeInTheDocument();
  });
});
