import { useState, type ReactNode } from 'react';
import { keyActivate } from './keyActivate';
import type { PathTree } from '../util/tree';
import styles from './treeView.module.css';

export const indent = (depth: number) => ({ paddingLeft: 8 + depth * 12 });

export interface Collapsible {
  collapsed: Set<string>;
  toggle: (key: string) => void;
}

/**
 * Fold/expand state keyed by node path — shared by the findings and rules trees.
 * `initial` (lazy, evaluated once) seeds the collapsed set, e.g. to start folded.
 */
export function useCollapsibleSet(initial?: () => Iterable<string>): Collapsible {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(initial?.() ?? []));
  const toggle = (key: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  return { collapsed, toggle };
}

/** A foldable row (directory / file) with the ▾/▸ caret, keyboard activation and `data-*` hook. */
export function FoldRow({
  path,
  label,
  depth,
  collapsed,
  toggle,
  className,
  attr,
  children,
}: Collapsible & {
  path: string;
  label: ReactNode;
  depth: number;
  className: string;
  attr: 'dir' | 'file';
  children: ReactNode;
}) {
  const isCollapsed = collapsed.has(path);
  return (
    <div>
      <div
        className={className}
        {...{ [`data-${attr}`]: path }}
        role="button"
        tabIndex={0}
        style={indent(depth)}
        onClick={() => toggle(path)}
        onKeyDown={keyActivate(() => toggle(path))}
      >
        {isCollapsed ? '▸' : '▾'} {label}
      </div>
      {!isCollapsed && children}
    </div>
  );
}

/** Recursively render a PathTree's directory nodes; leaves come from `renderItems`. */
export function DirTree<T>({
  node,
  depth,
  collapsed,
  toggle,
  renderItems,
}: Collapsible & {
  node: PathTree<T>;
  depth: number;
  renderItems: (items: T[], depth: number) => ReactNode;
}) {
  return (
    <>
      {node.dirs.map((d) => (
        <FoldRow key={d.path} path={d.path} label={`${d.name}/`} depth={depth} collapsed={collapsed} toggle={toggle} className={styles.dir} attr="dir">
          <DirTree node={d} depth={depth + 1} collapsed={collapsed} toggle={toggle} renderItems={renderItems} />
        </FoldRow>
      ))}
      {renderItems(node.items, depth)}
    </>
  );
}
