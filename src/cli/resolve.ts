import { existsSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface SarifSrcRoot {
  runs?: Array<{ originalUriBaseIds?: Record<string, { uri?: string }> }>;
}

/** The SARIF's %SRCROOT% as a local filesystem path (trailing slash trimmed), or null. */
export function srcRootFromSarif(log: SarifSrcRoot): string | null {
  const uri = log.runs?.[0]?.originalUriBaseIds?.['%SRCROOT%']?.uri;
  if (!uri) return null;
  let path: string;
  if (uri.startsWith('file:')) {
    try {
      path = fileURLToPath(uri);
    } catch {
      return null; // malformed file: URI (e.g. file://host/...) — caller falls back to the SARIF dir
    }
  } else {
    path = uri;
  }
  return path.replace(/\/+$/, '') || '/';
}

/** Source root: --src wins; else %SRCROOT% if it exists on disk; else the SARIF's directory. */
export function resolveSourceRoot(log: SarifSrcRoot, sarifPath: string, srcArg?: string): string {
  if (srcArg) return resolve(srcArg);
  const fromSarif = srcRootFromSarif(log);
  if (fromSarif && existsSync(fromSarif)) return resolve(fromSarif);
  return resolve(dirname(sarifPath));
}

/** First `opentaint` engine binary found on PATH, or null. */
export function findOpentaintBinary(
  pathEnv: string | undefined = process.env.PATH,
  isWindows: boolean = process.platform === 'win32',
): string | null {
  if (!pathEnv) return null;
  const names = isWindows
    ? ['opentaint.exe', 'opentaint.cmd', 'opentaint.bat', 'opentaint']
    : ['opentaint'];
  for (const entry of pathEnv.split(delimiter)) {
    if (!entry) continue;
    for (const name of names) {
      const candidate = resolve(entry, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Builtin ruleset dir, in priority order:
 *   1. --builtin-rules <dir> when given.
 *   2. ../lib/rules next to the `opentaint` engine binary on PATH (the engine ships its
 *      ruleset there) — this is what makes the npm/npx-installed viewer work standalone.
 *   3. ../lib/rules next to this CLI — the layout when the viewer is bundled inside a
 *      native engine install (engine and viewer share a bin/ dir, so this equals #2).
 */
export function resolveBuiltinRulesDir(
  cliUrl: string,
  builtinRulesArg?: string,
  findEngine: () => string | null = findOpentaintBinary,
): string {
  if (builtinRulesArg) return resolve(builtinRulesArg);
  const engine = findEngine();
  if (engine) {
    const fromEngine = resolve(dirname(engine), '..', 'lib', 'rules');
    if (existsSync(fromEngine)) return fromEngine;
  }
  const binDir = dirname(fileURLToPath(cliUrl));
  return resolve(binDir, '..', 'lib', 'rules');
}
