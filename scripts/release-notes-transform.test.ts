import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// The transform is CommonJS (.cjs) at the repo root; load it via require so the
// module.exports shape is preserved across the ESM test boundary.
const require = createRequire(import.meta.url);
const { createTransform, TYPES } = require('../release-notes-transform.cjs');

const ctx = { host: 'https://github.com', owner: 'seqra', repository: 'opentaint-viewer' };
const commit = (over: Record<string, unknown> = {}) => ({
  type: 'feat',
  scope: null,
  notes: [],
  hash: 'abcdef1234567890',
  subject: 'do a thing',
  references: [],
  ...over,
});

describe('release-notes transform', () => {
  it('exposes the expected conventionalcommits TYPES', () => {
    const feat = TYPES.find((t: { type: string }) => t.type === 'feat');
    expect(feat).toMatchObject({ section: ':gift: Features', hidden: false });
  });

  it('keeps a feat commit and maps it to the Features section', () => {
    const out = createTransform()(commit({ type: 'feat' }), ctx);
    expect(out).not.toBeNull();
    expect(out.type).toBe(':gift: Features');
    expect(out.shortHash).toBe('abcdef1');
  });

  it('drops a chore commit (hidden type)', () => {
    expect(createTransform()(commit({ type: 'chore' }), ctx)).toBeNull();
  });

  it('keeps a fix commit regardless of scope (no scope gate)', () => {
    const out = createTransform()(commit({ type: 'fix', scope: 'docs', subject: 'patch it' }), ctx);
    expect(out).not.toBeNull();
    expect(out.type).toBe(':lady_beetle: Bug Fixes');
  });

  it('links issue references in the subject', () => {
    const out = createTransform()(commit({ subject: 'close #123' }), ctx);
    expect(out.subject).toBe('close [#123](https://github.com/seqra/opentaint-viewer/issues/123)');
  });
});
