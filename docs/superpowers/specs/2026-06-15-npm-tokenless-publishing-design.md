# Tokenless npm publishing for `@seqra/opentaint-viewer`

**Date:** 2026-06-15
**Status:** Design — pending review

## Goal

Publish the `opentaint-viewer` CLI to the public npm registry from CI with **no
long-lived npm token**, using **semantic-release** + npm **OIDC trusted
publishing**, mirroring the established `seqra/opentaint` release convention
(`.github/workflows/release-cli.yaml`, `cli/.releaserc.cjs`,
`release-notes-transform.cjs`, `.github/actions/manual-version-bump`).

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | npm package name | **`@seqra/opentaint-viewer`** (scoped, `--access public`); bin command stays `opentaint-viewer` |
| 2 | Release trigger | **`workflow_dispatch`** with `release_type` = `auto` \| `patch` \| `minor` \| `major` (full `release-cli.yaml` parity; port `manual-version-bump`) |
| 3 | Release gating | **No scope gate** — any `feat`/`fix`/`refactor`/`revert` releases (`feat`→minor, `fix`/`refactor`/`revert`→patch, breaking→major) |
| 4 | First-publish bootstrap | **Manual local publish** done by Claude; user approves the interactive `npm login` |
| — | Starting version | `0.1.0` (bootstrap), then semantic-release bumps from tag `v0.1.0` (adjustable) |
| — | Branches | `['main']` only (no prerelease branches yet) |

## Why this shape

`seqra/opentaint` proves the team's pattern: **semantic-release does not publish
to npm**. It computes the version, cuts the GitHub Release, and writes
`release_version.txt` via `@semantic-release/exec`. A **separate, native
`npm publish` step** does the OIDC publish. We mirror that exactly, stripped of
the Go/Docker/JRE/Homebrew/GoReleaser machinery that doesn't apply to a
TypeScript package.

Native `npm publish` (vs `@semantic-release/npm` or `changesets/action`) also
sidesteps the known **OIDC + scoped-package E404 bug** that only affects
`changesets/action` ([npm/cli#8976](https://github.com/npm/cli/issues/8976)).

### Environment requirements (verified)

- OIDC trusted publishing requires **npm CLI ≥ 11.5.1** and **Node ≥ 22.14**.
  Node 22's bundled npm is 10.x, so the publish step runs `npm install -g
  npm@latest` (same as `release-cli.yaml`).
- **Provenance is automatic** for public packages — no `--provenance` flag.
- Trusted-publisher config is **package-level** on npmjs.com, so the package
  must exist first → one-time manual bootstrap (confirmed by the comment in the
  team's own `release-cli.yaml`).

## Architecture / flow

```
workflow_dispatch (release_type)
        │
   ┌────┴─────────────────────────┐
   │ release_type != 'auto'       │ release_type == 'auto'
   ▼                              ▼
manual-version-bump          cycjimmy/semantic-release-action@v4
 (compute v from tags)        (commit-analyzer → release-notes →
 write release_version.txt     @semantic-release/github → exec writes
 create+push tag vX.Y.Z)       release_version.txt; creates GH release+tag)
   └──────────────┬───────────────┘
                  ▼
        read release_version.txt  →  status=succeeded? RELEASE_VERSION=X.Y.Z
                  │  (file absent → no release → publish skipped)
                  ▼ (succeeded)
        npm install -g npm@latest
        npm version $RELEASE_VERSION --no-git-tag-version --allow-same-version
        npm publish --access public      ← OIDC (id-token: write), idempotent
        (prepack runs `npm run build:dist` → fresh dist-cli/ in the tarball)
```

Publish is **idempotent**: `EPUBLISHCONFLICT` / "cannot publish over" /
"previously published" are treated as success, so re-runs don't fail.

## File-by-file changes

### `package.json`

Remove `"private": true`. Add metadata + publish config:

```jsonc
{
  "name": "@seqra/opentaint-viewer",
  "version": "0.1.0",
  "description": "In-browser, VS Code–style viewer for OpenTaint taint-analysis (SARIF) results — generate a self-contained, offline HTML report from a CLI.",
  "keywords": ["opentaint", "sarif", "taint-analysis", "sast", "security", "viewer", "cli"],
  "homepage": "https://github.com/seqra/opentaint-viewer#readme",
  "repository": { "type": "git", "url": "git+https://github.com/seqra/opentaint-viewer.git" },
  "bugs": { "url": "https://github.com/seqra/opentaint-viewer/issues" },
  "license": "MIT",
  "author": "Seqra Team",
  "engines": { "node": ">=20" },
  "type": "module",
  "bin": { "opentaint-viewer": "dist-cli/opentaint-viewer.js" },
  "files": ["dist-cli"],
  "publishConfig": { "access": "public" },
  "scripts": {
    "...": "existing scripts unchanged",
    "prepack": "npm run build:dist"
  }
}
```

- `"files": ["dist-cli"]` — `dist-cli/` is gitignored, so the whitelist forces
  it (and its `template/`) into the tarball. `README.md` + `LICENSE` are
  auto-included.
- `"prepack"` — guarantees any publish path (CI, `npm pack`, the manual
  bootstrap) ships a freshly built `dist-cli/`.
- Committed `version` stays `0.1.0`; CI overwrites it at publish time via `npm
  version`. Tags + npm are the source of truth (matches the team; the committed
  number is only authoritative when CI sets it).
- **No new dependencies** in `package.json`: semantic-release and its plugins
  are installed by `cycjimmy/semantic-release-action` in CI (pinned via
  `extra_plugins`), not from `package.json`.

### `.releaserc.cjs` (repo root)

Mirrors `seqra/opentaint`'s `cli/.releaserc.cjs`, with the scope gate removed
and the npm-monorepo specifics dropped. `.cjs` keeps it CommonJS under
`"type": "module"`.

```js
'use strict';

const { createTransform, TYPES } = require('./release-notes-transform.cjs');

module.exports = {
  branches: ['main'],
  ci: false,
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { breaking: true, release: 'major' },
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'revert', release: 'patch' },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: { types: TYPES },
        writerOpts: { transform: createTransform() },
      },
    ],
    [
      '@semantic-release/github',
      {
        successComment: false,
        failTitle: false,
        labels: false,
        releasedLabels: false,
        assets: [],
      },
    ],
    [
      '@semantic-release/exec',
      { prepareCmd: 'echo ${nextRelease.version} > release_version.txt' },
    ],
  ],
};
```

### `release-notes-transform.cjs` (repo root)

Copied from `seqra/opentaint`, with the **scope filter removed** (decision #3):
`createTransform()` takes no args and no longer discards by scope; only the
type-level `hidden` flag (chore/style/test) suppresses entries. Emoji sections,
issue/`@user` linking, and short-hash logic are unchanged.

```js
'use strict';

const TYPES = [
  { type: 'chore', hidden: true },
  { type: 'feat', section: ':gift: Features', hidden: false },
  { type: 'fix', section: ':lady_beetle: Bug Fixes', hidden: false },
  { type: 'refactor', section: ':hammer_and_wrench: Refactored', hidden: false },
  { type: 'revert', section: ':back: Reverted', hidden: false },
  { type: 'style', hidden: true },
  { type: 'test', hidden: true },
];

// No scope gating: every conventional-commit type is eligible; only a type's
// `hidden` flag (chore/style/test) suppresses its release-notes entry.
function createTransform() {
  const typeMap = new Map(TYPES.map(t => [t.type, t]));

  return (commit, context) => {
    let discard = true;
    const issues = [];

    commit.notes.forEach(note => {
      note.title = 'BREAKING CHANGES';
      discard = false;
    });

    if (typeMap.has(commit.type)) {
      const typeConfig = typeMap.get(commit.type);
      if (typeConfig.hidden) return null;
      commit.type = typeConfig.section;
      discard = false;
    } else if (discard) {
      return null;
    }

    if (commit.scope === '*') commit.scope = '';
    if (typeof commit.hash === 'string') commit.shortHash = commit.hash.substring(0, 7);

    if (typeof commit.subject === 'string') {
      let url = context.repository
        ? `${context.host}/${context.owner}/${context.repository}`
        : context.repoUrl;
      if (url) {
        url = `${url}/issues/`;
        commit.subject = commit.subject.replace(/#([0-9]+)/g, (_, issue) => {
          issues.push(issue);
          return `[#${issue}](${url}${issue})`;
        });
      }
      if (context.host) {
        commit.subject = commit.subject.replace(
          /\B@([a-z0-9](?:-(?=[a-z0-9])|[a-z0-9]){0,38})/g,
          (_, username) => (username.includes('/') ? `@${username}` : `[@${username}](${context.host}/${username})`)
        );
      }
    }

    commit.references = commit.references.filter(reference => !issues.includes(reference.issue));
    return commit;
  };
}

module.exports = { createTransform, TYPES };
```

### `.github/actions/manual-version-bump/action.yml`

Ported **verbatim** from `seqra/opentaint` (pure bash, no external deps). Inputs
`tag-prefix` + `bump-type`; outputs `new-version`, `new-tag`, `major-version`.
Computes the next semver from the latest `v*.*.*` tag.

### `.github/workflows/release.yml`

Stripped-down `release-cli.yaml`. Trusted-publisher config will reference
workflow filename **`release.yml`**.

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      release_type:
        description: 'Release type'
        required: true
        default: 'auto'
        type: choice
        options: [auto, patch, minor, major]

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: write   # tags + GitHub releases
  id-token: write   # npm OIDC trusted publishing

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
          cache: npm

      - run: npm ci

      - name: Manual version bump
        if: ${{ github.event.inputs.release_type != 'auto' }}
        id: manual_release
        uses: ./.github/actions/manual-version-bump
        with: { tag-prefix: 'v', bump-type: '${{ github.event.inputs.release_type }}' }

      - name: Write manual release version
        if: ${{ github.event.inputs.release_type != 'auto' }}
        run: echo "${{ steps.manual_release.outputs.new-version }}" > release_version.txt

      - name: Create release tag (manual)
        if: ${{ github.event.inputs.release_type != 'auto' }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git tag "v${{ steps.manual_release.outputs.new-version }}"
          git push origin "v${{ steps.manual_release.outputs.new-version }}"

      - run: git fetch --tags --force

      - name: Release (auto)
        if: ${{ github.event.inputs.release_type == 'auto' }}
        id: semantic_release
        uses: cycjimmy/semantic-release-action@v4
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          semantic_version: 23.0.0
          extra_plugins: |
            @semantic-release/commit-analyzer@11.1.0
            @semantic-release/exec@6.0.3
            conventional-changelog-conventionalcommits@7.0.2

      - name: Get release version
        id: release_version
        run: |
          if [ -f release_version.txt ]; then
            echo "status=succeeded" >> "$GITHUB_OUTPUT"
            echo "RELEASE_VERSION=$(cat release_version.txt)" >> "$GITHUB_OUTPUT"
          else
            echo "status=skipped" >> "$GITHUB_OUTPUT"
          fi
          rm -f release_version.txt

      - name: Publish to npm
        if: ${{ steps.release_version.outputs.status == 'succeeded' }}
        env:
          RELEASE_VERSION: ${{ steps.release_version.outputs.RELEASE_VERSION }}
        run: |
          set -euo pipefail
          # PREREQUISITE: @seqra/opentaint-viewer must have a trusted publisher
          # configured on npmjs.com (owner: seqra, repo: opentaint-viewer,
          # workflow: release.yml, no environment) before this runs, and the
          # package must already exist (first publish is a manual token-based
          # bootstrap — see the bootstrap section of the design doc).
          npm install -g npm@latest
          npm --version
          npm version "$RELEASE_VERSION" --no-git-tag-version --allow-same-version
          log="$(mktemp)"
          if npm publish --access public >"$log" 2>&1; then
            cat "$log"
          elif grep -qiE "cannot publish over|previously published|EPUBLISHCONFLICT" "$log"; then
            echo "Already published (skipping)"; cat "$log"
          else
            echo "npm publish failed" >&2; cat "$log" >&2; exit 1
          fi
```

Notes:
- Manual path = tag + npm publish, **no GitHub Release** (matches the team's
  manual path; only `auto`/semantic-release cuts GH releases).
- `npm publish` triggers `prepack` → builds `dist-cli/` into the tarball.

### `.gitignore`

Add `release_version.txt` (scratch file written by exec / the manual path).

### `README.md`

- **Install** section near the top: `npm i -g @seqra/opentaint-viewer` and
  `npx @seqra/opentaint-viewer …` (command name is `opentaint-viewer`).
- Short **Releasing** section: conventional commits + the `workflow_dispatch`
  `auto`/`patch`/`minor`/`major` flow.

## One-time bootstrap (Claude executes; user approves `npm login`)

Prerequisites: the **`@seqra` npm org exists** and the logged-in user has
publish rights to it.

```bash
npm ci
npm pack --dry-run            # verify tarball = bin + dist-cli/ (+ template) + README + LICENSE
npm login                     # interactive — user completes auth/2FA
npm publish --access public   # prepack builds dist-cli/; creates @seqra/opentaint-viewer@0.1.0
git tag v0.1.0 && git push origin v0.1.0   # continuity for semantic-release
```

Then (user, in the npmjs.com UI): package → Settings → **Trusted Publisher** →
GitHub Actions → owner `seqra`, repo `opentaint-viewer`, workflow `release.yml`,
environment blank, allowed action `npm publish`. After this, every CI release is
tokenless.

## Verification

- `npm pack --dry-run` — tarball contains exactly `dist-cli/opentaint-viewer.js`,
  `dist-cli/template/index.html`, `package.json`, `README.md`, `LICENSE`.
- `npx semantic-release --dry-run --no-ci` locally — validates `.releaserc.cjs`
  + the transform load and that commit-analyzer computes a sane next version.
- Lint the workflow YAML (`actionlint` if available).
- First real CI release after bootstrap: confirm npm shows the new version with
  a provenance badge, and the idempotent guard handles a manual re-run.

## Out of scope (YAGNI)

- Floating major/minor tags (`update-floating-tags`).
- Prerelease `release/**` branches + dist-tags.
- Changelog file committed to the repo (we rely on GitHub Release notes only —
  no `@semantic-release/git`/`changelog`, matching the team).
- Auto-release on push to `main` (chose manual `workflow_dispatch`).

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Trusted publisher not attached before first CI publish → 403 | Bootstrap + attach trusted publisher is a documented, ordered prerequisite (workflow comment + this doc). |
| Node 22 ships npm 10.x (< 11.5.1) | `npm install -g npm@latest` in the publish step. |
| Re-running a release re-publishes an existing version | Idempotent publish guard (`EPUBLISHCONFLICT` → success). |
| `@seqra` org missing / no publish rights | Called out as a bootstrap prerequisite; surfaces at `npm publish` time. |
| Committed `package.json` version drifts from npm | Expected: tags/npm are source of truth; CI sets the real version at publish (matches the team). |
