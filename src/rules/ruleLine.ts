/** Strip opentaint's `java.<area>.` namespace prefix to the bare rule id. */
export function bareRuleId(ruleId: string): string {
  return ruleId.replace(/^java\.[a-z]+\./, '');
}

/**
 * 1-based line where `ruleId` is declared (`id: <rule>`) inside a rule file's
 * YAML, or null if it is not declared there. A file holds many rules, so this
 * lets the editor scroll to the one a finding actually triggered. Matches the
 * bare id or the full namespaced id, requiring an exact token (not a prefix).
 */
export function findRuleLine(content: string, ruleId: string): number | null {
  const bare = bareRuleId(ruleId);
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\bid:\s*([A-Za-z0-9._-]+)/);
    if (m && (m[1] === bare || m[1] === ruleId)) return i + 1;
  }
  return null;
}
