import { Star, Terminal } from 'lucide-react';
import { useTheme } from '../state/theme';
import logoLight from '../assets/opentaint-header-light.svg';
import logoDark from '../assets/opentaint-header-dark.svg';
import styles from './TopBar.module.css';

const SITE_URL = 'https://opentaint.org/';
const REPO_URL = 'https://github.com/seqra/opentaint';
const QUICKSTART_URL = 'https://github.com/seqra/opentaint#quick-start';

export function TopBar() {
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);

  return (
    <div className={styles.bar} data-testid="top-bar">
      <a className={styles.brand} href={SITE_URL} target="_blank" rel="noreferrer">
        <img
          className={styles.logo}
          src={theme === 'dark' ? logoDark : logoLight}
          alt="OpenTaint"
          width={141}
          height={26}
        />
      </a>
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
