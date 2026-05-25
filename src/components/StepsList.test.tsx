import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepsList } from './StepsList';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

const content = loadContent();
const active = content.findings.find((f) => f.id === content.scenarios[0].defaultFindingId)!;
const lastStep = active.steps[active.steps.length - 1];
const stepEl = (label: string) => screen.getByText((c) => c.includes(label));

describe('StepsList', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(content);
  });

  it('renders one row per step of the active finding', () => {
    render(<StepsList />);
    const rows = screen.getByTestId('steps-list').querySelectorAll('[role="button"]');
    expect(rows).toHaveLength(active.steps.length);
  });

  it('selects a step and switches to its file on click', async () => {
    render(<StepsList />);
    await userEvent.click(stepEl(lastStep.label));
    expect(useStore.getState().activeStepIndex).toBe(active.steps.length - 1);
    expect(useStore.getState().activeFile).toBe(lastStep.file);
  });

  it('exposes each step message inside a focusable button row', () => {
    render(<StepsList />);
    expect(stepEl(lastStep.label).closest('[role="button"]')).toHaveAttribute('tabindex', '0');
  });

  it('shows the finding severity on the sink step instead of kind words', () => {
    render(<StepsList />);
    expect(screen.getByText(active.severity.toUpperCase())).toBeInTheDocument();
    expect(screen.queryByText(/^(source|propagation|sanitizer|sink)$/i)).toBeNull();
  });
});
