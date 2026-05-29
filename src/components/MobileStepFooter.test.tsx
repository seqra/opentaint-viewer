import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@monaco-editor/react', () => ({
  default: (props: { value?: string }) => <div data-testid="monaco">{props.value}</div>,
}));

import { MobileStepFooter } from './MobileStepFooter';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';

beforeEach(() => {
  useStore.getState().reset();
  useStore.getState().loadContent(loadContent());
});

describe('MobileStepFooter', () => {
  it('does not render when no finding is selected', () => {
    useStore.setState({ activeFindingId: null });
    const { container } = render(<MobileStepFooter />);
    expect(container.querySelector('[data-testid="mobile-step-footer"]')).toBeNull();
  });

  it('shows current step index, total, and Prev/Next buttons', () => {
    render(<MobileStepFooter />);
    const footer = screen.getByTestId('mobile-step-footer');
    expect(footer).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous step/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next step/i })).toBeInTheDocument();
    // counter format "N/M"
    expect(footer.textContent).toMatch(/\d+\s*\/\s*\d+/);
  });

  it('Next advances the active step', async () => {
    // Force selection onto step 0 so "Next" has somewhere to go.
    const state = useStore.getState();
    if (state.activeFindingId) state.selectStep(state.activeFindingId, 0);
    render(<MobileStepFooter />);
    const before = useStore.getState().activeStepIndex;
    await userEvent.click(screen.getByRole('button', { name: /next step/i }));
    const after = useStore.getState().activeStepIndex;
    expect(after).toBe((before ?? 0) + 1);
  });

  it('disables Prev at step 0 and Next at the last step', () => {
    const state = useStore.getState();
    if (state.activeFindingId) state.selectStep(state.activeFindingId, 0);
    render(<MobileStepFooter />);
    expect(screen.getByRole('button', { name: /previous step/i })).toBeDisabled();
    act(() => { state.step('end'); });
    expect(screen.getByRole('button', { name: /next step/i })).toBeDisabled();
  });
});
