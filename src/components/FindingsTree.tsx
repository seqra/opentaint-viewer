import { useStore } from '../state/store';
import { keyActivate } from './keyActivate';
import styles from './FindingsTree.module.css';

export function FindingsTree() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const activeStepIndex = useStore((s) => s.activeStepIndex);
  const selectStep = useStore((s) => s.selectStep);
  const selectFinding = useStore((s) => s.selectFinding);
  if (!content) return null;

  return (
    <div className={styles.tree} data-testid="findings-tree">
      {content.findings.map((f) => {
        const isActive = f.id === activeFindingId;
        return (
          <div key={f.id}>
            <div
              className={styles.finding}
              role="button"
              tabIndex={0}
              onClick={() => selectFinding(f.id)}
              onKeyDown={keyActivate(() => selectFinding(f.id))}
            >
              {isActive ? '▾' : '▸'} 🔴 <span>{f.vulnClass}</span>
            </div>
            {f.endpoint && <div className={styles.endpoint}><span>{f.endpoint}</span></div>}
            {isActive &&
              f.steps.map((s) => (
                <div
                  key={s.index}
                  className={`${styles.step} ${activeStepIndex === s.index ? styles.active : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectStep(f.id, s.index)}
                  onKeyDown={keyActivate(() => selectStep(f.id, s.index))}
                >
                  <span className={styles.marker}>{s.index + 1}</span>
                  {s.label}
                  {s.crossesFile && <span className={styles.cross}>↗ file</span>}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}
