import { useStore } from './store';
import { decodeViewState } from './permalink';

export function hydrateFromHash(hash: string): void {
  const v = decodeViewState(hash.replace(/^#/, ''));
  if (!v) return;
  const store = useStore.getState();
  if (v.scenarioId) store.selectScenario(v.scenarioId);
  if (v.findingId && v.stepIndex != null) store.selectStep(v.findingId, v.stepIndex);
  if (v.file) store.selectFile(v.file);
  if (v.ruleId) store.selectRule(v.ruleId);
  store.setViewMode(v.viewMode);
  store.setActiveTab(v.activeTab);
}
