import { useState } from 'react';
import { TopBar } from './TopBar';
import { FindingsTree } from './FindingsTree';
import { RulesTree } from './RulesTree';
import { EditorArea } from './EditorArea';
import { CompareToGrep } from './CompareToGrep';
import { ShareDialog } from './ShareDialog';
import styles from './AppShell.module.css';

export function AppShell() {
  const [sharing, setSharing] = useState(false);
  return (
    <div className={styles.shell}>
      <TopBar onShare={() => setSharing(true)} />
      <div className={styles.body}>
        <div className={styles.sidebar}>
          <div className={styles.shead}>FINDINGS</div>
          <FindingsTree />
          <div className={styles.shead}>RULES</div>
          <RulesTree />
        </div>
        <div className={styles.main}>
          <div className={styles.editor}><EditorArea /></div>
          <div className={styles.compare}><CompareToGrep /></div>
        </div>
      </div>
      {sharing && <ShareDialog onClose={() => setSharing(false)} />}
    </div>
  );
}
