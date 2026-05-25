import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingsTree } from './FindingsTree';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

const content = loadContent();
const active = content.findings.find((f) => f.id === content.scenarios[0].defaultFindingId)!;
const otherRule = content.findings.find((f) => f.ruleId !== active.ruleId)!;
const dirPath = (active.file ?? '').split('/').slice(0, -1).join('/');
const filter = () => screen.getByRole('combobox', { name: /filter findings by rule/i });

describe('FindingsTree', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(content);
  });

  it('renders a rule filter: All option plus one per distinct rule', () => {
    render(<FindingsTree />);
    const ruleCount = new Set(content.findings.map((f) => f.ruleId)).size;
    expect(filter().querySelectorAll('option')).toHaveLength(ruleCount + 1);
  });

  it('selects a finding on click (steps now live in the info panel, not the tree)', async () => {
    render(<FindingsTree />);
    await userEvent.click(screen.getByText(otherRule.location!));
    expect(useStore.getState().activeFindingId).toBe(otherRule.id);
  });

  it('labels each finding by location and rule id, not the short vuln class', () => {
    render(<FindingsTree />);
    expect(screen.getByText(active.location!)).toBeInTheDocument();
    // The rule id appears on the row (exact match; the filter option carries a count suffix).
    expect(screen.getAllByText(active.ruleId).length).toBeGreaterThan(0);
    // The short vuln-class label is no longer rendered in the tree.
    expect(screen.queryByText(active.vulnClass)).toBeNull();
  });

  it('filtering to one rule hides findings from other rules', () => {
    render(<FindingsTree />);
    expect(screen.getByText(active.location!)).toBeInTheDocument();
    fireEvent.change(filter(), { target: { value: otherRule.ruleId } });
    expect(screen.queryByText(active.location!)).not.toBeInTheDocument();
    expect(screen.getByText(otherRule.location!)).toBeInTheDocument();
  });

  it('collapsing a directory hides the findings inside it', () => {
    const { container } = render(<FindingsTree />);
    expect(screen.getByText(active.location!)).toBeInTheDocument();
    const dirRow = container.querySelector(`[data-dir="${dirPath}"]`) as HTMLElement;
    expect(dirRow).not.toBeNull();
    fireEvent.click(dirRow);
    expect(screen.queryByText(active.location!)).not.toBeInTheDocument();
  });

  it('groups findings under a file node that can be collapsed', () => {
    const { container } = render(<FindingsTree />);
    expect(screen.getByText(active.location!)).toBeInTheDocument();
    const fileRow = container.querySelector(`[data-file="${active.file}"]`) as HTMLElement;
    expect(fileRow).not.toBeNull();
    fireEvent.click(fileRow);
    expect(screen.queryByText(active.location!)).not.toBeInTheDocument();
  });

});
