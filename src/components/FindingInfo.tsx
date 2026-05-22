import ReactMarkdown from 'react-markdown';
import { useStore } from '../state/store';
import { findingById } from '../content/loadContent';
import styles from './FindingInfo.module.css';

const SEVERITY_LABEL: Record<string, string> = { error: 'Error', warning: 'Warning', note: 'Note' };

/** Details for the active finding, sourced from the report, with a link to its rule. */
export function FindingInfo() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const selectRule = useStore((s) => s.selectRule);
  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  if (!finding) return null;

  return (
    <div className={styles.info} data-testid="finding-info">
      <div className={styles.head}>
        <span className={styles.vuln}>{finding.vulnClass}</span>
        <span className={`${styles.sev} ${styles[finding.severity]}`}>{SEVERITY_LABEL[finding.severity] ?? finding.severity}</span>
        {(finding.cwe ?? []).map((c) => (
          <span key={c} className={styles.tag}>{c}</span>
        ))}
        {finding.location && <span className={styles.loc}>{finding.location}</span>}
      </div>
      <p className={styles.msg}>{finding.message}</p>
      <div className={styles.rule}>
        rule:{' '}
        {finding.ruleFile ? (
          <button type="button" className={styles.ruleLink} onClick={() => selectRule(finding.ruleFile!, finding.ruleId)}>
            {finding.ruleId}
          </button>
        ) : (
          <span>{finding.ruleId}</span>
        )}
      </div>
      {finding.description && (
        <div className={styles.desc}>
          <ReactMarkdown>{finding.description}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
