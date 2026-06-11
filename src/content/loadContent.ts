import { bundledContent } from './bundledContent';
import { isViewerContent } from '../types/content';
import type { Finding, ViewerContent, ProjectFile, RuleOrigin, RuleSpec, TaintStep } from '../types/content';

/** Content injected by the CLI into the prebuilt template, if present. */
function injectedContent(): unknown {
  if (typeof document === 'undefined') return undefined;
  const el = document.getElementById('opentaint-content');
  if (!el?.textContent) return undefined;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return undefined;
  }
}

export function loadContent(): ViewerContent {
  const raw = injectedContent() ?? bundledContent;
  if (!isViewerContent(raw)) throw new Error('Viewer content failed schema validation');
  return raw;
}

export function findingById(c: ViewerContent, id: string): Finding | undefined {
  return c.findings.find((f) => f.id === id);
}

export function fileByPath(c: ViewerContent, path: string): ProjectFile | undefined {
  return c.files.find((f) => f.path === path);
}

/** Steps of a finding's flow, clamping the index into range. */
export function flowSteps(f: Finding, flowIndex: number): TaintStep[] {
  const i = Math.min(f.flows.length - 1, Math.max(0, flowIndex));
  return f.flows[i]?.steps ?? [];
}

export function rulesByOrigin(c: ViewerContent): Record<RuleOrigin, RuleSpec[]> {
  return {
    builtin: c.rules.filter((r) => r.origin === 'builtin'),
    custom: c.rules.filter((r) => r.origin === 'custom'),
  };
}
