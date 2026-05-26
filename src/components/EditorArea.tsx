import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Code, Scale, Square, Columns2 } from 'lucide-react';
import { useStore } from '../state/store';
import { CodeView } from './CodeView';
import { RulesView } from './RulesView';
import { Tabs, type TabItem } from './Tabs';
import type { EditorTab } from '../state/store';
import styles from './EditorArea.module.css';

const TABS: ReadonlyArray<TabItem> = [
  { id: 'code', label: 'Code', icon: <Code size={14} /> },
  { id: 'rules', label: 'Rules', icon: <Scale size={14} /> },
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
        <button
          type="button"
          className={styles.layoutToggle}
          data-testid="layout-toggle"
          title={split ? 'Switch to tabs view' : 'Switch to split view'}
          onClick={() => setViewMode(split ? 'tabs' : 'split')}
        >
          {split ? <Columns2 size={13} /> : <Square size={13} />}
          {split ? 'Split' : 'Tabs'}
        </button>
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
