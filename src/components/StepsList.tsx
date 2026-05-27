import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { findingById, flowSteps } from '../content/loadContent';
import { keyActivate } from './keyActivate';
import { SeverityBadge } from './SeverityBadge';
import { basename } from '../util/path';
import styles from './StepsList.module.css';

/** The active finding's taint path as a clickable, debugger-style step list. */
export function StepsList() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const activeFlowIndex = useStore((s) => s.activeFlowIndex);
  const activeStepIndex = useStore((s) => s.activeStepIndex);
  const selectStep = useStore((s) => s.selectStep);
  const activeRef = useRef<HTMLLIElement>(null);
  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  const steps = finding ? flowSteps(finding, activeFlowIndex) : [];
  const flowCount = finding?.flows.length ?? 0;

  // Keep the current step visible as it changes (e.g. via next/prev or a finding click).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeFindingId, activeFlowIndex, activeStepIndex]);

  if (!finding) return null;

  return (
    <div className={styles.wrap}>
      {flowCount > 1 && (
        <div className={styles.flowHeader} data-testid="steps-flow-header">
          Flow {activeFlowIndex + 1} of {flowCount} · {steps.length} steps
        </div>
      )}
      <ol className={styles.steps} data-testid="steps-list">
        {steps.map((s) => {
          const isActive = activeStepIndex === s.index;
          return (
            <li
              key={s.index}
              ref={isActive ? activeRef : undefined}
              className={`${styles.step} ${isActive ? styles.active : ''}`}
              role="button"
              tabIndex={0}
              aria-current={isActive}
              onClick={() => selectStep(finding.id, s.index)}
              onKeyDown={keyActivate(() => selectStep(finding.id, s.index))}
            >
              <div className={styles.row}>
                <span className={styles.marker}>{s.index + 1}</span>
                {s.kind === 'sink' && <SeverityBadge severity={finding.severity} />}
                <span className={styles.loc}>
                  {basename(s.file)}:{s.line}
                  {s.crossesFile ? ' ↗' : ''}
                </span>
              </div>
              <div className={styles.label}>{s.label}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
