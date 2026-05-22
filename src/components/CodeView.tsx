import { useEffect, useMemo, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useStore } from '../state/store';
import { fileByPath, findingById } from '../content/loadContent';
import { pathDecorations } from '../taint/decorations';
import { fileTabLabel } from './fileTabLabel';
import { StepNav } from './StepNav';

const MONACO_LANG: Record<string, string> = {
  java: 'java', kotlin: 'kotlin', yaml: 'yaml', xml: 'xml', properties: 'ini', plaintext: 'plaintext',
};

/** Minimal handle for a Monaco decoration collection — avoids pulling in the full monaco-editor types. */
interface DecorationCollection {
  clear: () => void;
}

export function CodeView() {
  const content = useStore((s) => s.content);
  const activeFile = useStore((s) => s.activeFile);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const activeStepIndex = useStore((s) => s.activeStepIndex);
  const selectFile = useStore((s) => s.selectFile);

  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  const file = content && activeFile ? fileByPath(content, activeFile) : undefined;

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
    const decos = pathDecorations(finding.steps, activeFile, activeStepIndex ?? 0);
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
      <StepNav />
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
