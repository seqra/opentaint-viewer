import raw from './java-spring-demo.json';
import { isViewerContent } from '../types/content';
import type { Finding, ViewerContent, ProjectFile, RuleOrigin, RuleSpec, TaintStep } from '../types/content';

export function loadContent(): ViewerContent {
  if (!isViewerContent(raw)) throw new Error('Bundled content is invalid');
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
