import styles from './ActivityBar.module.css';

export type SidebarView = 'findings' | 'rules';

/** Clicking the open view collapses the sidebar; clicking any other switches to it. */
export function toggleSidebarView(current: SidebarView | null, clicked: SidebarView): SidebarView | null {
  return current === clicked ? null : clicked;
}

const ITEMS: ReadonlyArray<{ view: SidebarView; glyph: string; label: string }> = [
  { view: 'findings', glyph: '⚠', label: 'Findings' },
  { view: 'rules', glyph: '⚖', label: 'Rules' },
];

interface Props {
  active: SidebarView | null;
  onSelect: (view: SidebarView) => void;
}

/** VS Code-style activity bar: one mutually-exclusive button per sidebar view. */
export function ActivityBar({ active, onSelect }: Props) {
  return (
    <div className={styles.bar} role="tablist" aria-orientation="vertical" data-testid="activity-bar">
      {ITEMS.map(({ view, glyph, label }) => (
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={active === view}
          aria-label={label}
          title={label}
          className={`${styles.btn} ${active === view ? styles.active : ''}`}
          onClick={() => onSelect(view)}
          data-testid={`activity-${view}`}
        >
          <span className={styles.glyph} aria-hidden="true">{glyph}</span>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </div>
  );
}
