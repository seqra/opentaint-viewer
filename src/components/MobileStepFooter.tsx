import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../state/store';
import { findingById, flowSteps } from '../content/loadContent';
import { basename } from '../util/path';
import styles from './MobileStepFooter.module.css';

export function MobileStepFooter() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const activeStepIndex = useStore((s) => s.activeStepIndex);
  const activeFlowIndex = useStore((s) => s.activeFlowIndex);
  const mobileTab = useStore((s) => s.mobileTab);
  const step = useStore((s) => s.step);

  // The step navigator belongs to the Code view only; on Details the Steps list
  // is itself the navigator, and the Rule view has no steps.
  if (mobileTab !== 'code') return null;
  if (!content || !activeFindingId) return null;
  const finding = findingById(content, activeFindingId);
  if (!finding) return null;
  const steps = flowSteps(finding, activeFlowIndex);
  if (steps.length === 0) return null;

  const cur = activeStepIndex ?? 0;
  const atStart = cur <= 0;
  const atEnd = cur >= steps.length - 1;
  const curStep = steps[cur];
  const nextStepFile = atEnd ? null : steps[cur + 1].file;
  const nextFileChanges = nextStepFile && nextStepFile !== curStep.file;

  return (
    <div className={styles.footer} data-testid="mobile-step-footer">
      <button
        type="button"
        className={styles.btn}
        disabled={atStart}
        onClick={() => step('back')}
        aria-label="Previous step"
      >
        <ChevronLeft size={18} />
      </button>
      {/* Step message and position are merged into the navigator's centre column. */}
      <div className={styles.body} data-testid="mobile-step-message">
        <div className={styles.head}>
          <span className={styles.where}>{basename(curStep.file)}:{curStep.line}</span>
          <span className={styles.counter}>{cur + 1}/{steps.length}</span>
        </div>
        <div className={styles.what}>
          {curStep.label}
          {nextFileChanges && (
            <span className={styles.hint} data-testid="mobile-step-next-file"> → {basename(nextStepFile)}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        className={styles.btn}
        disabled={atEnd}
        onClick={() => step('next')}
        aria-label="Next step"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
