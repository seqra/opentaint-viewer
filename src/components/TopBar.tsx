import { useRef, useState } from 'react';
import { useTheme } from '../state/theme';
import styles from './TopBar.module.css';

const INSTALL_CMD = 'curl -fsSL https://opentaint.org/install.sh | bash';
const SITE_URL = 'https://opentaint.org/';

type CopyStatus = 'idle' | 'copied' | 'failed';

export function TopBar({ onShare }: { onShare: () => void }) {
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const [status, setStatus] = useState<CopyStatus>('idle');
  const cmdRef = useRef<HTMLElement>(null);

  // Fallback when the clipboard API is unavailable (non-secure context / older browser):
  // select the command text so the user can copy it manually. Must never throw.
  const selectCommand = () => {
    try {
      const el = cmdRef.current;
      const selection = window.getSelection?.();
      if (!el || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      /* selection unsupported */
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 1500);
    } catch {
      selectCommand();
      setStatus('failed');
    }
  };

  const copyLabel =
    status === 'copied'
      ? 'Copied!'
      : status === 'failed'
        ? 'Copy failed — select and copy manually'
        : 'Copy install command';

  return (
    <div className={styles.bar} data-testid="top-bar">
      <a className={styles.brand} href={SITE_URL} target="_blank" rel="noreferrer">
        <span className={styles.dot} aria-hidden="true">●</span> opentaint
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
      <button className={styles.pill} onClick={onShare}>share</button>
      <div className={styles.install}>
        <code ref={cmdRef} className={styles.cmd}>{INSTALL_CMD}</code>
        <button
          className={styles.copy}
          aria-label={copyLabel}
          title={copyLabel}
          onClick={copy}
        >
          {status === 'copied' ? '✓' : status === 'failed' ? '✗' : '⧉'}
        </button>
      </div>
    </div>
  );
}
