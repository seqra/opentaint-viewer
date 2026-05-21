import { useState } from 'react';
import { useStore } from '../state/store';
import { encodeViewState, type ViewState } from '../state/permalink';
import styles from './ShareDialog.module.css';

function currentViewState(): ViewState {
  const s = useStore.getState();
  return {
    scenarioId: s.scenarioId, findingId: s.activeFindingId, stepIndex: s.activeStepIndex,
    file: s.activeFile, ruleId: s.activeRuleId, viewMode: s.viewMode, activeTab: s.activeTab,
  };
}

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const url = `${location.origin}${location.pathname}#${encodeViewState(currentViewState())}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <h3>Share this view</h3>
        <input className={styles.url} data-testid="share-url" readOnly value={url} />
        <div className={styles.row}>
          <button className={styles.btn} onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
          <button className={styles.close} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
