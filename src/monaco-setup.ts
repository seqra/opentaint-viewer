/**
 * Bundles Monaco locally instead of fetching it from a CDN, so the offline
 * single-file build (`npm run build:single`) needs no network at all.
 *
 * Only imported when MODE === 'singlefile' (see main.tsx); the hosted build keeps
 * loading Monaco from the CDN via @monaco-editor/loader, so its bundle stays lean.
 */
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
// `?worker&inline` bundles the worker as a base64 blob, so it inlines into the single file.
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline';
// Monarch grammars for the languages the playground shows (main-thread tokenization,
// so the base editor worker above is all we need).
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution';
import 'monaco-editor/esm/vs/basic-languages/kotlin/kotlin.contribution';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution';
import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
