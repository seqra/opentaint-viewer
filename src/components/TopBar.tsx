import { useTheme } from '../state/theme';
import styles from './TopBar.module.css';

const INSTALL_URL = 'https://opentaint.org/#install';

export function TopBar({ onShare }: { onShare: () => void }) {
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  return (
    <div className={styles.bar} data-testid="top-bar">
      <span className={styles.brand}>OpenTaint Playground</span>
      <span className={styles.grow} />
      <button
        className={styles.share}
        aria-label="Toggle theme"
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <button className={styles.share} onClick={onShare}>🔗 Share</button>
      <a className={styles.cta} href={INSTALL_URL} target="_blank" rel="noreferrer">
        Install the CLI →
      </a>
    </div>
  );
}
