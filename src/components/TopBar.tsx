import { Menu, Star, Terminal } from 'lucide-react';
import { useTheme } from '../state/theme';
import { useStore } from '../state/store';
import logoLight from '../assets/opentaint-header-light.svg';
import logoDark from '../assets/opentaint-header-dark.svg';
import styles from './TopBar.module.css';

const SITE_URL = 'https://opentaint.org/';
const REPO_URL = 'https://github.com/seqra/opentaint';
const QUICKSTART_URL = 'https://github.com/seqra/opentaint#quick-start';

export function TopBar() {
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const tool = useStore((s) => s.content?.tool);
  const sidebarView = useStore((s) => s.sidebarView);
  const setSidebarView = useStore((s) => s.setSidebarView);
  // Show both the semver and the build version (calver+hash) when both are present.
  // The leading `analyzer/` is namespacing noise — strip it for display but keep the full
  // string in the tooltip title for fidelity.
  const semver = tool?.semanticVersion ? `v${tool.semanticVersion}` : null;
  const buildVer = tool?.version ? tool.version.replace(/^analyzer\//, '') : null;
  const label = [semver, buildVer].filter(Boolean).join(' · ');

  // The ☰ button always opens the drawer (never toggles it shut) — close is via scrim, ✕, Escape.
  const openDrawer = () => setSidebarView(sidebarView ?? 'findings');

  return (
    <div className={styles.bar} data-testid="top-bar">
      <button
        type="button"
        className={styles.menuBtn}
        onClick={openDrawer}
        aria-label="Open menu"
        data-testid="top-bar-menu"
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      <a className={styles.brand} href={SITE_URL} target="_blank" rel="noreferrer">
        <img
          className={styles.logo}
          src={theme === 'dark' ? logoDark : logoLight}
          alt="OpenTaint"
          width={141}
          height={26}
        />
      </a>
      {label && (
        <span
          className={styles.version}
          data-testid="tool-version"
          title={`${tool?.name ?? ''}${tool?.version ? ' ' + tool.version : ''}`.trim()}
        >
          {label}
        </span>
      )}
      <span className={styles.grow} />
      <button
        className={styles.pill}
        aria-label="Toggle theme"
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <a className={styles.star} href={REPO_URL} target="_blank" rel="noreferrer">
        <Star size={14} aria-hidden="true" /> Star
      </a>
      <a className={styles.cta} href={QUICKSTART_URL} target="_blank" rel="noreferrer">
        <Terminal size={14} aria-hidden="true" /> Install
      </a>
    </div>
  );
}
