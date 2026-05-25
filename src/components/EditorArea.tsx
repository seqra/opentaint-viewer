import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useStore } from '../state/store';
import { CodeView } from './CodeView';
import { RulesView } from './RulesView';
import { Tabs, type TabItem } from './Tabs';
import type { EditorTab } from '../state/store';
import styles from './EditorArea.module.css';

const TABS: ReadonlyArray<TabItem> = [
  { id: 'code', label: '⟨⟩ Code' },
  { id: 'rules', label: '⚖ Rules' },
];

export function EditorArea() {
  const viewMode = useStore((s) => s.viewMode);
  const activeTab = useStore((s) => s.activeTab);
  const setViewMode = useStore((s) => s.setViewMode);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const split = viewMode === 'split';

  return (
    <div className={styles.area} data-testid="editor-area">
      <div className={styles.head}>
        {!split && (
          <Tabs items={TABS} active={activeTab} onSelect={(id) => setActiveTab(id as EditorTab)} ariaLabel="Editor view" />
        )}
        <span className={styles.toggle}>
          <button className={`${styles.toggleBtn} ${!split ? styles.active : ''}`} onClick={() => setViewMode('tabs')}>⊟ tabs</button>
          <button className={`${styles.toggleBtn} ${split ? styles.active : ''}`} onClick={() => setViewMode('split')}>⊞ split</button>
        </span>
      </div>
      <div className={styles.panes}>
        {split ? (
          <PanelGroup direction="horizontal" autoSaveId="ot-editor">
            <Panel defaultSize={58} minSize={20} className={styles.pane}>
              <CodeView />
            </Panel>
            <PanelResizeHandle className={styles.hHandle} />
            <Panel defaultSize={42} minSize={20} className={styles.pane}>
              <RulesView />
            </Panel>
          </PanelGroup>
        ) : (
          <div className={styles.pane} style={{ flex: 1 }}>
            {activeTab === 'code' ? <CodeView /> : <RulesView />}
          </div>
        )}
      </div>
    </div>
  );
}
