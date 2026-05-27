import { useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';
import { TopBar } from './TopBar';
import { FindingsTree } from './FindingsTree';
import { RulesTree } from './RulesTree';
import { EditorArea } from './EditorArea';
import { InfoPanel } from './InfoPanel';
import { ActivityBar } from './ActivityBar';
import { useStepKeys } from './useStepKeys';
import { useStore } from '../state/store';
import { useTheme } from '../state/theme';
import styles from './AppShell.module.css';

export function AppShell() {
  const view = useStore((s) => s.sidebarView);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const setSidebarView = useStore((s) => s.setSidebarView);
  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const theme = useTheme((s) => s.theme);
  useStepKeys();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Keep the resizable panel's collapsed/expanded state in sync with the active view.
  useEffect(() => {
    const panel = sidebarRef.current;
    if (!panel) return;
    if (view === null) panel.collapse();
    else if (panel.isCollapsed()) panel.expand();
  }, [view]);

  return (
    <div className={styles.shell}>
      <TopBar />
      <div className={styles.body}>
        <ActivityBar active={view} onSelect={toggleSidebar} />
        <PanelGroup direction="horizontal" autoSaveId="ot-body" className={styles.panels}>
          <Panel
            ref={sidebarRef}
            collapsible
            collapsedSize={0}
            defaultSize={22}
            minSize={12}
            maxSize={45}
            className={styles.sidebar}
            onCollapse={() => setSidebarView(null)}
          >
            {view && (
              <div className={styles.sidePanel}>
                <div className={styles.shead}>{view === 'findings' ? 'FINDINGS' : 'RULES'}</div>
                <div className={styles.scroll}>{view === 'findings' ? <FindingsTree /> : <RulesTree />}</div>
              </div>
            )}
          </Panel>
          <PanelResizeHandle className={styles.bodyHandle} style={{ display: view ? undefined : 'none' }} />
          <Panel defaultSize={78} minSize={30} className={styles.main}>
            <PanelGroup direction="vertical" autoSaveId="ot-main">
              <Panel defaultSize={68} minSize={20} className={styles.mainPane}>
                <EditorArea />
              </Panel>
              <PanelResizeHandle className={styles.vHandle} />
              <Panel defaultSize={32} minSize={10} className={styles.mainPane}>
                <InfoPanel />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
