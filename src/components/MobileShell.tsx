import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { findingById } from '../content/loadContent';
import { CodeView } from './CodeView';
import { RulesView } from './RulesView';
import { FindingInfo } from './FindingInfo';
import { StepsList } from './StepsList';
import { TopBar } from './TopBar';
import { MobileDrawer } from './MobileDrawer';
import { MobileStepFooter } from './MobileStepFooter';
import styles from './MobileShell.module.css';

export function MobileShell() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const mobileTab = useStore((s) => s.mobileTab);
  const setMobileTab = useStore((s) => s.setMobileTab);
  const infoTab = useStore((s) => s.infoTab);
  const setInfoTab = useStore((s) => s.setInfoTab);

  // Auto-close the drawer when the user picks a tree node. The trees mutate the
  // store directly (selectFinding / selectRule), so we react to those changes here
  // rather than threading callbacks through the tree components.
  const lastSelectionRef = useRef<{ findingId: string | null; ruleId: string | null }>({
    findingId: activeFindingId,
    ruleId: useStore.getState().activeRuleId,
  });
  useEffect(() => useStore.subscribe((s) => {
    const prev = lastSelectionRef.current;
    const fChanged = s.activeFindingId !== prev.findingId;
    const rChanged = s.activeRuleId !== prev.ruleId;
    lastSelectionRef.current = { findingId: s.activeFindingId, ruleId: s.activeRuleId };
    // The initial loadContent flips activeFindingId from null to a real id. That's
    // the app booting, not a user picking a finding — don't slam the sidebar shut.
    const initialLoad = (fChanged && prev.findingId === null) || (rChanged && prev.ruleId === null);
    if ((fChanged || rChanged) && !initialLoad && s.sidebarView !== null) {
      s.setSidebarView(null);
      s.setMobileTab(fChanged ? 'code' : 'rule');
    }
  }), []);

  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  const contextLabel = finding ? `${finding.vulnClass} — ${finding.location ?? ''}` : '';

  const tabs: Array<{ id: 'code' | 'details' | 'rule'; label: string }> = [
    { id: 'code', label: 'Code' },
    { id: 'details', label: 'Details' },
    { id: 'rule', label: 'Rule' },
  ];

  return (
    <div className={styles.shell} data-testid="mobile-shell">
      <TopBar />
      <div className={styles.tabs} role="tablist" aria-label="Mobile view" data-testid="mobile-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mobileTab === t.id}
            data-testid={`mobile-tab-${t.id}`}
            className={`${styles.tab} ${mobileTab === t.id ? styles.active : ''}`}
            onClick={() => setMobileTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {contextLabel && (
        <div className={styles.context} data-testid="mobile-context-strip">
          <strong>{finding!.vulnClass}</strong>{finding?.location ? ` — ${finding.location}` : ''}
        </div>
      )}
      <div className={styles.content}>
        {mobileTab === 'code' && (
          <div className={styles.pane}><CodeView /></div>
        )}
        {mobileTab === 'details' && (
          <>
            <div className={styles.subTabs} role="tablist" aria-label="Finding details">
              <button
                type="button"
                role="tab"
                aria-selected={infoTab === 'info'}
                data-testid="info-tab-info"
                className={`${styles.subTab} ${infoTab === 'info' ? styles.active : ''}`}
                onClick={() => setInfoTab('info')}
              >
                Info
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={infoTab === 'steps'}
                data-testid="info-tab-steps"
                className={`${styles.subTab} ${infoTab === 'steps' ? styles.active : ''}`}
                onClick={() => setInfoTab('steps')}
              >
                Steps
              </button>
            </div>
            <div className={styles.pane}>
              {infoTab === 'info' ? <FindingInfo /> : <StepsList />}
            </div>
          </>
        )}
        {mobileTab === 'rule' && (
          <div className={styles.pane}><RulesView /></div>
        )}
      </div>
      <MobileStepFooter />
      <MobileDrawer />
    </div>
  );
}
