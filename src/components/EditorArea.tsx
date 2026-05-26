import { Code, Scale } from 'lucide-react';
import { useStore } from '../state/store';
import { CodeView } from './CodeView';
import { RulesView } from './RulesView';
import { SplitTabsView, type PaneTab } from './SplitTabsView';
import type { EditorTab } from '../state/store';

export function EditorArea() {
  const viewMode = useStore((s) => s.viewMode);
  const activeTab = useStore((s) => s.activeTab);
  const setViewMode = useStore((s) => s.setViewMode);
  const setActiveTab = useStore((s) => s.setActiveTab);

  const tabs: readonly [PaneTab, PaneTab] = [
    { id: 'code', label: 'Code', icon: <Code size={14} />, content: <CodeView /> },
    { id: 'rules', label: 'Rules', icon: <Scale size={14} />, content: <RulesView /> },
  ];

  return (
    <SplitTabsView
      tabs={tabs}
      activeId={activeTab}
      onSelect={(id) => setActiveTab(id as EditorTab)}
      split={viewMode === 'split'}
      onSetSplit={(s) => setViewMode(s ? 'split' : 'tabs')}
      tablistLabel="Editor view"
      testId="editor-area"
      autoSaveId="ot-editor"
      defaultSizes={[58, 42]}
    />
  );
}
