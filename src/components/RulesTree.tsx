import { Folder, FileText } from 'lucide-react';
import { useStore } from '../state/store';
import { keyActivate } from './keyActivate';
import { rulesByOrigin } from '../content/loadContent';
import { buildPathTree, itemDirPaths } from '../util/tree';
import { basename, dirname } from '../util/path';
import { isPhoneViewport } from '../util/viewport';
import { DirTree, indent, useCollapsibleSet } from './treeView';
import type { RuleOrigin, RuleSpec, ViewerContent } from '../types/content';
import styles from './RulesTree.module.css';

const ORIGIN_ORDER: RuleOrigin[] = ['builtin', 'custom'];
const ORIGIN_LABELS: Record<RuleOrigin, string> = { builtin: 'Builtin', custom: 'Custom' };

/** Collapse the leaf-bearing dirs across both origins so the tree opens as a folder overview. */
function foldKeys(content: ViewerContent): string[] {
  const grouped = rulesByOrigin(content);
  return ORIGIN_ORDER.flatMap((origin) =>
    itemDirPaths(buildPathTree(grouped[origin].map((r) => ({ dir: dirname(r.path), item: r })))),
  );
}

export function RulesTree() {
  const content = useStore((s) => s.content);
  const activeRuleId = useStore((s) => s.activeRuleId);
  const selectRule = useStore((s) => s.selectRule);
  // On phones the tree starts fully folded so the drawer opens compact; desktop stays expanded.
  const { collapsed, toggle } = useCollapsibleSet(
    isPhoneViewport() ? () => (content ? foldKeys(content) : []) : undefined,
  );
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
      <div className={styles.rows}>
        <div className={styles.rowsInner}>
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
      </div>
    </div>
  );
}
