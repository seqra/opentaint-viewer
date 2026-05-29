import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { CodeView } from './CodeView';
import { RulesView } from './RulesView';
import { FindingInfo } from './FindingInfo';
import { StepsList } from './StepsList';
import { TopBar } from './TopBar';
import { MobileDrawer } from './MobileDrawer';
import { MobileStepFooter } from './MobileStepFooter';
import styles from './MobileShell.module.css';

export function MobileShell() {
  const activeFindingId = useStore((s) => s.activeFindingId);
  const mobileTab = useStore((s) => s.mobileTab);
  const setMobileTab = useStore((s) => s.setMobileTab);
  const infoTab = useStore((s) => s.infoTab);
  const setInfoTab = useStore((s) => s.setInfoTab);

  // React to selection changes from outside the shell:
  //  - Drawer picks (Findings/Rules trees) → close the drawer + steer to Code/Rule.
  //  - Rule link taps (the ruleId button in FindingInfo, `rule:` refs in RulesView) →
  //    steer to the Rule tab so the user actually sees the rule they asked for.
  // selectRule bumps `ruleFocusTick` on every call, so it's the right user-action signal
  // even when the same rule is re-selected.
  const lastSelectionRef = useRef<{ findingId: string | null; ruleId: string | null; ruleFocusTick: number }>({
    findingId: activeFindingId,
    ruleId: useStore.getState().activeRuleId,
    ruleFocusTick: useStore.getState().ruleFocusTick,
  });
  useEffect(() => useStore.subscribe((s) => {
    const prev = lastSelectionRef.current;
    const fChanged = s.activeFindingId !== prev.findingId;
    const rChanged = s.activeRuleId !== prev.ruleId;
    const ruleTickChanged = s.ruleFocusTick !== prev.ruleFocusTick;
    lastSelectionRef.current = {
      findingId: s.activeFindingId,
      ruleId: s.activeRuleId,
      ruleFocusTick: s.ruleFocusTick,
    };
    if ((fChanged || rChanged) && s.sidebarView !== null) {
      s.setSidebarView(null);
      s.setMobileTab(fChanged ? 'code' : 'rule');
      return;
    }
    if (ruleTickChanged) {
      s.setMobileTab('rule');
    }
  }), []);

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
