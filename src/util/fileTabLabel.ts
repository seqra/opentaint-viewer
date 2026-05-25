import { basename, lastSegments } from './path';

/**
 * Label for a file tab. Normally the basename, but when two open files share a
 * basename (e.g. main/Foo.java and test/Foo.java) it disambiguates by prefixing
 * the immediate parent directory so the tabs aren't identical.
 */
export function fileTabLabel(path: string, allPaths: string[]): string {
  const base = basename(path);
  const collides = allPaths.filter((p) => basename(p) === base).length > 1;
  return collides ? lastSegments(path, 2) : base;
}
