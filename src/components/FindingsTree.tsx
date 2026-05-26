import { useState } from 'react';
import { FileText } from 'lucide-react';
import { useStore } from '../state/store';
import { keyActivate } from './keyActivate';
import { buildPathTree } from '../util/tree';
import { basename, dirname } from '../util/path';
import { DirTree, FoldRow, indent, useCollapsibleSet } from './treeView';
import type { Finding } from '../types/content';
import { SeverityDot } from './SeverityDot';
import styles from './FindingsTree.module.css';

const dirOf = (f: Finding): string => dirname(f.file ?? '');

export function FindingsTree() {
  const content = useStore((s) => s.content);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const selectFinding = useStore((s) => s.selectFinding);

  const [ruleFilter, setRuleFilter] = useState('');
  const { collapsed, toggle } = useCollapsibleSet();

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
        <SeverityDot severity={f.severity} /> <span>{loc ?? f.ruleId}</span>
        {loc && <span className={styles.rule}>{f.ruleId}</span>}
      </div>
    );
  };

  const renderFile = (filePath: string, items: Finding[], depth: number) => (
    <FoldRow
      key={filePath}
      path={filePath}
      attr="file"
      className={styles.file}
      depth={depth}
      collapsed={collapsed}
      toggle={toggle}
      label={<><FileText size={13} style={{ verticalAlign: -2 }} /> {basename(filePath)} <span className={styles.count}>{items.length}</span></>}
    >
      {items.map((f) => renderFinding(f, depth + 1))}
    </FoldRow>
  );

  const renderFiles = (items: Finding[], depth: number) =>
    filesOf(items).map(([filePath, group]) => renderFile(filePath, group, depth));

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
      <DirTree node={tree} depth={0} collapsed={collapsed} toggle={toggle} renderItems={renderFiles} />
    </div>
  );
}
