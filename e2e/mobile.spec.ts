import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface Finding { id: string; location: string }
interface Content { findings: Finding[] }

const content: Content = JSON.parse(readFileSync('data/content.json', 'utf8'));
// findings[0] is the default selection; pick findings[1] so the tap actually
// changes activeFindingId and the auto-close subscription fires.
const target = content.findings[1];

test('mobile golden path: drawer → finding → details/steps → step footer', async ({ page }) => {
  await page.goto('/');

  // The mobile shell is visible at the configured viewport.
  await expect(page.getByTestId('mobile-shell')).toBeVisible();

  // Open the drawer from the TopBar menu.
  await page.getByTestId('top-bar-menu').tap();
  await expect(page.getByTestId('mobile-drawer')).toBeVisible();
  await expect(page.getByTestId('findings-tree')).toBeVisible();

  // Tap a finding other than the default. Drawer closes; Code tab activates.
  await page.getByTestId('findings-tree').getByText(target.location).tap();
  await expect(page.getByTestId('mobile-drawer')).not.toBeVisible();
  await expect(page.getByTestId('mobile-tab-code')).toHaveAttribute('aria-selected', 'true');

  // Swap to Details and confirm the Info / Steps sub-tabs render.
  await page.getByTestId('mobile-tab-details').tap();
  await expect(page.getByTestId('info-tab-info')).toBeVisible();
  await expect(page.getByTestId('info-tab-steps')).toBeVisible();

  // Tap Steps; expect the steps list to render.
  await page.getByTestId('info-tab-steps').tap();
  await expect(page.getByTestId('steps-list')).toBeVisible();

  // Tap step footer Previous (the finding lands on the sink by default, so Prev
  // is the enabled direction). Remain on Details — no surprise tab switch.
  await page.getByRole('button', { name: 'Previous step' }).tap();
  await expect(page.getByTestId('mobile-tab-details')).toHaveAttribute('aria-selected', 'true');
});
