import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useStepKeys } from './useStepKeys';
import { useStore } from '../state/store';
import { loadContent, flowSteps } from '../content/loadContent';
import { navigate } from '../taint/nav';

const content = loadContent();
const active = content.findings.find((f) => f.flows[f.defaultFlowIndex].steps.length > 1)!;
const activeSteps = flowSteps(active, active.defaultFlowIndex);

function Harness() {
  useStepKeys();
  return (
    <div>
      <select data-testid="sel"><option>x</option></select>
      <textarea data-testid="ta" />
      {/* Mimics Monaco's DOM: a focusable element nested inside the editor root. */}
      <div className="monaco-editor"><span data-testid="mono-child" tabIndex={0}>code</span></div>
    </div>
  );
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
    expect(useStore.getState().activeStepIndex).toBe(navigate(activeSteps, 0, 'next'));

    useStore.getState().selectStep(active.id, 0);
    fireEvent.keyDown(document.body, { key: 'ArrowRight', shiftKey: true });
    expect(useStore.getState().activeStepIndex).toBe(navigate(activeSteps, 0, 'nextOver'));
  });

  it('steps back out to the caller on ArrowUp', () => {
    render(<Harness />);
    useStore.getState().selectStep(active.id, 2);
    fireEvent.keyDown(document.body, { key: 'ArrowUp' });
    expect(useStore.getState().activeStepIndex).toBe(navigate(activeSteps, 2, 'out'));
  });

  it('jumps to end/start on End/Home', () => {
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: 'End' });
    expect(useStore.getState().activeStepIndex).toBe(activeSteps.length - 1);
    fireEvent.keyDown(document.body, { key: 'Home' });
    expect(useStore.getState().activeStepIndex).toBe(0);
  });

  it('ignores keys while a select is focused', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.keyDown(getByTestId('sel'), { key: 'ArrowRight' });
    expect(useStore.getState().activeStepIndex).toBe(0);
  });

  it('ignores arrow keys while the code editor (Monaco) owns them', () => {
    const { getByTestId } = render(<Harness />);
    // A bare textarea (and anything inside .monaco-editor) should keep its caret keys.
    fireEvent.keyDown(getByTestId('ta'), { key: 'ArrowRight' });
    expect(useStore.getState().activeStepIndex).toBe(0);

    fireEvent.keyDown(getByTestId('mono-child'), { key: 'ArrowLeft' });
    expect(useStore.getState().activeStepIndex).toBe(0);
  });
});
