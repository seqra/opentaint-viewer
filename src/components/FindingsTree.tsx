import { useState } from 'react';
import { useStore } from '../state/store';
import { keyActivate } from './keyActivate';
import { buildPathTree, type PathTree } from './tree';
import type { Finding } from '../types/content';
import styles from './FindingsTree.module.css';

const dirOf = (f: Finding): string => (f.file ?? '').split('/').slice(0, -1).join('/');
const indent = (depth: number) => ({ paddingLeft: 8 + depth * 12 });

export function FindingsTree() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const selectFinding = useStore((s) => s.selectFinding);

  const [ruleFilter, setRuleFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (!content) return null;
  const findings = content.findings;

  const ruleOptions = Object.values(
    findings.reduce<Record<string, { ruleId: string; vulnClass: string; count: number }>>((acc, f) => {
      (acc[f.ruleId] ??= { ruleId: f.ruleId, vulnClass: f.vulnClass, count: 0 }).count++;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);

  const shown = ruleFilter ? findings.filter((f) => f.ruleId === ruleFilter) : findings;
  const tree = buildPathTree(shown.map((f) => ({ dir: dirOf(f), item: f })));

  const toggleDir = (path: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(path) ? n.delete(path) : n.add(path);
      return n;
    });
  const filesOf = (items: Finding[]): [string, Finding[]][] => {
    const map = new Map<string, Finding[]>();
    for (const f of items) {
      const key = f.file ?? '';
      const arr = map.get(key) ?? [];
      arr.push(f);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  const renderFinding = (f: Finding, depth: number) => {
    const loc = f.endpoint ?? f.location;
    return (
      <div
        key={f.id}
        className={`${styles.finding} ${f.id === activeFindingId ? styles.activeFinding : ''}`}
        role="button"
        tabIndex={0}
        style={indent(depth)}
        title={loc ? `${loc} — ${f.ruleId}` : f.ruleId}
        onClick={() => selectFinding(f.id)}
        onKeyDown={keyActivate(() => selectFinding(f.id))}
      >
        🔴 <span>{loc ?? f.ruleId}</span>
        {loc && <span className={styles.rule}>{f.ruleId}</span>}
      </div>
    );
  };

  const renderFile = (filePath: string, items: Finding[], depth: number) => {
    const base = filePath.split('/').pop() || filePath;
    const isCollapsed = collapsed.has(filePath);
    return (
      <div key={filePath}>
        <div
          className={styles.file}
          data-file={filePath}
          role="button"
          tabIndex={0}
          style={indent(depth)}
          onClick={() => toggleDir(filePath)}
          onKeyDown={keyActivate(() => toggleDir(filePath))}
        >
          {isCollapsed ? '▸' : '▾'} 📄 {base} <span className={styles.count}>{items.length}</span>
        </div>
        {!isCollapsed && items.map((f) => renderFinding(f, depth + 1))}
      </div>
    );
  };

  const renderNode = (node: PathTree<Finding>, depth: number) => (
    <>
      {node.dirs.map((d) => (
        <div key={d.path}>
          <div
            className={styles.dir}
            data-dir={d.path}
            role="button"
            tabIndex={0}
            style={indent(depth)}
            onClick={() => toggleDir(d.path)}
            onKeyDown={keyActivate(() => toggleDir(d.path))}
          >
            {collapsed.has(d.path) ? '▸' : '▾'} {d.name}/
          </div>
          {!collapsed.has(d.path) && renderNode(d, depth + 1)}
        </div>
      ))}
      {filesOf(node.items).map(([filePath, items]) => renderFile(filePath, items, depth))}
    </>
  );

  return (
    <div className={styles.tree} data-testid="findings-tree">
      <div className={styles.filterRow}>
        <select
          className={styles.filter}
          aria-label="Filter findings by rule"
          value={ruleFilter}
          onChange={(e) => setRuleFilter(e.target.value)}
        >
          <option value="">All findings ({findings.length})</option>
          {ruleOptions.map((r) => (
            <option key={r.ruleId} value={r.ruleId}>
              {r.ruleId} ({r.count})
            </option>
          ))}
        </select>
      </div>
      {renderNode(tree, 0)}
    </div>
  );
}
