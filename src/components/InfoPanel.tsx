import { useState } from 'react';
import { FindingInfo } from './FindingInfo';
import { StepsList } from './StepsList';
import { Tabs, type TabItem } from './Tabs';
import styles from './InfoPanel.module.css';

type InfoTab = 'info' | 'steps';

const TABS: ReadonlyArray<TabItem> = [
  { id: 'info', label: 'Info', testId: 'info-tab-info' },
  { id: 'steps', label: 'Steps', testId: 'info-tab-steps' },
];

/** Lower panel: the finding's report details (Info) and its taint path (Steps). */
export function InfoPanel() {
  const [tab, setTab] = useState<InfoTab>('info');
  return (
    <div className={styles.panel} data-testid="info-panel">
      <Tabs className={styles.bar} ariaLabel="Finding details" items={TABS} active={tab} onSelect={(id) => setTab(id as InfoTab)} />
      <div className={styles.body}>{tab === 'info' ? <FindingInfo /> : <StepsList />}</div>
    </div>
  );
}
