import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Derive expectations from the real committed content so the test survives regen.
interface Step { file: string; label: string }
interface Flow { steps: Step[] }
interface Finding { id: string; ruleId: string; vulnClass: string; location: string; flows: Flow[]; defaultFlowIndex: number }
interface Content { scenarios: { defaultFindingId: string; startFile: string }[]; findings: Finding[] }

const content: Content = JSON.parse(readFileSync('src/content/java-spring-demo.json', 'utf8'));
const scenario = content.scenarios[0];
const active = content.findings.find((f) => f.id === scenario.defaultFindingId)!;
const activeSteps = active.flows[active.defaultFlowIndex].steps;
const location = active.location; // unique to the finding row (vuln class also appears in the filter select)
const startBase = scenario.startFile.split('/').pop()!;
const lastStep = activeSteps[activeSteps.length - 1];
const sinkBase = lastStep.file.split('/').pop()!;
const stepText = lastStep.label.slice(0, 30);

// The stored-XSS finding with two flows; used to exercise the flow picker.
const multiFlow = content.findings.find((f) => f.flows.length > 1 && f.location === 'MessageController.java:96')!;
const otherFlowIndex = multiFlow.defaultFlowIndex === 0 ? 1 : 0;
// A step label present in the default flow but not in the other flow (proves the switch changed the path).
const defaultOnlyLabel = multiFlow.flows[multiFlow.defaultFlowIndex].steps
  .map((s) => s.label)
  .find((l) => !multiFlow.flows[otherFlowIndex].steps.some((s) => s.label === l))!;

test('explore a finding, jump cross-file, and split', async ({ page }) => {
  await page.goto('/');

  // The first scenario's finding is visible on first paint (its location is unique to
  // the finding row; the vuln class also appears in selects).
  await expect(page.getByTestId('findings-tree').getByText(location)).toBeVisible();

  // Code view shows the scenario's start file as a tab.
  await expect(page.getByRole('tab', { name: startBase })).toBeVisible();

  // Open the Steps tab and click the sink step -> active file switches to the sink's file.
  await page.getByTestId('info-tab-steps').click();
  await page.getByTestId('steps-list').getByText(stepText).first().click();
  await expect(page.getByRole('tab', { name: sinkBase })).toHaveAttribute('aria-selected', 'true');

  // Toggle the editor layout -> both Code and Rules render. The info panel has its own
  // identical toggle, so scope to the editor area's layout-toggle.
  await page.getByTestId('editor-area').getByTestId('layout-toggle').click();
  await expect(page.getByTestId('code-view')).toBeVisible();
  await expect(page.getByTestId('rules-view')).toBeVisible();
});

test('the rule link opens the rule file and focuses the specific rule', async ({ page }) => {
  await page.goto('/');

  // Click the rule id in the finding info panel.
  await page.getByTestId('finding-info').getByRole('button', { name: active.ruleId }).click();

  // The rule file opens and the specific rule line is highlighted (a file holds many rules).
  // Generous timeouts: Monaco can be slow to mount + paint decorations on a cold load.
  await expect(page.getByTestId('rules-view')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.rule-focus').first()).toBeVisible({ timeout: 15000 });
});

test('`rule:` cross-references render as Cmd/Ctrl+click links in the rules editor', async ({ page }) => {
  await page.goto('/');

  // Open the default finding's rule file in the rules editor.
  await page.getByTestId('finding-info').getByRole('button', { name: active.ruleId }).click();
  await expect(page.getByTestId('rules-view')).toBeVisible({ timeout: 15000 });

  // Monaco renders detected links only for visible lines; scroll until a `rule:`
  // cross-reference link appears (its text is a `<path>.yaml#<rule>` token, which
  // distinguishes it from the plain http links the editor also detects).
  const refLink = page.locator('[data-testid="rules-view"] .detected-link').filter({ hasText: /\.yaml#/ });
  await page.locator('[data-testid="rules-view"] .monaco-scrollable-element').hover();
  for (let i = 0; i < 30 && (await refLink.count()) === 0; i++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(150);
  }
  await expect(refLink.first()).toBeVisible();
});

test('the activity bar toggles the Findings and Rules sidebars (mutually exclusive)', async ({ page }) => {
  await page.goto('/');

  // Findings is shown by default; the rules tree is not mounted.
  await expect(page.getByTestId('findings-tree')).toBeVisible();
  await expect(page.getByTestId('rules-tree')).toHaveCount(0);

  // Switch to Rules -> rules tree shows, findings tree is replaced (mutually exclusive).
  await page.getByTestId('activity-rules').click();
  await expect(page.getByTestId('rules-tree')).toBeVisible();
  await expect(page.getByTestId('findings-tree')).toHaveCount(0);

  // Click the active Rules button again -> the sidebar collapses (no tree shown).
  await page.getByTestId('activity-rules').click();
  await expect(page.getByTestId('rules-tree')).toHaveCount(0);
  await expect(page.getByTestId('findings-tree')).toHaveCount(0);

  // Click Findings -> the findings tree comes back.
  await page.getByTestId('activity-findings').click();
  await expect(page.getByTestId('findings-tree')).toBeVisible();
});

test('the theme toggle flips data-theme and keeps the editor mounted', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', /^(light|dark)$/);
  const before = await html.getAttribute('data-theme');

  await page.getByTestId('top-bar').getByRole('button', { name: /toggle theme/i }).click();

  // data-theme flips and the Monaco code editor survives the theme switch.
  await expect(html).not.toHaveAttribute('data-theme', before!);
  await expect(page.getByTestId('code-view')).toBeVisible();
});

test('dragging the sidebar handle closed then back open restores the tree (no blank panel)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('findings-tree')).toBeVisible();

  // The sidebar resize handle is the first separator. Collapse it and reopen it within a
  // single drag — the tree must come back, not leave a blank expanded panel.
  const handle = (await page.locator('[role="separator"]').first().boundingBox())!;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(handle.x + handle.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(2, y, { steps: 12 }); // far left -> collapses
  await page.mouse.move(320, y, { steps: 12 }); // back out -> reopens
  await page.mouse.up();

  await expect(page.getByTestId('findings-tree')).toBeVisible();
});

test('view state survives a page refresh', async ({ page }) => {
  await page.goto('/');
  // Open the Rules sidebar and split the editor, then reload.
  await page.getByTestId('activity-rules').click();
  await expect(page.getByTestId('rules-tree')).toBeVisible();
  await page.getByTestId('editor-area').getByTestId('layout-toggle').click();
  await expect(page.getByTestId('rules-view')).toBeVisible();

  await page.reload();

  // Restored from localStorage — the sidebar tree and the editor split are still there.
  await expect(page.getByTestId('rules-tree')).toBeVisible();
  await expect(page.getByTestId('rules-view')).toBeVisible();
});

test('switching code flow on MessageController.java:96 changes the taint path', async ({ page }) => {
  await page.goto('/');

  // Open the stored-XSS finding (two flows). Its location is unique to the finding row.
  await page.getByTestId('findings-tree').getByText(multiFlow.location).click();

  // Show the Steps list and the flow header (multi-flow only).
  await page.getByTestId('info-tab-steps').click();
  await expect(page.getByTestId('steps-flow-header')).toContainText('of 2');

  // The default flow shows a step the other flow does not.
  await expect(page.getByTestId('steps-list').getByText(defaultOnlyLabel.slice(0, 30)).first()).toBeVisible();

  // Switch flows via the editor nav; the default-only step disappears.
  const prev = page.getByTestId('flow-prev');
  const next = page.getByTestId('flow-next');
  await (multiFlow.defaultFlowIndex === 0 ? next : prev).click();
  await expect(page.getByTestId('steps-flow-header')).toContainText(`Flow ${otherFlowIndex + 1} of 2`);
  await expect(page.getByTestId('steps-list').getByText(defaultOnlyLabel.slice(0, 30))).toHaveCount(0);
});
