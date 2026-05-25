/** Helpers for "/"-separated paths, shared across the SARIF pipeline and the UI. */

/** Last segment, e.g. `a/b/c.java` -> `c.java`. */
export function basename(path: string): string {
  return path.split('/').pop() || path;
}

/** Everything before the last segment, e.g. `a/b/c.java` -> `a/b` (`""` at root). */
export function dirname(path: string): string {
  return path.split('/').slice(0, -1).join('/');
}

/** The last `n` segments joined back, e.g. `lastSegments('a/b/c', 2)` -> `b/c`. */
export function lastSegments(path: string, n: number): string {
  return path.split('/').slice(-n).join('/');
}

/** Human-readable breadcrumb, e.g. `a/b/c.yaml` -> `a › b › c.yaml`. */
export function breadcrumb(path: string, sep = ' › '): string {
  return path.split('/').join(sep);
}
