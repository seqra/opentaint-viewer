import type { ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
  /** Optional glyph shown above the label (used by the vertical activity rail). */
  icon?: ReactNode;
  testId?: string;
}

interface TabsProps {
  items: ReadonlyArray<TabItem>;
  /** Active tab id, or null when none is selected (e.g. a collapsed sidebar). */
  active: string | null;
  onSelect: (id: string) => void;
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  /** Extra chrome (background/border) supplied by the host bar. */
  className?: string;
}

/** Accessible tab strip — horizontal text tabs or a vertical icon rail. */
export function Tabs({ items, active, onSelect, orientation = 'horizontal', ariaLabel, className }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      aria-label={ariaLabel}
      className={`${styles.tabs} ${styles[orientation]} ${className ?? ''}`}
    >
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          aria-label={t.label}
          title={t.label}
          className={`${styles.tab} ${active === t.id ? styles.active : ''}`}
          onClick={() => onSelect(t.id)}
          data-testid={t.testId}
        >
          {t.icon != null && <span className={styles.icon} aria-hidden="true">{t.icon}</span>}
          <span className={styles.label}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
