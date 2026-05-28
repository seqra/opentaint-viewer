// Capture the README hero screenshots — viewer in dark + light themes.
// Run with `npm run screenshots`. Spawns its own Vite dev server, drives
// the viewer with Playwright, writes PNGs under docs/screenshots/.

import { chromium, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';

interface Step { file: string; label: string }
interface Flow { steps: Step[] }
interface Finding { ruleId: string; vulnClass: string; location: string; flows: Flow[]; defaultFlowIndex: number }
interface Content { findings: Finding[] }

const OUT_DIR = 'docs/screenshots';
const PORT = 5175;
const URL = `http://localhost:${PORT}`;

const content: Content = JSON.parse(readFileSync('data/content.json', 'utf8'));
// Hero finding: 30 steps across 4 files — the richest taint flow in the demo.
const heroMaybe = content.findings.find((f) => f.location === 'MessageController.java:57');
if (!heroMaybe) throw new Error('hero finding (MessageController.java:57) not in content.json');
const hero: Finding = heroMaybe;
// Step in the middle of the flow so source + propagation decorations are both visible.
const heroSteps = hero.flows[hero.defaultFlowIndex].steps;
const midStep = heroSteps[Math.floor(heroSteps.length / 2)];

async function startServer(): Promise<ChildProcess> {
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  // Wait for Vite's "ready" line.
  await new Promise<void>((resolve, reject) => {
    const onExit = (code: number | null) => reject(new Error(`vite exited early (code ${code})`));
    server.once('exit', onExit);
    server.stdout!.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (text.includes('ready in') || text.includes(`localhost:${PORT}`)) {
        server.off('exit', onExit);
        resolve();
      }
    });
  });
  return server;
}

async function captureTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.addInitScript((t) => {
    try { localStorage.setItem('ot-theme', t); } catch { /* unavailable */ }
  }, theme);

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction((t) => document.documentElement.getAttribute('data-theme') === t, theme);

  // Open the hero finding (its location is unique in the tree).
  await page.getByTestId('findings-tree').getByText(hero.location).click();
  // Show the Steps panel — the ordered source → sink list is the money shot.
  await page.getByTestId('info-tab-steps').click();
  // Land mid-flow so blue propagation decorations are on screen.
  await page.getByTestId('steps-list').getByText(midStep.label.slice(0, 30)).first().click();

  // Monaco paints decorations on next frames; give it room before snapping.
  await wait(1200);

  const file = `${OUT_DIR}/viewer-${theme}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log(`wrote ${file}`);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const server = await startServer();
  try {
    const browser = await chromium.launch();
    try {
      // Both themes share viewport/scale so the two PNGs sit next to each other cleanly.
      const context = await browser.newContext({
        viewport: { width: 1600, height: 1000 },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      for (const theme of ['dark', 'light'] as const) {
        await context.clearCookies();
        await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } }).catch(() => { /* first run: no page yet */ });
        await captureTheme(page, theme);
      }
      await context.close();
    } finally {
      await browser.close();
    }
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
