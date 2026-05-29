import { useEffect } from 'react';
import { ShieldAlert, Scale } from 'lucide-react';
import { useStore } from '../state/store';
import { useTheme } from '../state/theme';
import { FindingsTree } from './FindingsTree';
import { RulesTree } from './RulesTree';
import styles from './MobileDrawer.module.css';

export function MobileDrawer() {
  const view = useStore((s) => s.sidebarView);
  const setSidebarView = useStore((s) => s.setSidebarView);
  const tool = useStore((s) => s.content?.tool);
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);

  // Close on Escape while the drawer is open. Per the spec, Escape is a close trigger
  // alongside scrim tap, ✕ tap, and tree-node selection.
  useEffect(() => {
    if (!view) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSidebarView(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, setSidebarView]);

  if (!view) return null;

  const semver = tool?.semanticVersion ? `v${tool.semanticVersion}` : null;
  const buildVer = tool?.version ? tool.version.replace(/^analyzer\//, '') : null;
  const versionLabel = [semver, buildVer].filter(Boolean).join(' · ');

  const close = () => setSidebarView(null);

  return (
    <>
      <div
        className={styles.scrim}
        data-testid="mobile-drawer-scrim"
        onClick={close}
        aria-hidden="true"
      />
      <div className={styles.drawer} data-testid="mobile-drawer" role="dialog" aria-label="Browse">
        <div className={styles.head}>
          <span>Browse</span>
          <button
            type="button"
            className={styles.close}
            onClick={close}
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Tree view">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'findings'}
            className={`${styles.tab} ${view === 'findings' ? styles.active : ''}`}
            onClick={() => setSidebarView('findings')}
          >
            <ShieldAlert size={14} /> Findings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'rules'}
            className={`${styles.tab} ${view === 'rules' ? styles.active : ''}`}
            onClick={() => setSidebarView('rules')}
          >
            <Scale size={14} /> Rules
          </button>
        </div>
        <div className={styles.body}>
          {view === 'findings' ? <FindingsTree /> : <RulesTree />}
        </div>
        <div className={styles.foot}>
          <button
            type="button"
            className={styles.themeBtn}
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          {versionLabel && <span className={styles.version}>{versionLabel}</span>}
        </div>
      </div>
    </>
  );
}
