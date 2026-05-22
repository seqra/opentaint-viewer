import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepNav } from './StepNav';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';
import { navigate } from '../taint/nav';

const content = loadContent();
const active = content.findings.find((f) => f.steps.length > 1)!;

describe('StepNav', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(content);
    useStore.getState().selectStep(active.id, 1);
  });

  it('shows the current step position', () => {
    render(<StepNav />);
    expect(screen.getByTestId('step-nav')).toHaveTextContent(`step 2/${active.steps.length}`);
  });

  it('navigates with the step buttons', async () => {
    render(<StepNav />);
    await userEvent.click(screen.getByRole('button', { name: /step in/i }));
    expect(useStore.getState().activeStepIndex).toBe(navigate(active.steps, 1, 'in'));
  });

  it('disables back at the first step', () => {
    useStore.getState().selectStep(active.id, 0);
    render(<StepNav />);
    expect(screen.getByRole('button', { name: /step back/i })).toBeDisabled();
  });
});
