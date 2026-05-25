import type { Severity } from '../types/content';

const LABELS: Record<Severity, string> = { error: 'Error', warning: 'Warning', note: 'Note' };

/** Human label for a finding severity (rendered uppercase by the badge). */
export function severityLabel(severity: Severity): string {
  return LABELS[severity];
}
