# Tokenless npm Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `@seqra/opentaint-viewer` to npm from CI with no long-lived token, via semantic-release + npm OIDC trusted publishing, mirroring the `seqra/opentaint` release convention.

**Architecture:** A `workflow_dispatch` release workflow runs semantic-release (auto) or a ported `manual-version-bump` action (patch/minor/major) to compute a version and write `release_version.txt`; a separate native `npm publish` step then does the OIDC publish (`id-token: write`, `npm install -g npm@latest`, idempotent). The repo root is the npm package; `dist-cli/` is built by a `prepack` hook.

**Tech Stack:** npm (scoped package, OIDC trusted publishing), GitHub Actions, `cycjimmy/semantic-release-action@v4` (semantic-release 23), conventionalcommits, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-15-npm-tokenless-publishing-design.md`

---

## File Structure

- `package.json` — **modify**: make publishable (drop `private`, scoped name, metadata, `files`, `publishConfig`, `engines`, `prepack`).
- `.gitignore` — **modify**: ignore the scratch `release_version.txt`.
- `release-notes-transform.cjs` — **create** (repo root): conventionalcommits writer transform (emoji sections, issue/`@user` linking, no scope gate).
- `scripts/release-notes-transform.test.ts` — **create**: Vitest unit tests for the transform.
- `.releaserc.cjs` — **create** (repo root): semantic-release config (CommonJS under `"type":"module"`).
- `.github/actions/manual-version-bump/action.yml` — **create**: composite action computing the next semver from tags (verbatim port).
- `.github/workflows/release.yml` — **create**: the release + npm publish workflow.
- `README.md` — **modify**: add Install + Releasing sections.

---

## Task 1: Make the package publishable (`package.json` + `.gitignore`)

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Replace `package.json` with the publishable version**

Overwrite `package.json` with exactly this (drops `"private": true`, scopes the name, adds metadata + `files` + `publishConfig` + `engines` + `prepack`; scripts/deps otherwise unchanged):

```json
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
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": {
    "opentaint-viewer": "dist-cli/opentaint-viewer.js"
  },
  "files": ["dist-cli"],
  "publishConfig": { "access": "public" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "build:single": "tsc --noEmit && vite build --mode singlefile --outDir dist-single --emptyOutDir",
    "cli": "tsx src/cli/main.ts",
    "build:template": "tsc --noEmit && vite build --mode template --outDir dist-template --emptyOutDir",
    "build:cli": "esbuild src/cli/main.ts --bundle --platform=node --format=esm --target=node20 --outfile=dist-cli/opentaint-viewer.js",
    "build:dist": "npm run build:template && npm run build:cli && node scripts/copy-template.mjs",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "e2e": "playwright test",
    "gen": "tsx scripts/gen-content.ts",
    "screenshots": "tsx scripts/screenshots.ts",
    "prepack": "npm run build:dist"
  },
  "dependencies": {
    "@fontsource/jetbrains-mono": "^5.2.8",
    "@monaco-editor/react": "^4.6.0",
    "lucide-react": "^1.16.0",
    "monaco-editor": "^0.55.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^10.1.0",
    "react-resizable-panels": "^2.1.9",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^20.19.41",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "@vitest/coverage-v8": "^2.0.5",
    "esbuild": "^0.24.0",
    "jsdom": "^25.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.3",
    "vite-plugin-singlefile": "^2.3.3",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Add `release_version.txt` to `.gitignore`**

Append this line to `.gitignore`:

```
release_version.txt
```

- [ ] **Step 3: Verify the tarball contents (this is the test)**

`npm pack --dry-run` runs `prepack` (builds `dist-cli/`) then lists what would ship.

Run:
```bash
npm pack --dry-run 2>&1 | tee /tmp/pack.txt
```
Expected: output lists `dist-cli/opentaint-viewer.js`, `dist-cli/template/index.html`, `package.json`, `README.md`, `LICENSE` — and **no** `src/` files. Confirm with:
```bash
grep -q 'dist-cli/opentaint-viewer.js' /tmp/pack.txt \
  && grep -q 'dist-cli/template/index.html' /tmp/pack.txt \
  && grep -q 'LICENSE' /tmp/pack.txt \
  && ! grep -qE ' src/' /tmp/pack.txt \
  && echo "PACK OK"
```
Expected: `PACK OK`

- [ ] **Step 4: Verify `npm` no longer refuses to publish (private removed)**

Run:
```bash
node -e "const p=require('./package.json'); if(p.private) throw new Error('still private'); if(p.name!=='@seqra/opentaint-viewer') throw new Error('name'); console.log('META OK', p.name, p.version)"
```
Expected: `META OK @seqra/opentaint-viewer 0.1.0`

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore
git commit -m "feat: make package publishable to npm as @seqra/opentaint-viewer"
```

---

## Task 2: Release-notes transform (TDD)

**Files:**
- Create: `release-notes-transform.cjs` (repo root)
- Test: `scripts/release-notes-transform.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/release-notes-transform.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx vitest run scripts/release-notes-transform.test.ts
```
Expected: FAIL — cannot find module `../release-notes-transform.cjs`.

- [ ] **Step 3: Create the transform**

Create `release-notes-transform.cjs` (repo root):

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

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npx vitest run scripts/release-notes-transform.test.ts
```
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add release-notes-transform.cjs scripts/release-notes-transform.test.ts
git commit -m "feat: add release-notes transform for semantic-release"
```

---

## Task 3: semantic-release config (`.releaserc.cjs`)

**Files:**
- Create: `.releaserc.cjs` (repo root)

- [ ] **Step 1: Create `.releaserc.cjs`**

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

- [ ] **Step 2: Verify the config loads and wires the transform (this is the test)**

Plugins are installed in CI by `cycjimmy/semantic-release-action`, not locally — so verify the config file itself is valid JS, requires the transform without error, and produces a callable transform:

```bash
node -e "
const c = require('./.releaserc.cjs');
if (!Array.isArray(c.branches) || c.branches[0] !== 'main') throw new Error('branches');
const rng = c.plugins.find(p => p[0] === '@semantic-release/release-notes-generator');
if (typeof rng[1].writerOpts.transform !== 'function') throw new Error('transform not wired');
const out = rng[1].writerOpts.transform({type:'feat',scope:null,notes:[],hash:'abc1234',subject:'x',references:[]}, {host:'https://github.com',owner:'seqra',repository:'opentaint-viewer'});
if (out.type !== ':gift: Features') throw new Error('transform output');
console.log('RELEASERC OK');
"
```
Expected: `RELEASERC OK`

- [ ] **Step 3: Commit**

```bash
git add .releaserc.cjs
git commit -m "feat: add semantic-release config (no @semantic-release/npm; native publish in workflow)"
```

---

## Task 4: `manual-version-bump` composite action

**Files:**
- Create: `.github/actions/manual-version-bump/action.yml`

- [ ] **Step 1: Create the composite action (verbatim port from `seqra/opentaint`)**

Create `.github/actions/manual-version-bump/action.yml`:

```yaml
name: 'Manual version bump'
description: 'Compute next semver tag from existing tags and a bump type'

inputs:
  tag-prefix:
    description: 'Git tag prefix (e.g. "v", "github/v", "gitlab/v", "rules/v")'
    required: true
  bump-type:
    description: 'Bump type: major, minor, or patch'
    required: true

outputs:
  new-version:
    description: 'New version without prefix (e.g. 1.2.3)'
    value: ${{ steps.bump.outputs.new_version }}
  new-tag:
    description: 'New full tag (e.g. v1.2.3)'
    value: ${{ steps.bump.outputs.new_tag }}
  major-version:
    description: 'Major version number'
    value: ${{ steps.bump.outputs.major }}

runs:
  using: 'composite'
  steps:
    - name: Compute next version
      id: bump
      shell: bash
      run: |
        set -euo pipefail
        TAG_PREFIX="${{ inputs.tag-prefix }}"
        BUMP_TYPE="${{ inputs.bump-type }}"

        LATEST_TAG=$(git tag -l "${TAG_PREFIX}*.*.*" --sort=-v:refname | head -1)
        if [ -z "$LATEST_TAG" ]; then
          LATEST_VERSION="0.0.0"
        else
          LATEST_VERSION="${LATEST_TAG#${TAG_PREFIX}}"
        fi

        IFS='.' read -r major minor patch <<< "$LATEST_VERSION"
        case "$BUMP_TYPE" in
          major) major=$((major + 1)); minor=0; patch=0 ;;
          minor) minor=$((minor + 1)); patch=0 ;;
          patch) patch=$((patch + 1)) ;;
        esac
        NEW_VERSION="${major}.${minor}.${patch}"
        NEW_TAG="${TAG_PREFIX}${NEW_VERSION}"

        echo "Bumping ${LATEST_TAG:-none} -> $NEW_TAG ($BUMP_TYPE)"
        echo "new_version=$NEW_VERSION" >> "$GITHUB_OUTPUT"
        echo "new_tag=$NEW_TAG" >> "$GITHUB_OUTPUT"
        echo "major=$major" >> "$GITHUB_OUTPUT"
```

- [ ] **Step 2: Verify the bump arithmetic (this is the test)**

Sanity-check the exact compute logic with sample inputs:

```bash
bash -c '
set -euo pipefail
check() {
  LATEST_VERSION="$1"; BUMP_TYPE="$2"; EXPECT="$3"
  IFS=. read -r major minor patch <<< "$LATEST_VERSION"
  case "$BUMP_TYPE" in
    major) major=$((major+1)); minor=0; patch=0 ;;
    minor) minor=$((minor+1)); patch=0 ;;
    patch) patch=$((patch+1)) ;;
  esac
  GOT="${major}.${minor}.${patch}"
  [ "$GOT" = "$EXPECT" ] || { echo "FAIL $LATEST_VERSION $BUMP_TYPE -> $GOT (want $EXPECT)"; exit 1; }
}
check 0.1.0 minor 0.2.0
check 0.1.0 patch 0.1.1
check 0.1.0 major 1.0.0
check 1.4.9 patch 1.4.10
echo "BUMP OK"
'
```
Expected: `BUMP OK`

- [ ] **Step 3: Commit**

```bash
git add .github/actions/manual-version-bump/action.yml
git commit -m "feat: add manual-version-bump composite action"
```

---

## Task 5: Release workflow (`.github/workflows/release.yml`)

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/release.yml`:

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
        with:
          fetch-depth: 0

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
        with:
          tag-prefix: 'v'
          bump-type: ${{ github.event.inputs.release_type }}

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

      - name: Force-update tags
        run: git fetch --tags --force

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
          # bootstrap — see Task 7).
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

- [ ] **Step 2: Verify the workflow YAML parses (this is the test)**

Try `actionlint` (preferred); fall back to a YAML parse if it isn't installed:

```bash
if command -v actionlint >/dev/null 2>&1; then
  actionlint .github/workflows/release.yml && echo "ACTIONLINT OK"
else
  python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/release.yml')); print('YAML OK')" 2>/dev/null \
    || ruby -ryaml -e "YAML.load_file('.github/workflows/release.yml'); puts 'YAML OK'"
fi
```
Expected: `ACTIONLINT OK` (or `YAML OK`). If neither tool is available, visually confirm indentation and that the `Publish to npm` step references `release.yml` in its prerequisite comment.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat: add tokenless npm release workflow (OIDC trusted publishing)"
```

---

## Task 6: README — Install + Releasing sections

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add an Install section after the intro**

In `README.md`, immediately **after** the closing `</picture>` tag of the hero image and **before** the `## Generate a static HTML report for your project` heading, insert:

```markdown
## Install the CLI from npm

```bash
npm install -g @seqra/opentaint-viewer   # global install
# or run without installing:
npx @seqra/opentaint-viewer --help
```

The installed command is `opentaint-viewer`. Published builds are signed with npm
[provenance](https://docs.npmjs.com/generating-provenance-statements) (built from
this repo via GitHub Actions OIDC — no publish tokens).

```

- [ ] **Step 2: Add a Releasing section after the npm-scripts table**

In `README.md`, immediately **after** the table of `npm run …` scripts, insert:

```markdown
## Releasing

Published to npm as [`@seqra/opentaint-viewer`](https://www.npmjs.com/package/@seqra/opentaint-viewer)
via the **Release** workflow (`.github/workflows/release.yml`) — tokenless npm
[OIDC trusted publishing](https://docs.npmjs.com/trusted-publishers).

1. Land changes on `main` using [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:` → minor, `fix:`/`refactor:`/`revert:` → patch, `feat!:`/`BREAKING CHANGE` → major).
2. Actions → **Release** → **Run workflow**:
   - `auto` — semantic-release derives the version from commits since the last tag.
   - `patch` / `minor` / `major` — force a specific bump.
3. The workflow tags the release, publishes the GitHub Release notes (auto mode),
   and runs `npm publish` over OIDC. Re-runs are idempotent.

First publish only: the package is bootstrapped manually so a trusted publisher
can be attached on npmjs.com (owner `seqra`, repo `opentaint-viewer`, workflow
`release.yml`). After that, releases need no tokens.
```

- [ ] **Step 3: Verify the Markdown renders (no broken fences)**

Run:
```bash
node -e "const s=require('fs').readFileSync('README.md','utf8'); const f=(s.match(/\`\`\`/g)||[]).length; if(f%2)throw new Error('unbalanced code fences: '+f); if(!s.includes('npm install -g @seqra/opentaint-viewer'))throw new Error('install missing'); if(!s.includes('## Releasing'))throw new Error('releasing missing'); console.log('README OK', f/2, 'code blocks')"
```
Expected: `README OK <n> code blocks`

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document npm install and the tokenless release flow"
```

---

## Task 7: One-time bootstrap publish (human-in-the-loop)

This task is a **release action, not a code change** — run it once, after Tasks 1–6 are merged to `main`. It creates `@seqra/opentaint-viewer` on npm so a trusted publisher can be attached. The maintainer must belong to the `@seqra` npm org with publish rights.

- [ ] **Step 1: Clean install + sanity-check the tarball**

```bash
npm ci
npm pack --dry-run 2>&1 | grep -E 'dist-cli/|LICENSE|README' && echo "PACK OK"
```
Expected: lists the `dist-cli/` files + `LICENSE`/`README`, then `PACK OK`.

- [ ] **Step 2: Log in to npm (interactive — maintainer approves)**

```bash
npm login
```
Complete the browser/2FA prompt. Verify:
```bash
npm whoami
```
Expected: your npm username (a member of `@seqra`).

- [ ] **Step 3: Publish the bootstrap version**

```bash
npm publish --access public
```
Expected: `+ @seqra/opentaint-viewer@0.1.0`. (`prepack` rebuilds `dist-cli/` first.)

- [ ] **Step 4: Tag the bootstrap version so semantic-release continues from it**

```bash
git tag v0.1.0
git push origin v0.1.0
```

- [ ] **Step 5: Attach the trusted publisher on npmjs.com (maintainer, UI)**

On npmjs.com → package `@seqra/opentaint-viewer` → **Settings** → **Trusted Publisher** → **GitHub Actions**:
- Organization or user: `seqra`
- Repository: `opentaint-viewer`
- Workflow filename: `release.yml`
- Environment: *(leave blank)*
- Allowed action: `npm publish`

- [ ] **Step 6: Verify the package is live**

```bash
npm view @seqra/opentaint-viewer version
```
Expected: `0.1.0`

- [ ] **Step 7: Verify tokenless CI publishing end-to-end**

Land a small `fix:`/`feat:` commit on `main`, then Actions → **Release** → Run workflow (`auto`). Confirm the `Publish to npm` step succeeds with **no `NPM_TOKEN` secret**, and:
```bash
npm view @seqra/opentaint-viewer version   # shows the new bumped version
```
The npm page should show a provenance badge.

---

## Notes & gotchas

- **`.cjs` is deliberate.** `package.json` has `"type": "module"`, so `.releaserc.cjs` and `release-notes-transform.cjs` use the `.cjs` extension to stay CommonJS (semantic-release + the team's transform are CJS).
- **Committed `package.json` version stays `0.1.0`.** CI overwrites it at publish time via `npm version … --no-git-tag-version`; git tags + npm are the source of truth (matches `seqra/opentaint`).
- **Manual bumps don't cut a GitHub Release** — only `auto` (semantic-release) does. Matches the team's `release-cli.yaml`.
- **Node 22's bundled npm is 10.x** (< the 11.5.1 OIDC requires); the publish step's `npm install -g npm@latest` fixes this.
- **Out of scope:** floating major/minor tags, prerelease branches, a committed changelog, and auto-release on push.
