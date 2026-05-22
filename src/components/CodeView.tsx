import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useStore } from '../state/store';
import { fileByPath, findingById } from '../content/loadContent';
import { pathDecorations } from '../taint/decorations';
import type { StepOp } from '../taint/nav';
import { fileTabLabel } from './fileTabLabel';

const MONACO_LANG: Record<string, string> = {
  java: 'java', kotlin: 'kotlin', yaml: 'yaml', xml: 'xml', properties: 'ini', plaintext: 'plaintext',
};

interface DecorationCollection {
  clear: () => void;
}

const LENS_OPS: [StepOp, string][] = [
  ['back', '◀ back'],
  ['in', '⤵ in'],
  ['over', '⤳ over'],
  ['out', '⤴ out'],
];

function buildLensNode(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'step-lens';
  for (const [op, label] of LENS_OPS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = `Step ${op}`;
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      useStore.getState().step(op);
    });
    el.appendChild(b);
  }
  return el;
}

export function CodeView() {
  const content = useStore((s) => s.content);
  const activeFile = useStore((s) => s.activeFile);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const activeStepIndex = useStore((s) => s.activeStepIndex);
  const selectFile = useStore((s) => s.selectFile);
  const step = useStore((s) => s.step);

  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  const file = content && activeFile ? fileByPath(content, activeFile) : undefined;
  const stepCount = finding?.steps.length ?? 0;
  const cur = activeStepIndex ?? 0;

  const tabFiles = useMemo(() => {
    const set = new Set(finding?.steps.map((s) => s.file) ?? []);
    if (activeFile) set.add(activeFile);
    return [...set];
  }, [finding, activeFile]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);
  const decoRef = useRef<DecorationCollection | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetRef = useRef<any>(null);
  const lensNodeRef = useRef<HTMLElement | null>(null);
  const lensLineRef = useRef<number>(1);

  const refresh = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    // Single-step highlight (current strong, path faint).
    decoRef.current?.clear();
    if (finding && activeFile) {
      const decos = pathDecorations(finding.steps, activeFile, cur);
      decoRef.current = editor.createDecorationsCollection(
        decos.map((d) => ({
          range: new monaco.Range(d.line, 1, d.line, 1),
          options: {
            isWholeLine: true,
            className: d.className,
            linesDecorationsClassName: d.className,
            glyphMarginClassName: d.glyphClassName,
          },
        })),
      ) as DecorationCollection;
      const current = decos.find((d) => d.isCurrent);
      if (current) editor.revealLineInCenter?.(current.line);
    }

    // Code-lens-style step controls anchored above the current step's line.
    if (!editor.addContentWidget || !monaco.editor) return;
    const currentStep = finding?.steps[cur];
    const onThisFile = currentStep && currentStep.file === activeFile;
    if (!onThisFile) {
      if (widgetRef.current) editor.removeContentWidget(widgetRef.current);
      return;
    }
    lensLineRef.current = currentStep!.line;
    if (!lensNodeRef.current) lensNodeRef.current = buildLensNode();
    if (!widgetRef.current) {
      widgetRef.current = {
        getId: () => 'taint.step.lens',
        getDomNode: () => lensNodeRef.current!,
        getPosition: () => ({
          position: { lineNumber: lensLineRef.current, column: 1 },
          preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE],
        }),
      };
      editor.addContentWidget(widgetRef.current);
    } else {
      editor.layoutContentWidget(widgetRef.current);
    }
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    refresh();
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFindingId, activeFile, activeStepIndex]);

  useEffect(
    () => () => {
      if (editorRef.current?.removeContentWidget && widgetRef.current) {
        editorRef.current.removeContentWidget(widgetRef.current);
      }
    },
    [],
  );

  if (!file) return null;
  return (
    <div data-testid="code-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', fontSize: 11, fontFamily: 'var(--mono)' }}>
        <button type="button" title="First step (Home)" disabled={!finding || cur <= 0} onClick={() => step('start')} style={navBtn}>⏮ start</button>
        <button type="button" title="Last step (End)" disabled={!finding || cur >= stepCount - 1} onClick={() => step('end')} style={navBtn}>⏭ end</button>
        {finding && <span style={{ color: 'var(--fg-dim)' }}>step {cur + 1}/{stepCount}</span>}
        <span style={{ marginLeft: 'auto', color: 'var(--fg-dim)' }}>←/→ step · Shift = over/out</span>
      </div>
      <div role="tablist" style={{ display: 'flex', background: 'var(--bg-2)', fontSize: 11 }}>
        {tabFiles.map((path) => (
          <button
            key={path}
            role="tab"
            aria-selected={path === activeFile}
            onClick={() => selectFile(path)}
            style={{ padding: '4px 10px', background: path === activeFile ? 'var(--bg)' : 'transparent', color: 'var(--fg-dim)', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer' }}
          >
            {fileTabLabel(path, tabFiles)}
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <Editor
          path={file.path}
          language={MONACO_LANG[file.language] ?? 'plaintext'}
          value={file.content}
          theme="vs-dark"
          options={{ readOnly: true, minimap: { enabled: false }, glyphMargin: true, fontSize: 13, automaticLayout: true }}
          onMount={onMount}
        />
      </div>
    </div>
  );
}

const navBtn: CSSProperties = {
  background: 'var(--bg-3)',
  color: 'var(--fg)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  padding: '2px 7px',
  cursor: 'pointer',
};
