import { useStore } from '../state/store';
import { CodeView } from './CodeView';
import { RulesView } from './RulesView';
import styles from './EditorArea.module.css';

export function EditorArea() {
  const viewMode = useStore((s) => s.viewMode);
  const activeTab = useStore((s) => s.activeTab);
  const setViewMode = useStore((s) => s.setViewMode);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const split = viewMode === 'split';

  return (
    <div className={styles.area} data-testid="editor-area">
      <div className={styles.head}>
        <button role="tab" aria-selected={activeTab === 'code'} className={`${styles.tab} ${activeTab === 'code' ? styles.active : ''}`} onClick={() => setActiveTab('code')}>⟨⟩ Code</button>
        <button role="tab" aria-selected={activeTab === 'rules'} className={`${styles.tab} ${activeTab === 'rules' ? styles.active : ''}`} onClick={() => setActiveTab('rules')}>⚖ Rules</button>
        <span className={styles.toggle}>
          <button className={`${styles.toggleBtn} ${!split ? styles.active : ''}`} onClick={() => setViewMode('tabs')}>⊟ tabs</button>
          <button className={`${styles.toggleBtn} ${split ? styles.active : ''}`} onClick={() => setViewMode('split')}>⊞ split</button>
        </span>
      </div>
      <div className={styles.panes}>
        {split ? (
          <>
            <div className={`${styles.pane} ${styles.code}`}><CodeView /></div>
            <div className={styles.pane}><RulesView /></div>
          </>
        ) : (
          <div className={styles.pane} style={{ flex: 1 }}>
            {activeTab === 'code' ? <CodeView /> : <RulesView />}
          </div>
        )}
      </div>
    </div>
  );
}
