import { useStore } from '../state/store';
import styles from './TopBar.module.css';

const INSTALL_URL = 'https://opentaint.org/#install';

export function TopBar({ onShare }: { onShare: () => void }) {
  const content = useStore((s) => s.content);
  const scenarioId = useStore((s) => s.scenarioId);
  const selectScenario = useStore((s) => s.selectScenario);
  if (!content) return null;

  return (
    <div className={styles.bar} data-testid="top-bar">
      <span className={styles.brand}>OpenTaint Playground</span>
      <select
        className={styles.select}
        aria-label="Example"
        value={scenarioId ?? ''}
        onChange={(e) => selectScenario(e.target.value)}
      >
        {content.scenarios.map((s) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>
      <span className={styles.grow} />
      <button className={styles.share} onClick={onShare}>🔗 Share</button>
      <a className={styles.cta} href={INSTALL_URL} target="_blank" rel="noreferrer">Install the CLI →</a>
    </div>
  );
}
