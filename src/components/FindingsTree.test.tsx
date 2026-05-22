import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingsTree } from './FindingsTree';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

const content = loadContent();
const active = content.findings.find((f) => f.id === content.scenarios[0].defaultFindingId)!;
const lastStep = active.steps[active.steps.length - 1];
const otherRule = content.findings.find((f) => f.ruleId !== active.ruleId)!;
const dirPath = (active.file ?? '').split('/').slice(0, -1).join('/');
const stepEl = (label: string) => screen.getByText((c) => c.includes(label));
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

  it('shows the active finding steps by default and selects a step on click', async () => {
    render(<FindingsTree />);
    await userEvent.click(stepEl(lastStep.label));
    expect(useStore.getState().activeStepIndex).toBe(active.steps.length - 1);
    expect(useStore.getState().activeFile).toBe(lastStep.file);
  });

  it('exposes step rows as focusable buttons', () => {
    render(<FindingsTree />);
    expect(stepEl(lastStep.label)).toHaveAttribute('role', 'button');
    expect(stepEl(lastStep.label)).toHaveAttribute('tabindex', '0');
  });

  it('filtering to one rule hides findings from other rules', () => {
    render(<FindingsTree />);
    expect(screen.getAllByText(active.vulnClass).length).toBeGreaterThan(0);
    fireEvent.change(filter(), { target: { value: otherRule.ruleId } });
    expect(screen.queryByText(active.vulnClass)).not.toBeInTheDocument();
    expect(screen.getAllByText(otherRule.vulnClass).length).toBeGreaterThan(0);
  });

  it('collapsing a directory hides the findings inside it', () => {
    const { container } = render(<FindingsTree />);
    expect(screen.getAllByText(active.vulnClass).length).toBeGreaterThan(0);
    const dirRow = container.querySelector(`[data-dir="${dirPath}"]`) as HTMLElement;
    expect(dirRow).not.toBeNull();
    fireEvent.click(dirRow);
    expect(screen.queryByText(active.vulnClass)).not.toBeInTheDocument();
  });

  it('groups findings under a file node that can be collapsed', () => {
    const { container } = render(<FindingsTree />);
    expect(screen.getByText(active.location!)).toBeInTheDocument();
    const fileRow = container.querySelector(`[data-file="${active.file}"]`) as HTMLElement;
    expect(fileRow).not.toBeNull();
    fireEvent.click(fileRow);
    expect(screen.queryByText(active.location!)).not.toBeInTheDocument();
  });

  it('shows debugger step controls under the active finding', () => {
    render(<FindingsTree />);
    expect(screen.getByTestId('step-nav')).toBeInTheDocument();
  });
});
