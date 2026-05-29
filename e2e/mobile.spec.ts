import { test, expect } from '@playwright/test';

test('mobile golden path: drawer → finding → details/steps → step footer', async ({ page }) => {
  await page.goto('/');

  // The mobile shell is visible at the configured viewport.
  await expect(page.getByTestId('mobile-shell')).toBeVisible();

  // Open the drawer from the TopBar menu.
  await page.getByTestId('top-bar-menu').tap();
  await expect(page.getByTestId('mobile-drawer')).toBeVisible();
  await expect(page.getByTestId('findings-tree')).toBeVisible();

  // Pick a different finding than the default one (so selection actually changes —
  // re-tapping the active finding leaves activeFindingId unchanged and the drawer
  // would stay open). FindingsTree renders findings as role=button divs whose text
  // is the location string.
  const findings = page.getByTestId('findings-tree').getByRole('button');
  // The first role=button might be a fold row; pick a deeper one. Click any button
  // whose text matches a location-like pattern (contains ':' for "File.java:NN").
  const secondFinding = findings.filter({ hasText: /:\d/ }).nth(1);
  await secondFinding.tap();

  // Drawer closes; Code tab is active.
  await expect(page.getByTestId('mobile-drawer')).not.toBeVisible();
  await expect(page.getByTestId('mobile-tab-code')).toHaveAttribute('aria-selected', 'true');

  // Swap to Details and confirm the Info/Steps sub-tabs render.
  await page.getByTestId('mobile-tab-details').tap();
  await expect(page.getByTestId('info-tab-info')).toBeVisible();
  await expect(page.getByTestId('info-tab-steps')).toBeVisible();

  // Tap Steps; expect the steps list to render.
  await page.getByTestId('info-tab-steps').tap();
  await expect(page.getByTestId('steps-list')).toBeVisible();

  // Tap step footer Next; remain on Details (no surprise tab switch).
  await page.getByRole('button', { name: 'Next step' }).tap();
  await expect(page.getByTestId('mobile-tab-details')).toHaveAttribute('aria-selected', 'true');
});
