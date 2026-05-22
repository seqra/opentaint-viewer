import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useStore } from '../state/store';
import { fileByPath, findingById } from '../content/loadContent';
import { pathDecorations } from '../taint/decorations';
import { fileTabLabel } from './fileTabLabel';

const MONACO_LANG: Record<string, string> = {
  java: 'java', kotlin: 'kotlin', yaml: 'yaml', xml: 'xml', properties: 'ini', plaintext: 'plaintext',
};

interface DecorationCollection {
  clear: () => void;
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
  const atStart = cur <= 0;
  const atEnd = cur >= stepCount - 1;

  const tabFiles = useMemo(() => {
    const set = new Set(finding?.steps.map((s) => s.file) ?? []);
    if (activeFile) set.add(activeFile);
    return [...set];
  }, [finding, activeFile]);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decoRef = useRef<DecorationCollection | null>(null);

  const applyDecorations = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    decoRef.current?.clear();
    if (!finding || !activeFile) return;
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
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    applyDecorations();
  };

  useEffect(() => {
    applyDecorations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFindingId, activeFile, activeStepIndex]);

  if (!file) return null;
  return (
    <div data-testid="code-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', fontSize: 11, fontFamily: 'var(--mono)' }}>
        <div role="tablist" style={{ display: 'flex', minWidth: 0, overflowX: 'auto' }}>
          {tabFiles.map((path) => (
            <button
              key={path}
              role="tab"
              aria-selected={path === activeFile}
              onClick={() => selectFile(path)}
              style={{ padding: '4px 10px', whiteSpace: 'nowrap', background: path === activeFile ? 'var(--bg)' : 'transparent', color: 'var(--fg-dim)', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer' }}
            >
              {fileTabLabel(path, tabFiles)}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {finding && (
          <div data-testid="step-nav" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 6px' }}>
            <button type="button" title="First step (Home)" disabled={atStart} onClick={() => step('start')} style={navBtn}>⏮</button>
            <button type="button" title="Back over a call (Shift+←)" disabled={atStart} onClick={() => step('backOver')} style={navBtn}>⏪</button>
            <button type="button" title="Back (←)" disabled={atStart} onClick={() => step('back')} style={navBtn}>◀</button>
            <button type="button" title="Out, back to the caller (↑)" disabled={atStart} onClick={() => step('out')} style={navBtn}>⤴</button>
            <button type="button" title="Next (→)" disabled={atEnd} onClick={() => step('next')} style={navBtn}>▶</button>
            <button type="button" title="Next over a call (Shift+→)" disabled={atEnd} onClick={() => step('nextOver')} style={navBtn}>⏩</button>
            <button type="button" title="Last step (End)" disabled={atEnd} onClick={() => step('end')} style={navBtn}>⏭</button>
            <span style={{ color: 'var(--fg-dim)', marginLeft: 4 }}>{cur + 1}/{stepCount}</span>
          </div>
        )}
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
  borderRadius: 4,
  padding: '1px 5px',
  cursor: 'pointer',
};
