import { Tabs, type TabItem } from './Tabs';

export type SidebarView = 'findings' | 'rules';

/** Clicking the open view collapses the sidebar; clicking any other switches to it. */
export function toggleSidebarView(current: SidebarView | null, clicked: SidebarView): SidebarView | null {
  return current === clicked ? null : clicked;
}

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
