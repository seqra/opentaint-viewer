import { useState } from 'react';
import { FindingInfo } from './FindingInfo';
import { StepsList } from './StepsList';
import styles from './InfoPanel.module.css';

type InfoTab = 'info' | 'steps';

const TABS: ReadonlyArray<{ id: InfoTab; label: string }> = [
  { id: 'info', label: 'Info' },
  { id: 'steps', label: 'Steps' },
];

/** Lower panel: the finding's report details (Info) and its taint path (Steps). */
export function InfoPanel() {
  const [tab, setTab] = useState<InfoTab>('info');
  return (
    <div className={styles.panel} data-testid="info-panel">
      <div className={styles.tabs} role="tablist">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.active : ''}`}
            onClick={() => setTab(id)}
            data-testid={`info-tab-${id}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.body}>{tab === 'info' ? <FindingInfo /> : <StepsList />}</div>
    </div>
  );
}
