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

  // Auto-close the drawer when the user picks a tree node. We watch every store
  // mutation; when a click was just dispatched from inside the drawer's tree body,
  // a setState arrives and we close. This handles the case where the user reselects
  // the already-active finding (no field value changes, so id-delta detection alone
  // would miss it).
  const drawerClickRef = useRef<{ kind: 'findings' | 'rules' } | null>(null);
  const lastSelectionRef = useRef<{ findingId: string | null; ruleId: string | null }>({
    findingId: activeFindingId,
    ruleId: useStore.getState().activeRuleId,
  });
  useEffect(() => useStore.subscribe((s) => {
    const prev = lastSelectionRef.current;
    const fChanged = s.activeFindingId !== prev.findingId;
    const rChanged = s.activeRuleId !== prev.ruleId;
    lastSelectionRef.current = { findingId: s.activeFindingId, ruleId: s.activeRuleId };
    const fromClick = drawerClickRef.current;
    drawerClickRef.current = null;
    if (s.sidebarView === null) return;
    if (fChanged || rChanged) {
      s.setSidebarView(null);
      s.setMobileTab(fChanged ? 'code' : 'rule');
    } else if (fromClick) {
      s.setSidebarView(null);
      s.setMobileTab(fromClick.kind === 'findings' ? 'code' : 'rule');
    }
  }), []);

  // Mark clicks that originate inside a drawer tree so the subscribe handler can
  // distinguish "user reselected the active node" from other setState calls.
  const onShellClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const drawer = target.closest('[data-testid="mobile-drawer"]');
    if (!drawer) return;
    const findingsTree = target.closest('[data-testid="findings-tree"]');
    const rulesTree = target.closest('[data-testid="rules-tree"]');
    if (findingsTree) drawerClickRef.current = { kind: 'findings' };
    else if (rulesTree) drawerClickRef.current = { kind: 'rules' };
  };

  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  const contextLabel = finding ? `${finding.vulnClass} — ${finding.location ?? ''}` : '';

  const tabs: Array<{ id: 'code' | 'details' | 'rule'; label: string }> = [
    { id: 'code', label: 'Code' },
    { id: 'details', label: 'Details' },
    { id: 'rule', label: 'Rule' },
  ];

  return (
    <div className={styles.shell} data-testid="mobile-shell" onClickCapture={onShellClick}>
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
