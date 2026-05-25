import type { Severity } from '../types/content';
import { severityLabel } from '../util/severity';
import styles from './SeverityBadge.module.css';

const CLASS: Record<Severity, string> = { error: styles.error, warning: styles.warning, note: styles.note };

/** Severity pill (ERROR/WARNING/NOTE), coloured by level — shared by the info and steps panels. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`${styles.badge} ${CLASS[severity]}`} data-testid="severity-badge">
      {severityLabel(severity)}
    </span>
  );
}
