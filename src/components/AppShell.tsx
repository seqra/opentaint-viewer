import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
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
        <PanelGroup direction="horizontal" autoSaveId="ot-body">
          <Panel defaultSize={22} minSize={12} maxSize={45} className={styles.sidebar}>
            <PanelGroup direction="vertical" autoSaveId="ot-sidebar">
              <Panel defaultSize={45} minSize={12} className={styles.sidePanel}>
                <div className={styles.shead}>FINDINGS</div>
                <div className={styles.scroll}>
                  <FindingsTree />
                </div>
              </Panel>
              <PanelResizeHandle className={styles.vHandle} />
              <Panel defaultSize={55} minSize={12} className={styles.sidePanel}>
                <div className={styles.shead}>RULES</div>
                <div className={styles.scroll}>
                  <RulesTree />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
          <PanelResizeHandle className={styles.bodyHandle} />
          <Panel defaultSize={78} minSize={30} className={styles.main}>
            <div className={styles.editor}><EditorArea /></div>
            <div className={styles.compare}><CompareToGrep /></div>
          </Panel>
        </PanelGroup>
      </div>
      {sharing && <ShareDialog onClose={() => setSharing(false)} />}
    </div>
  );
}
