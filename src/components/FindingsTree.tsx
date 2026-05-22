import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { keyActivate } from './keyActivate';
import { StepNav } from './StepNav';
import { buildPathTree, type PathTree } from './tree';
import type { Finding } from '../types/content';
import styles from './FindingsTree.module.css';

const dirOf = (f: Finding): string => (f.file ?? '').split('/').slice(0, -1).join('/');
const indent = (depth: number) => ({ paddingLeft: 8 + depth * 12 });

export function FindingsTree() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const activeStepIndex = useStore((s) => s.activeStepIndex);
  const selectStep = useStore((s) => s.selectStep);
  const selectFinding = useStore((s) => s.selectFinding);

  const [ruleFilter, setRuleFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(() => new Set(activeFindingId ? [activeFindingId] : []));
  useEffect(() => {
    if (activeFindingId) setOpen((p) => new Set(p).add(activeFindingId));
  }, [activeFindingId]);

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
  const onFinding = (id: string) => {
    selectFinding(id);
    setOpen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

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
    const isOpen = open.has(f.id);
    return (
      <div key={f.id}>
        <div
          className={`${styles.finding} ${f.id === activeFindingId ? styles.activeFinding : ''}`}
          role="button"
          tabIndex={0}
          style={indent(depth)}
          onClick={() => onFinding(f.id)}
          onKeyDown={keyActivate(() => onFinding(f.id))}
        >
          {isOpen ? '▾' : '▸'} 🔴 <span>{f.vulnClass}</span>
          {(f.endpoint ?? f.location) && <span className={styles.loc}>{f.endpoint ?? f.location}</span>}
        </div>
        {isOpen && f.id === activeFindingId && <StepNav />}
        {isOpen &&
          f.steps.map((s) => (
            <div
              key={s.index}
              className={`${styles.step} ${activeStepIndex === s.index && f.id === activeFindingId ? styles.active : ''}`}
              role="button"
              tabIndex={0}
              style={indent(depth + 1)}
              onClick={() => selectStep(f.id, s.index)}
              onKeyDown={keyActivate(() => selectStep(f.id, s.index))}
            >
              <span className={styles.marker}>{s.index + 1}</span>
              {s.label}
              {s.crossesFile && <span className={styles.cross}>↗ file</span>}
            </div>
          ))}
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
              {r.vulnClass} ({r.count})
            </option>
          ))}
        </select>
      </div>
      {renderNode(tree, 0)}
    </div>
  );
}
