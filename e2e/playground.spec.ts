import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Derive expectations from the real committed content so the test survives regen.
interface Step { file: string; label: string }
interface Finding { id: string; ruleId: string; vulnClass: string; location: string; steps: Step[] }
interface Content { scenarios: { defaultFindingId: string; startFile: string }[]; findings: Finding[] }

const content: Content = JSON.parse(readFileSync('src/content/java-spring-demo.json', 'utf8'));
const scenario = content.scenarios[0];
const active = content.findings.find((f) => f.id === scenario.defaultFindingId)!;
const location = active.location; // unique to the finding row (vuln class also appears in the filter select)
const startBase = scenario.startFile.split('/').pop()!;
const lastStep = active.steps[active.steps.length - 1];
const sinkBase = lastStep.file.split('/').pop()!;
const stepText = lastStep.label.slice(0, 30);

test('explore a finding, jump cross-file, split, and share', async ({ page }) => {
  await page.goto('/');

  // The first scenario's finding is visible on first paint (its location is unique to
  // the finding row; the vuln class also appears in selects).
  await expect(page.getByTestId('findings-tree').getByText(location)).toBeVisible();

  // Code view shows the scenario's start file as a tab.
  await expect(page.getByRole('tab', { name: startBase })).toBeVisible();

  // Click the sink step -> active file switches to the sink's file (cross-file jump).
  await page.getByTestId('findings-tree').getByText(stepText).first().click();
  await expect(page.getByRole('tab', { name: sinkBase })).toHaveAttribute('aria-selected', 'true');

  // Toggle split -> both Code and Rules render. Scoped to the editor area because
  // rule leaves in the sidebar (e.g. http-response-splitting-sinks.yaml) also match /split/i.
  await page.getByTestId('editor-area').getByRole('button', { name: /split/i }).click();
  await expect(page.getByTestId('code-view')).toBeVisible();
  await expect(page.getByTestId('rules-view')).toBeVisible();

  // Share -> URL has a hash.
  await page.getByTestId('top-bar').getByRole('button', { name: /share/i }).click();
  const url = await page.getByTestId('share-url').inputValue();
  expect(url).toContain('#');

  // Reopen the shared URL -> split mode restored.
  await page.goto(url);
  await expect(page.getByTestId('rules-view')).toBeVisible();
});

test('the rule link opens the rule file and focuses the specific rule', async ({ page }) => {
  await page.goto('/');

  // Click the rule id in the finding info panel.
  await page.getByTestId('finding-info').getByRole('button', { name: active.ruleId }).click();

  // The rule file opens and the specific rule line is highlighted (a file holds many rules).
  await expect(page.getByTestId('rules-view')).toBeVisible();
  await expect(page.locator('.rule-focus').first()).toBeVisible();
});
