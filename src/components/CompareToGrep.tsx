import { useStore } from '../state/store';
import { findingById } from '../content/loadContent';
import styles from './CompareToGrep.module.css';

export function CompareToGrep() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  if (!finding) return null;

  const crossFileHops = finding.steps.filter((s) => s.crossesFile).length;

  return (
    <div className={styles.wrap} data-testid="compare-to-grep">
      <div className={styles.col}>
        <div>Naive single-file / grep view</div>
        <div className={`${styles.num} ${styles.miss}`} data-testid="grep-missed">{crossFileHops}</div>
        <div className={styles.miss}>cross-file hop(s) it cannot follow — so it misses this vulnerability.</div>
      </div>
      <div className={styles.col}>
        <div>OpenTaint whole-program dataflow</div>
        <div className={`${styles.num} ${styles.win}`} data-testid="opentaint-steps">{finding.steps.length}</div>
        <div className={styles.win}>steps tracked from source to sink, across files.</div>
      </div>
    </div>
  );
}
