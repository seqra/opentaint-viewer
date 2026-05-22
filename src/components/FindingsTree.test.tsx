import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingsTree } from './FindingsTree';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

const content = loadContent();
const active = content.findings.find((f) => f.id === content.scenarios[0].defaultFindingId)!;
const lastIdx = active.steps.length - 1;
const lastStep = active.steps[lastIdx];
const stepEl = (label: string) => screen.getByText((c) => c.includes(label));

describe('FindingsTree', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(content);
  });

  it('lists the active finding by vuln class and its location', () => {
    render(<FindingsTree />);
    expect(screen.getAllByText(active.vulnClass).length).toBeGreaterThan(0);
    if (active.location) expect(screen.getByText(active.location)).toBeInTheDocument();
  });

  it('renders the steps of the active finding', () => {
    render(<FindingsTree />);
    expect(stepEl(active.steps[0].label)).toBeInTheDocument();
    expect(stepEl(lastStep.label)).toBeInTheDocument();
  });

  it('clicking the sink step selects it in the store', async () => {
    render(<FindingsTree />);
    await userEvent.click(stepEl(lastStep.label));
    expect(useStore.getState().activeStepIndex).toBe(lastIdx);
    expect(useStore.getState().activeFile).toBe(lastStep.file);
  });

  it('exposes step rows as focusable buttons', () => {
    render(<FindingsTree />);
    expect(stepEl(lastStep.label)).toHaveAttribute('role', 'button');
    expect(stepEl(lastStep.label)).toHaveAttribute('tabindex', '0');
  });

  it('activates a step row from the keyboard (Enter)', () => {
    render(<FindingsTree />);
    fireEvent.keyDown(stepEl(lastStep.label), { key: 'Enter' });
    expect(useStore.getState().activeStepIndex).toBe(lastIdx);
    expect(useStore.getState().activeFile).toBe(lastStep.file);
  });
});
