import raw from './java-spring-demo.json';
import { isPlaygroundContent } from '../types/content';
import type { Finding, PlaygroundContent, ProjectFile, RuleOrigin, RuleSpec } from '../types/content';

export function loadContent(): PlaygroundContent {
  if (!isPlaygroundContent(raw)) throw new Error('Bundled content is invalid');
  return raw;
}

export function findingById(c: PlaygroundContent, id: string): Finding | undefined {
  return c.findings.find((f) => f.id === id);
}

export function fileByPath(c: PlaygroundContent, path: string): ProjectFile | undefined {
  return c.files.find((f) => f.path === path);
}

export function rulesByOrigin(c: PlaygroundContent): Record<RuleOrigin, RuleSpec[]> {
  return {
    builtin: c.rules.filter((r) => r.origin === 'builtin'),
    custom: c.rules.filter((r) => r.origin === 'custom'),
  };
}
