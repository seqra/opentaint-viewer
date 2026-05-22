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

  it('steps next on ArrowRight, over on Shift+ArrowRight', () => {
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(useStore.getState().activeStepIndex).toBe(navigate(active.steps, 0, 'next'));

    useStore.getState().selectStep(active.id, 0);
    fireEvent.keyDown(document.body, { key: 'ArrowRight', shiftKey: true });
    expect(useStore.getState().activeStepIndex).toBe(navigate(active.steps, 0, 'nextOver'));
  });

  it('steps back out to the caller on ArrowUp', () => {
    render(<Harness />);
    useStore.getState().selectStep(active.id, 2);
    fireEvent.keyDown(document.body, { key: 'ArrowUp' });
    expect(useStore.getState().activeStepIndex).toBe(navigate(active.steps, 2, 'out'));
  });

  it('jumps to end/start on End/Home', () => {
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
