import type { EditorTab, ViewMode } from './store';

export interface ViewState {
  scenarioId: string | null;
  findingId: string | null;
  stepIndex: number | null;
  file: string | null;
  ruleId: string | null;
  viewMode: ViewMode;
  activeTab: EditorTab;
}

export function encodeViewState(v: ViewState): string {
  const json = JSON.stringify(v);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const isStringOrNull = (x: unknown): boolean => x === null || typeof x === 'string';
const isNumberOrNull = (x: unknown): boolean => x === null || typeof x === 'number';

export function decodeViewState(s: string): ViewState | null {
  if (!s) return null;
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    const v = JSON.parse(json) as ViewState;
    if (typeof v !== 'object' || v === null) return null;
    if (v.viewMode !== 'tabs' && v.viewMode !== 'split') return null;
    if (v.activeTab !== 'code' && v.activeTab !== 'rules') return null;
    if (!isStringOrNull(v.scenarioId)) return null;
    if (!isStringOrNull(v.findingId)) return null;
    if (!isNumberOrNull(v.stepIndex)) return null;
    if (!isStringOrNull(v.file)) return null;
    if (!isStringOrNull(v.ruleId)) return null;
    return v;
  } catch {
    return null;
  }
}
