# Brand-Match UI Reskin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the OpenTaint Playground to match opentaint.org's brand (JetBrains Mono, red accent, cool near-black dark / clean white light, flat & border-driven) without changing its layout or behavior, plus a copyable install CTA.

**Architecture:** All theming flows through `src/theme.css`. We introduce opentaint.org's design tokens as HSL-triple **primitives** (`--*-hsl`) plus hex code-syntax tokens, then re-point the existing semantic aliases (`--bg`, `--fg`, `--accent`, …) onto those primitives. Because 51 call-sites already consume the aliases, the base reskin lands in one file with no component-CSS churn. Targeted touches (Monaco editor theme, severity badge, taint colors, install chip, a few spacing/active-state tweaks) are separate, small tasks.

**Tech Stack:** React 18, TypeScript, Vite, CSS Modules, Zustand, `@monaco-editor/react`, Vitest, Playwright. New dependency: `@fontsource/jetbrains-mono`.

**Branch:** `feat/ui-brand-reskin` (already created; spec committed).

**Reference:** Spec at `docs/superpowers/specs/2026-05-25-ui-brand-reskin-design.md` — token tables are the source of truth.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `package.json` | Add JetBrains Mono font dep | Modify |
| `src/main.tsx` | Import the font CSS | Modify |
| `src/theme.css` | Token primitives + aliases + radius + mono/sans + taint colors | Rewrite |
| `src/components/SeverityBadge.module.css` | Red-mono severity scale | Modify |
| `src/components/monacoThemes.ts` | Pure `ot-light`/`ot-dark` Monaco theme data + name helper | Create |
| `src/components/monacoThemes.test.ts` | Unit tests for the theme data/helper | Create |
| `src/components/CodeView.tsx` | Register + select the custom Monaco theme; mono editor font | Modify |
| `src/components/TopBar.tsx` | Brand wordmark + copyable curl chip | Rewrite |
| `src/components/TopBar.module.css` | Top bar styling | Rewrite |
| `src/components/TopBar.test.tsx` | Update CTA assertions; add copy tests | Modify |
| `src/components/FindingsTree.module.css` | Active-row brand accent | Modify |
| `src/components/StepsList.module.css` | A little more breathing room | Modify |

**Note on test style:** Pure-logic units (Monaco theme data, the copy chip) get real TDD (failing test first). Pure-CSS tasks have no meaningful unit assertion — their verification step is "the full existing suite stays green + `npm run build` passes + a described manual check in both themes." That is intentional, not a skipped test.

---

## Task 1: Add JetBrains Mono webfont

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx:1-4`

- [ ] **Step 1: Install the font package**

Run:
```bash
npm install @fontsource/jetbrains-mono
```
Expected: `package.json` gains `"@fontsource/jetbrains-mono"` under dependencies; `package-lock.json` updates; exit 0.

- [ ] **Step 2: Import the weights we use**

Edit `src/main.tsx` — add the three font imports above the theme import:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import './theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS (tsc + vite build succeed, font assets bundled).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/main.tsx
git commit -m "feat: bundle JetBrains Mono webfont"
```

---

## Task 2: Token foundation in theme.css

Rewrite `src/theme.css` so the dark `:root` and `[data-theme='light']` define opentaint.org's primitives, and the existing aliases resolve from them. Keep `--src/--mid/--snk` defined for now (SeverityBadge still uses them; removed in Task 3). Recolor the taint classes to the brand red here too.

**Files:**
- Rewrite: `src/theme.css`

- [ ] **Step 1: Replace the whole file with the token system**

```css
:root {
  /* opentaint.org primitives — dark (HSL component triples) */
  --bg-hsl: 215 14% 4%;
  --card-hsl: 215 10% 7%;
  --band-hsl: 215 12% 7.5%;
  --muted-hsl: 215 8% 11%;
  --fg-hsl: 215 6% 92%;
  --muted-fg-hsl: 215 8% 38%;
  --border-hsl: 215 8% 15%;
  --border-strong-hsl: 215 6% 20%;
  --brand-hsl: 0 72% 52%;

  /* code/syntax tokens — dark (hex; shared with Monaco theme data) */
  --code-bg: #15181e;
  --code-text: #d4d4d8;
  --code-keyword: #c4b5fd;
  --code-fn: #7dd3fc;
  --code-string: #f87171;
  --code-line-num: #a1a1aa;

  /* semantic aliases consumed by component CSS (full colors) */
  --bg: hsl(var(--bg-hsl));
  --bg-2: hsl(var(--card-hsl));
  --bg-3: hsl(var(--muted-hsl));
  --fg: hsl(var(--fg-hsl));
  --fg-dim: hsl(var(--muted-fg-hsl));
  --border: hsl(var(--border-hsl));
  --accent: hsl(var(--brand-hsl));
  --success: #16a34a;
  --header-bg: hsl(var(--band-hsl));
  --sel: hsl(var(--brand-hsl) / 0.16);
  --sel-weak: hsl(var(--brand-hsl) / 0.10);

  /* legacy taint role colors — still referenced by SeverityBadge until Task 3 */
  --src: #22c55e;
  --mid: #f59e0b;
  --snk: #ef4444;

  --radius: 0.5rem;
  --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --sans: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
:root[data-theme='light'] {
  /* primitives — light (aliases recompute automatically) */
  --bg-hsl: 0 0% 100%;
  --card-hsl: 0 0% 100%;
  --band-hsl: 215 16% 96.5%;
  --muted-hsl: 215 10% 94%;
  --fg-hsl: 215 14% 8%;
  --muted-fg-hsl: 215 6% 58%;
  --border-hsl: 215 10% 88%;
  --border-strong-hsl: 215 8% 76%;
  --brand-hsl: 0 72% 46%;

  /* code/syntax tokens — light */
  --code-bg: #f9fafb;
  --code-text: #3f3f46;
  --code-keyword: #7c3aed;
  --code-fn: #0284c7;
  --code-string: #dc2626;
  --code-line-num: #52525b;
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { background: var(--bg); color: var(--fg); font-family: var(--sans); }
/* Taint path: monochrome red, intensity shows direction — faint path, stronger current, strongest sink. */
.taint-faint { background: hsl(var(--brand-hsl) / 0.12); border-radius: 2px; }
.taint-current { background: hsl(var(--brand-hsl) / 0.30); border-radius: 2px; }
.taint-sink { background: hsl(var(--brand-hsl) / 0.45); border-radius: 2px; }
.taint-arrow::before { content: '▶'; color: hsl(var(--brand-hsl)); padding-left: 2px; font-size: 10px; }
.rule-focus { background: var(--sel-weak); border-left: 2px solid var(--accent); }
```

- [ ] **Step 2: Run the full suite (guards against alias breakage)**

Run: `npm test`
Expected: PASS — all existing tests green (no test asserts CSS values; `theme.test.ts` exercises store logic only).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manual visual check**

Run: `npm run dev`, open the app, toggle the theme (☀/☾).
Expected: dark = cool near-black with red accents; light = white with red accents; sidebar/topbar/borders/active rows all themed; no unstyled (black-on-black or invisible) regions.

- [ ] **Step 5: Commit**

```bash
git add src/theme.css
git commit -m "feat: adopt opentaint.org design tokens (light + dark) and red taint highlight"
```

---

## Task 3: Severity badge — red-mono scale (and retire legacy taint vars)

**Files:**
- Modify: `src/components/SeverityBadge.module.css`
- Modify: `src/theme.css` (remove now-unused `--src/--mid/--snk`)

- [ ] **Step 1: Recolor the badge to one red ramp**

Replace `src/components/SeverityBadge.module.css` with:
```css
.badge { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; padding: 1px 6px; border-radius: 10px; border: 1px solid currentColor; }
.error { color: hsl(var(--brand-hsl)); }
.warning { color: hsl(var(--brand-hsl) / 0.72); }
.note { color: var(--fg-dim); }
```

- [ ] **Step 2: Remove the legacy taint role colors from theme.css**

In `src/theme.css`, delete these three lines from the dark `:root` block (now referenced by nothing):
```css
  --src: #22c55e;
  --mid: #f59e0b;
  --snk: #ef4444;
```
And delete the `/* legacy taint role colors ... */` comment above them.

- [ ] **Step 3: Verify nothing else referenced them**

Run: `grep -rn -- '--src\|--mid\|--snk' src/`
Expected: no output (zero matches).

- [ ] **Step 4: Run severity test + full suite**

Run: `npm test -- SeverityBadge` then `npm test`
Expected: PASS (badge renders the label; whole suite green).

- [ ] **Step 5: Commit**

```bash
git add src/components/SeverityBadge.module.css src/theme.css
git commit -m "feat: brand-red mono severity scale; drop legacy taint role vars"
```

---

## Task 4: Monaco editor theme data (pure module, TDD)

Create a pure module holding the two Monaco theme definitions and a name helper, so we can test it without mounting Monaco. Monaco token-rule `foreground` values are 6-char hex **without** `#`; `colors` values keep `#`.

**Files:**
- Create: `src/components/monacoThemes.ts`
- Test: `src/components/monacoThemes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/monacoThemes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { otDark, otLight, monacoThemeName } from './monacoThemes';

describe('monacoThemes', () => {
  it('maps the app theme to a registered Monaco theme name', () => {
    expect(monacoThemeName('light')).toBe('ot-light');
    expect(monacoThemeName('dark')).toBe('ot-dark');
  });

  it('dark theme extends vs-dark with the brand code background', () => {
    expect(otDark.base).toBe('vs-dark');
    expect(otDark.colors['editor.background']).toBe('#15181e');
    expect(otDark.colors['editorLineNumber.foreground']).toBe('#a1a1aa');
  });

  it('light theme extends vs with the violet keyword color (no leading #)', () => {
    expect(otLight.base).toBe('vs');
    const keyword = otLight.rules.find((r) => r.token === 'keyword');
    expect(keyword?.foreground).toBe('7c3aed');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- monacoThemes`
Expected: FAIL — cannot resolve `./monacoThemes`.

- [ ] **Step 3: Implement the module**

Create `src/components/monacoThemes.ts`:
```ts
import type { Theme } from '../state/theme';

/** Structural shape accepted by monaco.editor.defineTheme — kept local to avoid importing monaco types. */
export interface MonacoThemeData {
  base: 'vs' | 'vs-dark';
  inherit: boolean;
  rules: { token: string; foreground?: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

/** Token-rule colors are hex WITHOUT '#'; the `colors` map uses '#'. Values mirror theme.css code tokens. */
export const otDark: MonacoThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'd4d4d8' },
    { token: 'keyword', foreground: 'c4b5fd' },
    { token: 'type', foreground: 'c4b5fd' },
    { token: 'function', foreground: '7dd3fc' },
    { token: 'identifier.function', foreground: '7dd3fc' },
    { token: 'string', foreground: 'f87171' },
    { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
    { token: 'number', foreground: 'fca5a5' },
  ],
  colors: {
    'editor.background': '#15181e',
    'editor.foreground': '#d4d4d8',
    'editorLineNumber.foreground': '#a1a1aa',
    'editorLineNumber.activeForeground': '#d4d4d8',
  },
};

export const otLight: MonacoThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: '', foreground: '3f3f46' },
    { token: 'keyword', foreground: '7c3aed' },
    { token: 'type', foreground: '7c3aed' },
    { token: 'function', foreground: '0284c7' },
    { token: 'identifier.function', foreground: '0284c7' },
    { token: 'string', foreground: 'dc2626' },
    { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
    { token: 'number', foreground: 'b91c1c' },
  ],
  colors: {
    'editor.background': '#f9fafb',
    'editor.foreground': '#3f3f46',
    'editorLineNumber.foreground': '#52525b',
    'editorLineNumber.activeForeground': '#3f3f46',
  },
};

export function monacoThemeName(theme: Theme): 'ot-light' | 'ot-dark' {
  return theme === 'light' ? 'ot-light' : 'ot-dark';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- monacoThemes`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/monacoThemes.ts src/components/monacoThemes.test.ts
git commit -m "feat: define ot-light/ot-dark Monaco theme data"
```

---

## Task 5: Wire the custom theme into CodeView

**Files:**
- Modify: `src/components/CodeView.tsx:1-24` (imports + theme selector), `:104-112` (Editor props)

- [ ] **Step 1: Import the theme module and select by app theme**

In `src/components/CodeView.tsx`, add the import after the existing imports (line 7 area):
```tsx
import { otDark, otLight, monacoThemeName } from './monacoThemes';
```
Replace line 24:
```tsx
  const monacoTheme = useTheme((s) => (s.theme === 'light' ? 'vs' : 'vs-dark'));
```
with:
```tsx
  const monacoTheme = useTheme((s) => monacoThemeName(s.theme));
```

- [ ] **Step 2: Register the themes before mount and set the editor font**

In `src/components/CodeView.tsx`, replace the `<Editor … />` (lines ~105-112) with:
```tsx
        <Editor
          path={file.path}
          language={MONACO_LANG[file.language] ?? 'plaintext'}
          value={file.content}
          theme={monacoTheme}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('ot-dark', otDark);
            monaco.editor.defineTheme('ot-light', otLight);
          }}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            glyphMargin: true,
            fontSize: 13,
            fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
            automaticLayout: true,
          }}
          onMount={onMount}
        />
```

- [ ] **Step 3: Run CodeView tests (mock ignores beforeMount/theme)**

Run: `npm test -- CodeView`
Expected: PASS (renders file, shows tabs, applies decorations — unaffected by the new props).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS (no TS errors on the `beforeMount` monaco arg).

- [ ] **Step 5: Manual check**

`npm run dev`: open a finding, view code in both themes.
Expected: keywords violet, functions blue, strings red; editor background matches the surrounding panel (#15181e dark / #f9fafb light); editor uses JetBrains Mono; theme follows the toggle.

- [ ] **Step 6: Commit**

```bash
git add src/components/CodeView.tsx
git commit -m "feat: apply brand-matched Monaco theme + JetBrains Mono in the code view"
```

---

## Task 6: Install CTA → copyable curl chip (TDD)

**Files:**
- Rewrite: `src/components/TopBar.tsx`
- Rewrite: `src/components/TopBar.module.css`
- Modify: `src/components/TopBar.test.tsx`

- [ ] **Step 1: Update the tests (failing) for the new CTA + copy behavior**

Replace `src/components/TopBar.test.tsx` with:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from './TopBar';
import { useTheme } from '../state/theme';

const CMD = 'curl -fsSL https://opentaint.org/install.sh | bash';

describe('TopBar', () => {
  it('shows the install command and links the brand to opentaint.org', () => {
    render(<TopBar onShare={() => {}} />);
    expect(screen.getByText(CMD)).toBeInTheDocument();
    const brand = screen.getByRole('link', { name: /opentaint/i });
    expect(brand).toHaveAttribute('href', expect.stringContaining('opentaint.org'));
  });

  it('copies the install command to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<TopBar onShare={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /copy install command/i }));
    expect(writeText).toHaveBeenCalledWith(CMD);
  });

  it('does not throw when the clipboard API is unavailable', async () => {
    Object.assign(navigator, { clipboard: undefined });
    render(<TopBar onShare={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /copy install command/i }));
    expect(screen.getByText(CMD)).toBeInTheDocument();
  });

  it('clicking Share invokes the onShare handler', async () => {
    const onShare = vi.fn();
    render(<TopBar onShare={onShare} />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(onShare).toHaveBeenCalledOnce();
  });

  it('toggles the theme', async () => {
    useTheme.getState().setTheme('dark');
    render(<TopBar onShare={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /toggle theme/i }));
    expect(useTheme.getState().theme).toBe('light');
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- TopBar`
Expected: FAIL — old TopBar still renders the "Install the CLI" link, not the command text / copy button.

- [ ] **Step 3: Rewrite the component**

Replace `src/components/TopBar.tsx` with:
```tsx
import { useState } from 'react';
import { useTheme } from '../state/theme';
import styles from './TopBar.module.css';

const INSTALL_CMD = 'curl -fsSL https://opentaint.org/install.sh | bash';
const SITE_URL = 'https://opentaint.org/';

export function TopBar({ onShare }: { onShare: () => void }) {
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.bar} data-testid="top-bar">
      <a className={styles.brand} href={SITE_URL} target="_blank" rel="noreferrer">
        <span className={styles.dot} aria-hidden="true">●</span> opentaint
      </a>
      <span className={styles.grow} />
      <button
        className={styles.pill}
        aria-label="Toggle theme"
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <button className={styles.pill} onClick={onShare}>share</button>
      <div className={styles.install}>
        <code className={styles.cmd}>{INSTALL_CMD}</code>
        <button
          className={styles.copy}
          aria-label="Copy install command"
          title={copied ? 'Copied!' : 'Copy'}
          onClick={copy}
        >
          {copied ? '✓' : '⧉'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite the styles**

Replace `src/components/TopBar.module.css` with:
```css
.bar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--bg-3); border-bottom: 1px solid var(--border); font-family: var(--mono); }
.brand { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; letter-spacing: -.02em; color: var(--fg); text-decoration: none; }
.dot { color: var(--accent); font-size: 10px; }
.grow { flex: 1; }
.pill { background: var(--bg-2); color: var(--fg); border: 1px solid var(--border); border-radius: 8px; padding: 3px 10px; font-size: 12px; font-family: var(--mono); cursor: pointer; }
.pill:hover { border-color: var(--accent); }
.install { display: inline-flex; align-items: center; gap: 6px; background: var(--bg); border: 1px solid var(--accent); border-radius: 8px; padding: 2px 4px 2px 10px; }
.cmd { font-family: var(--mono); font-size: 12px; color: var(--fg); white-space: nowrap; }
.copy { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 3px 8px; cursor: pointer; font-size: 12px; }
.copy:hover { filter: brightness(1.08); }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- TopBar`
Expected: PASS (5 tests).

- [ ] **Step 6: Build + manual check**

Run: `npm run build`, then `npm run dev`.
Expected: top bar shows `● opentaint`, theme/share pills, and a red-bordered command chip; clicking copy shows ✓ briefly; brand opens opentaint.org.

- [ ] **Step 7: Commit**

```bash
git add src/components/TopBar.tsx src/components/TopBar.module.css src/components/TopBar.test.tsx
git commit -m "feat: copyable curl install chip + opentaint wordmark in the top bar"
```

---

## Task 7: Targeted polish — active row accent + steps breathing room

**Files:**
- Modify: `src/components/FindingsTree.module.css:9`
- Modify: `src/components/StepsList.module.css`

- [ ] **Step 1: Add a brand left-accent to the active finding (no layout shift)**

In `src/components/FindingsTree.module.css`, replace line 9:
```css
.finding.activeFinding { background: var(--sel-weak); }
```
with:
```css
.finding.activeFinding { background: var(--sel-weak); box-shadow: inset 2px 0 0 var(--accent); }
```

- [ ] **Step 2: Loosen StepsList row density**

In `src/components/StepsList.module.css`, replace line 2:
```css
.step { padding: 5px 10px; cursor: pointer; border-left: 2px solid transparent; }
```
with:
```css
.step { padding: 7px 10px; cursor: pointer; border-left: 2px solid transparent; }
```
and replace line 12:
```css
.label { color: var(--fg-dim); line-height: 1.4; margin-top: 2px; padding-left: 24px; }
```
with:
```css
.label { color: var(--fg-dim); line-height: 1.5; margin-top: 3px; padding-left: 24px; }
```
(The active step's red left-accent already comes free — `.step.active` uses `border-left-color: var(--accent)`, which is now brand red.)

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS (StepsList/FindingsTree tests unaffected — class names unchanged).

- [ ] **Step 4: Build + manual check**

Run: `npm run build`, then `npm run dev`.
Expected: the selected finding shows a red left accent bar; the steps list feels less cramped; both themes still correct.

- [ ] **Step 5: Commit**

```bash
git add src/components/FindingsTree.module.css src/components/StepsList.module.css
git commit -m "feat: brand left-accent on active finding; loosen steps list density"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full unit suite**

Run: `npm test`
Expected: PASS (all suites, including the new monacoThemes and updated TopBar tests).

- [ ] **Step 2: Coverage (project standard)**

Run: `npm run coverage`
Expected: PASS; coverage not regressed below the existing threshold.

- [ ] **Step 3: Type + production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: E2E**

Run: `npm run e2e`
Expected: PASS — selectors are id/role-based and unchanged.

- [ ] **Step 5: Manual brand parity pass**

`npm run dev`. Side-by-side with opentaint.org, confirm in **both** themes: red accent, JetBrains Mono everywhere, cool near-black dark / white light, flat borders (no shadows), monochrome-red taint path, red-mono severity badges, install chip.

- [ ] **Step 6: Final commit (if any manual nudges were needed)**

```bash
git add -A
git commit -m "chore: finalize brand-match reskin"
```

---

## Self-Review

**Spec coverage:**
- Token architecture (light+dark, alias re-point, `--radius`) → Task 2. ✓
- JetBrains Mono via @fontsource → Task 1. ✓
- Component restyle (flat, tokens) → falls out of Task 2 alias re-point; explicit touches in Tasks 6–7. ✓
- Severity red-mono scale → Task 3. ✓
- Taint monochrome red → Task 2 (taint classes). ✓
- Monaco custom theme → Tasks 4–5. ✓
- Install curl chip → Task 6. ✓
- Targeted layout tweaks (slimmer top bar in Task 6 CSS; tree/steps spacing + active accent in Task 7). ✓
- Testing strategy → per-task tests + Task 8. ✓

**Placeholder scan:** None. Every code/CSS step shows exact before/after content with real selectors (StepsList lines 2 and 12 read and quoted verbatim). No "TBD", "handle edge cases", or adapt-in-place steps remain.

**Type consistency:** `monacoThemeName(theme: Theme)` returns `'ot-light' | 'ot-dark'`, matching the `defineTheme` names registered in CodeView Step 2 and the `theme` prop. `MonacoThemeData.rules[].foreground` are #-less hex; `colors` values include #. `INSTALL_CMD` string is identical across `TopBar.tsx` and `TopBar.test.tsx` (`CMD`). Alias names used in new CSS (`--bg`, `--bg-2`, `--accent`, `--mono`, `--sel-weak`) all exist after Task 2.
