import { useStore } from '../state/store';
import { findingById } from '../content/loadContent';
import { keyActivate } from './keyActivate';
import type { StepKind } from '../types/content';
import styles from './StepsList.module.css';

const KIND_CLASS: Record<StepKind, string> = {
  source: styles.source,
  propagation: styles.prop,
  sanitizer: styles.sanitizer,
  sink: styles.sink,
};
const base = (path: string): string => path.split('/').pop() || path;

/** The active finding's taint path as a clickable, debugger-style step list. */
export function StepsList() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const activeStepIndex = useStore((s) => s.activeStepIndex);
  const selectStep = useStore((s) => s.selectStep);
  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  if (!finding) return null;

  return (
    <ol className={styles.steps} data-testid="steps-list">
      {finding.steps.map((s) => {
        const isActive = activeStepIndex === s.index;
        return (
          <li
            key={s.index}
            className={`${styles.step} ${isActive ? styles.active : ''}`}
            role="button"
            tabIndex={0}
            aria-current={isActive}
            onClick={() => selectStep(finding.id, s.index)}
            onKeyDown={keyActivate(() => selectStep(finding.id, s.index))}
          >
            <div className={styles.row}>
              <span className={styles.marker}>{s.index + 1}</span>
              <span className={`${styles.kind} ${KIND_CLASS[s.kind]}`}>{s.kind}</span>
              <span className={styles.loc}>
                {base(s.file)}:{s.line}
                {s.crossesFile ? ' ↗' : ''}
              </span>
            </div>
            <div className={styles.label}>{s.label}</div>
          </li>
        );
      })}
    </ol>
  );
}
