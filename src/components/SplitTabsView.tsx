import type { ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Square, Columns2 } from 'lucide-react';
import { Tabs, type TabItem } from './Tabs';
import styles from './SplitTabsView.module.css';

export interface PaneTab {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
  /** Optional test id forwarded to the tab button. */
  testId?: string;
}

interface SplitTabsViewProps {
  /** The two panes (left, right). */
  tabs: readonly [PaneTab, PaneTab];
  activeId: string;
  onSelect: (id: string) => void;
  /** Whether both panes are shown side by side (true) or one tabbed pane (false). */
  split: boolean;
  onSetSplit: (split: boolean) => void;
  tablistLabel: string;
  /** data-testid for the container. */
  testId: string;
  /** Persists the split sizes per area. */
  autoSaveId: string;
  defaultSizes?: readonly [number, number];
}

/**
 * A two-pane area that toggles between a tabbed view (one pane at a time) and a
 * split view (both panes side by side), via a single layout-toggle button.
 * Shared by the editor (Code/Rules) and the info panel (Info/Steps) — same shape.
 */
export function SplitTabsView({
  tabs,
  activeId,
  onSelect,
  split,
  onSetSplit,
  tablistLabel,
  testId,
  autoSaveId,
  defaultSizes = [50, 50],
}: SplitTabsViewProps) {
  const tabItems: TabItem[] = tabs.map(({ id, label, icon, testId }) => ({ id, label, icon, testId }));
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className={styles.area} data-testid={testId}>
      <div className={styles.head}>
        {!split && (
          <Tabs items={tabItems} active={activeId} onSelect={onSelect} ariaLabel={tablistLabel} />
        )}
        <button
          type="button"
          className={styles.layoutToggle}
          data-testid="layout-toggle"
          title={split ? 'Switch to tabs view' : 'Switch to split view'}
          onClick={() => onSetSplit(!split)}
        >
          {split ? <Columns2 size={13} /> : <Square size={13} />}
          {split ? 'Split' : 'Tabs'}
        </button>
      </div>
      <div className={styles.panes}>
        {split ? (
          <PanelGroup direction="horizontal" autoSaveId={autoSaveId}>
            <Panel defaultSize={defaultSizes[0]} minSize={20} className={styles.pane}>
              {tabs[0].content}
            </Panel>
            <PanelResizeHandle className={styles.hHandle} />
            <Panel defaultSize={defaultSizes[1]} minSize={20} className={styles.pane}>
              {tabs[1].content}
            </Panel>
          </PanelGroup>
        ) : (
          <div className={styles.pane} style={{ flex: 1 }}>
            {active.content}
          </div>
        )}
      </div>
    </div>
  );
}
