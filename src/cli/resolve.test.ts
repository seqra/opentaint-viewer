// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { srcRootFromSarif, resolveSourceRoot, resolveBuiltinRulesDir, findOpentaintBinary } from './resolve';

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'resolve-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const sarifWith = (uri?: string) => ({
  runs: [{ originalUriBaseIds: uri ? { '%SRCROOT%': { uri } } : undefined }],
});

describe('srcRootFromSarif', () => {
  it('reads %SRCROOT% and trims a trailing slash', () => {
    expect(srcRootFromSarif(sarifWith('/project/'))).toBe('/project');
  });
  it('accepts a file: URL', () => {
    expect(srcRootFromSarif(sarifWith('file:///tmp/proj/'))).toBe('/tmp/proj');
  });
  it('returns null when absent', () => {
    expect(srcRootFromSarif(sarifWith(undefined))).toBeNull();
  });
  it('returns null for an empty %SRCROOT% uri', () => {
    expect(srcRootFromSarif(sarifWith(''))).toBeNull();
  });
  it('returns null for a malformed file: URL with a host component', () => {
    expect(srcRootFromSarif(sarifWith('file://host/tmp/proj/'))).toBeNull();
  });
});

describe('resolveSourceRoot', () => {
  it('honours an explicit --src over everything', () => {
    expect(resolveSourceRoot(sarifWith('/project/'), '/x/report.sarif', dir)).toBe(resolve(dir));
  });
  it('uses %SRCROOT% when it exists on disk', () => {
    expect(resolveSourceRoot(sarifWith(dir), join(dir, 'report.sarif'))).toBe(dir);
  });
  it('falls back to the SARIF directory when %SRCROOT% is missing or absent on disk', () => {
    expect(resolveSourceRoot(sarifWith('/no/such/root'), join(dir, 'report.sarif'))).toBe(resolve(dir));
    expect(resolveSourceRoot(sarifWith(undefined), join(dir, 'report.sarif'))).toBe(resolve(dir));
  });
});

describe('resolveBuiltinRulesDir', () => {
  const cliUrl = pathToFileURL('/opt/opentaint/bin/opentaint-viewer.js').href;

  it('honours an explicit --builtin-rules over an engine on PATH', () => {
    expect(resolveBuiltinRulesDir(cliUrl, dir, () => '/engine/bin/opentaint')).toBe(resolve(dir));
  });

  it('derives ../lib/rules from the opentaint engine binary on PATH', () => {
    const engineDir = mkdtempSync(join(tmpdir(), 'engine-'));
    mkdirSync(join(engineDir, 'lib', 'rules'), { recursive: true });
    const enginePath = join(engineDir, 'bin', 'opentaint');
    mkdirSync(join(engineDir, 'bin'), { recursive: true });
    writeFileSync(enginePath, '');
    expect(resolveBuiltinRulesDir(cliUrl, undefined, () => enginePath)).toBe(resolve(engineDir, 'lib', 'rules'));
    rmSync(engineDir, { recursive: true, force: true });
  });

  it('falls back to the CLI path when the engine binary has no ../lib/rules', () => {
    expect(resolveBuiltinRulesDir(cliUrl, undefined, () => '/no/such/bin/opentaint')).toBe('/opt/opentaint/lib/rules');
  });

  it('falls back to ../lib/rules next to the CLI when no engine is on PATH', () => {
    expect(resolveBuiltinRulesDir(cliUrl, undefined, () => null)).toBe('/opt/opentaint/lib/rules');
  });
});

describe('findOpentaintBinary', () => {
  it('finds opentaint in a PATH entry', () => {
    const binDir = mkdtempSync(join(tmpdir(), 'path-'));
    writeFileSync(join(binDir, 'opentaint'), '');
    expect(findOpentaintBinary(`/no/such/dir${delimiter}${binDir}`, false)).toBe(resolve(binDir, 'opentaint'));
    rmSync(binDir, { recursive: true, force: true });
  });

  it('matches opentaint.exe on Windows', () => {
    const binDir = mkdtempSync(join(tmpdir(), 'winpath-'));
    writeFileSync(join(binDir, 'opentaint.exe'), '');
    expect(findOpentaintBinary(binDir, true)).toBe(resolve(binDir, 'opentaint.exe'));
    rmSync(binDir, { recursive: true, force: true });
  });

  it('returns null when opentaint is not on PATH', () => {
    expect(findOpentaintBinary('/no/such/dir', false)).toBeNull();
  });

  it('returns null for an empty PATH', () => {
    expect(findOpentaintBinary('', false)).toBeNull();
  });
});
