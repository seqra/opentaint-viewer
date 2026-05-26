import { Info, ListOrdered } from 'lucide-react';
import { FindingInfo } from './FindingInfo';
import { StepsList } from './StepsList';
import { SplitTabsView, type PaneTab } from './SplitTabsView';
import { useStore, type InfoTab } from '../state/store';

/** Lower panel: the finding's report details (Info) and its taint path (Steps). */
export function InfoPanel() {
  const infoTab = useStore((s) => s.infoTab);
  const setInfoTab = useStore((s) => s.setInfoTab);
  const infoViewMode = useStore((s) => s.infoViewMode);
  const setInfoViewMode = useStore((s) => s.setInfoViewMode);

  const tabs: readonly [PaneTab, PaneTab] = [
    { id: 'info', label: 'Info', icon: <Info size={14} />, content: <FindingInfo />, testId: 'info-tab-info' },
    { id: 'steps', label: 'Steps', icon: <ListOrdered size={14} />, content: <StepsList />, testId: 'info-tab-steps' },
  ];

  return (
    <SplitTabsView
      tabs={tabs}
      activeId={infoTab}
      onSelect={(id) => setInfoTab(id as InfoTab)}
      split={infoViewMode === 'split'}
      onSetSplit={(s) => setInfoViewMode(s ? 'split' : 'tabs')}
      tablistLabel="Finding details"
      testId="info-panel"
      autoSaveId="ot-info"
      defaultSizes={[50, 50]}
    />
  );
}
