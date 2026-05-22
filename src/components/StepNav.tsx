import { useStore } from '../state/store';
import { findingById } from '../content/loadContent';
import styles from './StepNav.module.css';

/** Debugger-style step controls for the active finding's taint path. */
export function StepNav() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const activeStepIndex = useStore((s) => s.activeStepIndex);
  const step = useStore((s) => s.step);

  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  if (!finding || finding.steps.length === 0) return null;

  const n = finding.steps.length;
  const cur = activeStepIndex ?? 0;
  const atStart = cur <= 0;
  const atEnd = cur >= n - 1;

  return (
    <div className={styles.nav} data-testid="step-nav">
      <button className={styles.btn} aria-label="Step back" disabled={atStart} onClick={() => step('back')}>◀ back</button>
      <button className={styles.btn} aria-label="Step in" disabled={atEnd} onClick={() => step('in')}>⤵ in</button>
      <button className={styles.btn} aria-label="Step over" disabled={atEnd} onClick={() => step('over')}>⤳ over</button>
      <button className={styles.btn} aria-label="Step out" disabled={atEnd} onClick={() => step('out')}>⤴ out</button>
      <span className={styles.count}>
        step {cur + 1}/{n}
      </span>
    </div>
  );
}
