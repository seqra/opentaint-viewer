import type { Severity } from '../types/content';
import styles from './SeverityDot.module.css';

const CLASS: Record<Severity, string> = { error: styles.error, warning: styles.warning, note: styles.note };

/** Flat severity dot for the findings tree: error = brand red, warning = amber, note = grey. */
export function SeverityDot({ severity }: { severity: Severity }) {
  return <span className={`${styles.dot} ${CLASS[severity]}`} data-testid="severity-dot" aria-hidden="true" />;
}
