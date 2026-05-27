import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepsList } from './StepsList';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

const content = loadContent();
const active = content.findings.find((f) => f.id === content.scenarios[0].defaultFindingId)!;
const activeSteps = active.flows[active.defaultFlowIndex].steps;
const lastStep = activeSteps[activeSteps.length - 1];
const stepEl = (label: string) => screen.getByText((c) => c.includes(label));

describe('StepsList', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(content);
  });

  it('renders one row per step of the active finding', () => {
    render(<StepsList />);
    const rows = screen.getByTestId('steps-list').querySelectorAll('[role="button"]');
    expect(rows).toHaveLength(activeSteps.length);
  });

  it('selects a step and switches to its file on click', async () => {
    render(<StepsList />);
    await userEvent.click(stepEl(lastStep.label));
    expect(useStore.getState().activeStepIndex).toBe(activeSteps.length - 1);
    expect(useStore.getState().activeFile).toBe(lastStep.file);
  });

  it('exposes each step message inside a focusable button row', () => {
    render(<StepsList />);
    expect(stepEl(lastStep.label).closest('[role="button"]')).toHaveAttribute('tabindex', '0');
  });

  it('scrolls the active step into view when the active step changes', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
    render(<StepsList />);
    spy.mockClear();
    // loadContent focuses the sink (last step), so step into a different step to change it.
    act(() => useStore.getState().selectStep(active.id, 0));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shows a severity badge on the sink step instead of kind words', () => {
    render(<StepsList />);
    expect(screen.getByTestId('severity-badge')).toBeInTheDocument();
    expect(screen.queryByText(/^(source|propagation|sanitizer|sink)$/i)).toBeNull();
  });

  it('shows a flow header only for multi-flow findings', () => {
    const single = content.findings.find((f) => f.flows.length === 1)!;
    useStore.getState().selectFinding(single.id);
    const { unmount } = render(<StepsList />);
    expect(screen.queryByTestId('steps-flow-header')).toBeNull();
    unmount();

    const multi = content.findings.find((f) => f.flows.length > 1)!;
    useStore.getState().selectFinding(multi.id);
    render(<StepsList />);
    expect(screen.getByTestId('steps-flow-header')).toHaveTextContent(/Flow \d+ of \d+/);
  });
});
