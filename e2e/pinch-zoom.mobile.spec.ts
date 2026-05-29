import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface Finding { id: string; location: string; file: string }
interface Content { findings: Finding[] }
const content: Content = JSON.parse(readFileSync('data/content.json', 'utf8'));
const target = content.findings[1];

// The tree opens folded on mobile — expand the finding's file before tapping it.
const selectTarget = async (page: import('@playwright/test').Page) => {
  await page.getByTestId('findings-tree').locator(`[data-file="${target.file}"]`).tap();
  await page.getByTestId('findings-tree').getByText(target.location).tap();
};

const readZoom = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('ot-view') || '{}').state?.editorZoom ?? 100);

// Drive the editor box's real touch listeners with a synthetic two-finger pinch.
// Engine-agnostic (CDP multi-touch is Chromium-only, but the mobile project is WebKit).
const pinch = (page: import('@playwright/test').Page, gaps: number[]) =>
  page.evaluate((gaps) => {
    const box = document.querySelector('[data-testid="code-view"]')!.lastElementChild!;
    const r = box.getBoundingClientRect();
    const cy = r.top + r.height / 2;
    const cx = r.left + r.width / 2;
    const fire = (type: string, gap: number, count = 2) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'touches', {
        value: count === 0 ? [] : [
          { clientX: cx - gap / 2, clientY: cy },
          { clientX: cx + gap / 2, clientY: cy },
        ],
      });
      box.dispatchEvent(e);
    };
    fire('touchstart', gaps[0]);
    for (const g of gaps.slice(1)) fire('touchmove', g);
    fire('touchend', 0, 0);
  }, gaps);

test('mobile: two-finger pinch zooms the editor in and out', async ({ page }) => {
  await page.goto('/');
  // Select a finding so the Code tab mounts the editor.
  await page.getByTestId('top-bar-menu').tap();
  await selectTarget(page);
  await expect(page.getByTestId('mobile-drawer')).not.toBeVisible();
  await page.locator('.monaco-editor').first().waitFor();

  const before = await readZoom(page);
  await pinch(page, [40, 80, 140, 200]); // spread the fingers → zoom in
  const zoomedIn = await readZoom(page);
  expect(zoomedIn).toBeGreaterThan(before);

  await pinch(page, [200, 140, 80, 30]); // close the fingers → zoom out
  const zoomedOut = await readZoom(page);
  expect(zoomedOut).toBeLessThan(zoomedIn);
});

test('mobile: the Code-tab flow selector is hidden (Details › Steps owns it)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('top-bar-menu').tap();
  await selectTarget(page);
  await expect(page.getByTestId('mobile-tab-code')).toHaveAttribute('aria-selected', 'true');
  const flowNav = page.getByTestId('flow-nav');
  if (await flowNav.count()) await expect(flowNav).not.toBeVisible();
});
