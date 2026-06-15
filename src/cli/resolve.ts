import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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

/** Builtin ruleset dir: --builtin-rules wins; else ../lib/rules relative to the CLI executable. */
export function resolveBuiltinRulesDir(cliUrl: string, builtinRulesArg?: string): string {
  if (builtinRulesArg) return resolve(builtinRulesArg);
  const binDir = dirname(fileURLToPath(cliUrl));
  return resolve(binDir, '..', 'lib', 'rules');
}
