import { useState } from 'react';
import { useStore } from '../state/store';
import { keyActivate } from './keyActivate';
import { rulesByOrigin } from '../content/loadContent';
import { buildPathTree, type PathTree } from './tree';
import type { RuleOrigin, RuleSpec } from '../types/content';
import styles from './RulesTree.module.css';

const ORIGIN_ORDER: RuleOrigin[] = ['builtin', 'custom'];
const ORIGIN_LABELS: Record<RuleOrigin, string> = { builtin: '📁 Builtin', custom: '📁 Custom' };
const indent = (depth: number) => ({ paddingLeft: 8 + depth * 12 });
const dirOf = (path: string) => path.split('/').slice(0, -1).join('/');

export function RulesTree() {
  const content = useStore((s) => s.content);
  const activeRuleId = useStore((s) => s.activeRuleId);
  const selectRule = useStore((s) => s.selectRule);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  if (!content) return null;
  const grouped = rulesByOrigin(content);

  const toggle = (path: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(path) ? n.delete(path) : n.add(path);
      return n;
    });

  const renderNode = (node: PathTree<RuleSpec>, depth: number) => (
    <>
      {node.dirs.map((d) => (
        <div key={d.path}>
          <div
            className={styles.dir}
            data-dir={d.path}
            role="button"
            tabIndex={0}
            style={indent(depth)}
            onClick={() => toggle(d.path)}
            onKeyDown={keyActivate(() => toggle(d.path))}
          >
            {collapsed.has(d.path) ? '▸' : '▾'} {d.name}/
          </div>
          {!collapsed.has(d.path) && renderNode(d, depth + 1)}
        </div>
      ))}
      {node.items.map((rule) => (
        <div
          key={rule.id}
          className={`${styles.leaf} ${activeRuleId === rule.id ? styles.active : ''}`}
          style={indent(depth)}
          role="button"
          tabIndex={0}
          onClick={() => selectRule(rule.id)}
          onKeyDown={keyActivate(() => selectRule(rule.id))}
        >
          ⚖ {rule.path.split('/').pop()}
        </div>
      ))}
    </>
  );

  return (
    <div className={styles.tree} data-testid="rules-tree">
      {ORIGIN_ORDER.map((origin) => {
        const rules = grouped[origin];
        const tree = buildPathTree(rules.map((r) => ({ dir: dirOf(r.path), item: r })));
        return (
          <div key={origin}>
            <div className={styles.origin}>
              {ORIGIN_LABELS[origin]} <span className={styles.empty}>{rules.length === 0 ? 'empty' : `(${rules.length})`}</span>
            </div>
            {renderNode(tree, 1)}
          </div>
        );
      })}
    </div>
  );
}
