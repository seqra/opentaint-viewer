import { useStore } from '../state/store';
import { keyActivate } from './keyActivate';
import { rulesByOrigin } from '../content/loadContent';
import type { RuleOrigin, RuleSpec } from '../types/content';
import styles from './RulesTree.module.css';

const ORIGIN_ORDER: RuleOrigin[] = ['builtin', 'custom'];
const ORIGIN_LABELS: Record<RuleOrigin, string> = { builtin: '📁 Builtin', custom: '📁 Custom' };

interface TreeNode {
  dirs: Map<string, TreeNode>;
  files: RuleSpec[];
}

function buildTree(rules: RuleSpec[]): TreeNode {
  const root: TreeNode = { dirs: new Map(), files: [] };
  for (const rule of rules) {
    const segs = rule.path.split('/');
    segs.pop(); // drop the file name; the leaf shows the basename
    let node = root;
    for (const seg of segs) {
      let next = node.dirs.get(seg);
      if (!next) {
        next = { dirs: new Map(), files: [] };
        node.dirs.set(seg, next);
      }
      node = next;
    }
    node.files.push(rule);
  }
  return root;
}

function TreeNodeView({
  node,
  depth,
  activeRuleId,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  activeRuleId: string | null;
  onSelect: (id: string) => void;
}) {
  const indent = (d: number) => ({ paddingLeft: 8 + d * 12 });
  const dirNames = [...node.dirs.keys()].sort();
  const files = [...node.files].sort((a, b) => a.path.localeCompare(b.path));
  return (
    <>
      {dirNames.map((name) => (
        <div key={name}>
          <div className={styles.dir} style={indent(depth)}>
            {name}/
          </div>
          <TreeNodeView node={node.dirs.get(name)!} depth={depth + 1} activeRuleId={activeRuleId} onSelect={onSelect} />
        </div>
      ))}
      {files.map((rule) => (
        <div
          key={rule.id}
          className={`${styles.leaf} ${activeRuleId === rule.id ? styles.active : ''}`}
          style={indent(depth)}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(rule.id)}
          onKeyDown={keyActivate(() => onSelect(rule.id))}
        >
          ⚖ {rule.path.split('/').pop()}
        </div>
      ))}
    </>
  );
}

export function RulesTree() {
  const content = useStore((s) => s.content);
  const activeRuleId = useStore((s) => s.activeRuleId);
  const selectRule = useStore((s) => s.selectRule);
  if (!content) return null;
  const grouped = rulesByOrigin(content);

  return (
    <div className={styles.tree} data-testid="rules-tree">
      {ORIGIN_ORDER.map((origin) => {
        const rules = grouped[origin];
        return (
          <div key={origin}>
            <div className={styles.origin}>
              {ORIGIN_LABELS[origin]} <span className={styles.empty}>{rules.length === 0 ? 'empty' : `(${rules.length})`}</span>
            </div>
            <TreeNodeView node={buildTree(rules)} depth={1} activeRuleId={activeRuleId} onSelect={selectRule} />
          </div>
        );
      })}
    </div>
  );
}
