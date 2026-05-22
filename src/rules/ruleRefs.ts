/** A `rule: <path>.yaml#<anchor>` cross-reference found inside a rule file. */
export interface RuleRef {
  /** 1-based line. */
  line: number;
  /** 1-based start column of the reference token (inclusive). */
  startColumn: number;
  /** 1-based end column of the reference token (exclusive, Monaco-style). */
  endColumn: number;
  /** Referenced rule file path. */
  path: string;
  /** Referenced rule id within that file, or null when no `#fragment` is given. */
  anchor: string | null;
}

/** URI scheme used for in-editor rule cross-reference links. */
export const RULE_REF_SCHEME = 'rule-ref';

const REF = /\brule:\s*([^\s#]+\.yaml)(?:#(\S+))?/g;

/**
 * Locate every `rule:` cross-reference in a rule file's YAML so the editor can
 * turn them into links. A rule references another by file path plus an optional
 * `#<rule-id>` fragment; we return the span of the whole token for highlighting.
 */
export function ruleRefs(content: string): RuleRef[] {
  const refs: RuleRef[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    REF.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = REF.exec(line)) !== null) {
      const path = m[1];
      const anchor = m[2] ?? null;
      const token = anchor ? `${path}#${anchor}` : path;
      const start = m.index + m[0].indexOf(path);
      refs.push({ line: i + 1, startColumn: start + 1, endColumn: start + token.length + 1, path, anchor });
    }
  }
  return refs;
}

/**
 * Decode a clicked link URI into the rule to open, or null when it isn't one of
 * ours (e.g. a plain http URL the editor also detects). The fragment carries the
 * referenced rule id so the target file scrolls to the right rule.
 */
export function ruleRefTarget(scheme: string, path: string, fragment: string): { path: string; anchor: string | null } | null {
  if (scheme !== RULE_REF_SCHEME) return null;
  return { path: path.replace(/^\//, ''), anchor: fragment || null };
}
