#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseArgs } from './args';
import { generateContent } from './generateContent';
import { resolveSourceRoot, resolveRulesDir } from './resolve';
import { injectContent } from './render';
import { loadTemplate } from './template';
import { serve } from './serve';
import type { ViewerContent } from '../types/content';

const USAGE = `opentaint-viewer <serve|export> --sarif <file> [options]

  --sarif <file>   SARIF report (required)
  --src <dir>      source root (default: SARIF %SRCROOT%, else the SARIF's directory)
  --rules <dir>    ruleset dir (default: ../lib/rules relative to the CLI)
  --name <id>      project name shown in the UI (default: basename of source root)

serve:   --port <n> (default 5151)   --no-open
export:  --out <file> (default opentaint-report.html)`;

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function str(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function buildContent(args: Record<string, string | boolean>, cliUrl: string): ViewerContent {
  const sarifPath = str(args.sarif);
  if (!sarifPath) fail('--sarif is required\n\n' + USAGE);
  if (!existsSync(sarifPath)) fail(`--sarif not found: ${sarifPath}`);

  const sarifLog = JSON.parse(readFileSync(sarifPath, 'utf8'));
  const srcRoot = resolveSourceRoot(sarifLog, sarifPath, str(args.src));
  const rulesDir = resolveRulesDir(cliUrl, str(args.rules));
  if (!existsSync(rulesDir)) fail(`rules dir not found: ${rulesDir} (pass --rules <dir>)`);

  const projectId = str(args.name) ?? basename(srcRoot);
  const content = generateContent({ sarifLog, srcDir: srcRoot, root: srcRoot, rulesDir, projectId });

  const referenced = new Set(content.findings.flatMap((f) => f.flows.flatMap((fl) => fl.steps.map((s) => s.file))));
  if (referenced.size > 0 && content.files.length === 0) {
    fail(`no source files found under ${srcRoot}; pass --src <dir>`);
  }
  return content;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== 'serve' && command !== 'export') {
    console.error(USAGE);
    process.exit(command ? 1 : 0);
  }
  const args = parseArgs(rest);
  const content = buildContent(args, import.meta.url);
  const html = injectContent(loadTemplate(import.meta.url), content);

  if (command === 'export') {
    const out = resolve(str(args.out) ?? 'opentaint-report.html');
    writeFileSync(out, html);
    console.log(`Wrote ${out}: ${content.findings.length} findings, ${content.files.length} files`);
    return;
  }
  await serve(html, {
    port: str(args.port) ? Number(str(args.port)) : 5151,
    open: args.open !== false,
  });
}

main().catch((err) => {
  console.error('opentaint-viewer failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
