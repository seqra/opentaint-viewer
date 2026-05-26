import { Folder, FileText } from 'lucide-react';
import { useStore } from '../state/store';
import { keyActivate } from './keyActivate';
import { rulesByOrigin } from '../content/loadContent';
import { buildPathTree } from '../util/tree';
import { basename, dirname } from '../util/path';
import { DirTree, indent, useCollapsibleSet } from './treeView';
import type { RuleOrigin, RuleSpec } from '../types/content';
import styles from './RulesTree.module.css';

const ORIGIN_ORDER: RuleOrigin[] = ['builtin', 'custom'];
const ORIGIN_LABELS: Record<RuleOrigin, string> = { builtin: 'Builtin', custom: 'Custom' };

export function RulesTree() {
  const content = useStore((s) => s.content);
  const activeRuleId = useStore((s) => s.activeRuleId);
  const selectRule = useStore((s) => s.selectRule);
  const { collapsed, toggle } = useCollapsibleSet();
  if (!content) return null;
  const grouped = rulesByOrigin(content);

  const renderRules = (rules: RuleSpec[], depth: number) =>
    rules.map((rule) => (
      <div
        key={rule.id}
        className={`${styles.leaf} ${activeRuleId === rule.id ? styles.active : ''}`}
        style={indent(depth)}
        role="button"
        tabIndex={0}
        onClick={() => selectRule(rule.id)}
        onKeyDown={keyActivate(() => selectRule(rule.id))}
      >
        <FileText size={13} style={{ verticalAlign: -2 }} /> {basename(rule.path)}
      </div>
    ));

  return (
    <div className={styles.tree} data-testid="rules-tree">
      {ORIGIN_ORDER.map((origin) => {
        const rules = grouped[origin];
        const tree = buildPathTree(rules.map((r) => ({ dir: dirname(r.path), item: r })));
        return (
          <div key={origin}>
            <div className={styles.origin}>
              <Folder size={13} style={{ verticalAlign: -2 }} /> {ORIGIN_LABELS[origin]} <span className={styles.empty}>{rules.length === 0 ? 'empty' : `(${rules.length})`}</span>
            </div>
            <DirTree node={tree} depth={1} collapsed={collapsed} toggle={toggle} renderItems={renderRules} />
          </div>
        );
      })}
    </div>
  );
}
