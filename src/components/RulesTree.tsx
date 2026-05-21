import { useStore } from '../state/store';
import { keyActivate } from './keyActivate';
import { rulesByOrigin } from '../content/loadContent';
import type { RuleKind, RuleOrigin, RuleSpec } from '../types/content';
import styles from './RulesTree.module.css';

const KIND_LABELS: Record<RuleKind, string> = {
  rule: 'Rules',
  passthrough: 'Passthrough approximations',
  dataflow: 'Dataflow approximations',
};
const KIND_ORDER: RuleKind[] = ['rule', 'passthrough', 'dataflow'];
const ORIGIN_ORDER: RuleOrigin[] = ['builtin', 'custom'];
const ORIGIN_LABELS: Record<RuleOrigin, string> = { builtin: '📁 Builtin', custom: '📁 Custom' };

export function RulesTree() {
  const content = useStore((s) => s.content);
  const activeRuleId = useStore((s) => s.activeRuleId);
  const selectRule = useStore((s) => s.selectRule);
  if (!content) return null;
  const grouped = rulesByOrigin(content);

  return (
    <div className={styles.tree} data-testid="rules-tree">
      {ORIGIN_ORDER.map((origin) => (
        <div key={origin}>
          <div className={styles.origin}>{ORIGIN_LABELS[origin]}</div>
          {KIND_ORDER.map((kind) => {
            const specs = grouped[origin].filter((r: RuleSpec) => r.kind === kind);
            return (
              <div key={kind}>
                <div className={styles.kind}>
                  {KIND_LABELS[kind]}{' '}
                  {specs.length === 0 && <span className={styles.empty}>empty</span>}
                </div>
                {specs.map((r) => (
                  <div
                    key={r.id}
                    className={`${styles.leaf} ${activeRuleId === r.id ? styles.active : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectRule(r.id)}
                    onKeyDown={keyActivate(() => selectRule(r.id))}
                  >
                    ⚖ {r.path.split('/').pop()}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
