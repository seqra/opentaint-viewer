import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useStepKeys } from './useStepKeys';
import { useStore } from '../state/store';
import { loadContent } from '../content/loadContent';
import { navigate } from '../taint/nav';

const content = loadContent();
const active = content.findings.find((f) => f.steps.length > 1)!;

function Harness() {
  useStepKeys();
  return <select data-testid="sel"><option>x</option></select>;
}

describe('useStepKeys', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.getState().loadContent(content);
    useStore.getState().selectStep(active.id, 0);
  });

  it('steps in on ArrowRight', () => {
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(useStore.getState().activeStepIndex).toBe(navigate(active.steps, 0, 'in'));
  });

  it('jumps to end on End and back to start on Home', () => {
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: 'End' });
    expect(useStore.getState().activeStepIndex).toBe(active.steps.length - 1);
    fireEvent.keyDown(document.body, { key: 'Home' });
    expect(useStore.getState().activeStepIndex).toBe(0);
  });

  it('ignores keys while a select is focused', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.keyDown(getByTestId('sel'), { key: 'ArrowRight' });
    expect(useStore.getState().activeStepIndex).toBe(0);
  });
});
