// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { srcRootFromSarif, resolveSourceRoot, resolveRulesDir } from './resolve';

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

describe('resolveRulesDir', () => {
  const cliUrl = pathToFileURL('/opt/opentaint/bin/opentaint-viewer.js').href;
  it('honours an explicit --rules', () => {
    expect(resolveRulesDir(cliUrl, dir)).toBe(resolve(dir));
  });
  it('defaults to ../lib/rules relative to the CLI executable', () => {
    expect(resolveRulesDir(cliUrl)).toBe('/opt/opentaint/lib/rules');
  });
});
