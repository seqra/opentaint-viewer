#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseArgs } from './args';
import { generateContent } from './generateContent';
import { resolveSourceRoot, resolveBuiltinRulesDir } from './resolve';
import { injectContent } from './render';
import { loadTemplate } from './template';
import { serve } from './serve';
import type { ViewerContent } from '../types/content';

const USAGE = `opentaint-viewer <serve|export> --sarif <file> [options]

  --sarif <file>          SARIF report (required)
  --src <dir>             source root (default: SARIF %SRCROOT%, else the SARIF's directory)
  --builtin-rules <dir>   builtin ruleset dir (default: ../lib/rules next to the opentaint binary on PATH, else next to this CLI)
  --rules <dir>           custom ruleset dir (optional; your project's own rules)
  --name <id>             project name shown in the UI (default: basename of source root)

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

  let sarifLog: unknown;
  try {
    sarifLog = JSON.parse(readFileSync(sarifPath, 'utf8'));
  } catch (err) {
    fail(`--sarif is not valid JSON (${sarifPath}): ${err instanceof Error ? err.message : err}`);
  }
  const srcRoot = resolveSourceRoot(sarifLog as Parameters<typeof resolveSourceRoot>[0], sarifPath, str(args.src));
  const rulesDir = resolveBuiltinRulesDir(cliUrl, str(args['builtin-rules']));
  if (!existsSync(rulesDir)) fail(`builtin rules dir not found: ${rulesDir} (pass --builtin-rules <dir>)`);
  const customArg = str(args.rules);
  const customRulesDir = customArg !== undefined ? resolve(customArg) : undefined;
  if (customRulesDir !== undefined && !existsSync(customRulesDir)) {
    fail(`custom rules dir not found: ${customRulesDir} (pass --rules <dir>)`);
  }

  const projectId = str(args.name) ?? basename(srcRoot);
  const content = generateContent({ sarifLog, srcDir: srcRoot, root: srcRoot, rulesDir, customRulesDir, projectId });

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
  let port = 5151;
  const rawPort = str(args.port);
  if (rawPort !== undefined) {
    port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      fail(`--port must be an integer between 1 and 65535, got: ${rawPort}`);
    }
  }
  await serve(html, { port, open: args.open !== false });
}

main().catch((err) => {
  console.error('opentaint-viewer failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
