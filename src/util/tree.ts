/** A directory tree node carrying leaf items of type T. */
export interface PathTree<T> {
  /** Display name; may be a compacted chain like "a/b/c". */
  name: string;
  /** Full path from the root (stable key for fold/expand state). */
  path: string;
  dirs: PathTree<T>[];
  items: T[];
}

function emptyNode<T>(name: string, path: string): PathTree<T> {
  return { name, path, dirs: [], items: [] };
}

/** Collapse single-child directory chains (no items) into one "a/b" node. Bottom-up. */
function collapse<T>(node: PathTree<T>): PathTree<T> {
  let n: PathTree<T> = { ...node, dirs: node.dirs.map(collapse) };
  while (n.items.length === 0 && n.dirs.length === 1) {
    const only = n.dirs[0];
    n = { name: `${n.name}/${only.name}`, path: only.path, dirs: only.dirs, items: only.items };
  }
  return n;
}

/**
 * Build a directory tree from entries, each assigned to a directory `dir`
 * (a "/"-separated path; "" means the root). Items live at their dir node.
 */
export function buildPathTree<T>(entries: { dir: string; item: T }[]): PathTree<T> {
  const root = emptyNode<T>('', '');
  const childDir = (parent: PathTree<T>, seg: string): PathTree<T> => {
    let next = parent.dirs.find((d) => d.name === seg);
    if (!next) {
      next = emptyNode<T>(seg, parent.path ? `${parent.path}/${seg}` : seg);
      parent.dirs.push(next);
    }
    return next;
  };

  for (const { dir, item } of entries) {
    const segs = dir ? dir.split('/').filter(Boolean) : [];
    let node = root;
    for (const seg of segs) node = childDir(node, seg);
    node.items.push(item);
  }

  return { ...root, dirs: root.dirs.map(collapse) };
}

/** Paths of directory nodes that directly hold items — the leaf-bearing folds. */
export function itemDirPaths<T>(node: PathTree<T>): string[] {
  return node.dirs.flatMap((d) => [...(d.items.length ? [d.path] : []), ...itemDirPaths(d)]);
}
