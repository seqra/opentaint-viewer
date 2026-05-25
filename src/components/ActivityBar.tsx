import { Tabs, type TabItem } from './Tabs';
import type { SidebarView } from '../state/store';

const ITEMS: ReadonlyArray<TabItem> = [
  { id: 'findings', label: 'Findings', icon: '⚠', testId: 'activity-findings' },
  { id: 'rules', label: 'Rules', icon: '⚖', testId: 'activity-rules' },
];

interface Props {
  active: SidebarView | null;
  onSelect: (view: SidebarView) => void;
}

/** VS Code-style activity bar: one mutually-exclusive button per sidebar view. */
export function ActivityBar({ active, onSelect }: Props) {
  return (
    <Tabs
      orientation="vertical"
      ariaLabel="Sidebar views"
      items={ITEMS}
      active={active}
      onSelect={(id) => onSelect(id as SidebarView)}
    />
  );
}
