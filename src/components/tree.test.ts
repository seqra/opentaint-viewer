import { describe, it, expect } from 'vitest';
import { buildPathTree } from './tree';

describe('buildPathTree', () => {
  it('places items at their directory node', () => {
    const tree = buildPathTree([{ dir: '', item: 'root-item' }]);
    expect(tree.items).toEqual(['root-item']);
    expect(tree.dirs).toEqual([]);
  });

  it('compacts single-child directory chains', () => {
    const tree = buildPathTree([
      { dir: 'a/b/c', item: 1 },
      { dir: 'a/b/c', item: 2 },
      { dir: 'a/b/d', item: 3 },
    ]);
    // a -> b is a single-child chain with no items, so it collapses to "a/b"
    expect(tree.dirs).toHaveLength(1);
    expect(tree.dirs[0].name).toBe('a/b');
    const names = tree.dirs[0].dirs.map((d) => d.name).sort();
    expect(names).toEqual(['c', 'd']);
    const c = tree.dirs[0].dirs.find((d) => d.name === 'c')!;
    expect(c.items).toEqual([1, 2]);
    expect(c.path).toBe('a/b/c'); // stable full-path key for fold state
  });

  it('does not merge a directory that has its own items', () => {
    const tree = buildPathTree([
      { dir: 'a', item: 'x' },
      { dir: 'a/b', item: 'y' },
    ]);
    expect(tree.dirs).toHaveLength(1);
    expect(tree.dirs[0].name).toBe('a');
    expect(tree.dirs[0].items).toEqual(['x']);
    expect(tree.dirs[0].dirs[0].name).toBe('b');
  });
});
