import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { SkipBack, ChevronsLeft, ChevronLeft, CornerLeftUp, ChevronRight, ChevronsRight, SkipForward } from 'lucide-react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useStore } from '../state/store';
import { useTheme } from '../state/theme';
import { fileByPath, findingById } from '../content/loadContent';
import { pathDecorations } from '../taint/decorations';
import { fileTabLabel } from '../util/fileTabLabel';
import { otDark, otLight, monacoThemeName } from './monacoThemes';

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
  const monacoTheme = useTheme((s) => monacoThemeName(s.theme));

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

  const revealCurrentStep = () => {
    const editor = editorRef.current;
    if (!editor || !finding || !activeFile) return;
    const current = pathDecorations(finding.steps, activeFile, cur).find((d) => d.isCurrent);
    if (current) editor.revealLineInCenter?.(current.startLine);
  };

  const applyDecorations = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    decoRef.current?.clear();
    if (!finding || !activeFile) return;
    const decos = pathDecorations(finding.steps, activeFile, cur);
    decoRef.current = editor.createDecorationsCollection(
      decos.map((d) => ({
        range: new monaco.Range(d.startLine, d.startColumn, d.endLine, d.endColumn),
        options: d.wholeLine
          ? { isWholeLine: true, className: d.className, glyphMarginClassName: d.glyphClassName }
          : { inlineClassName: d.className, glyphMarginClassName: d.glyphClassName },
      })),
    ) as DecorationCollection;
    revealCurrentStep();
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    applyDecorations();
    // Inside resizable panels the editor can mount before it has its final height, so the
    // initial reveal lands off-centre. Re-centre once the first real layout arrives.
    const sub = editor.onDidLayoutChange?.(() => {
      sub?.dispose();
      revealCurrentStep();
    });
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
            <button type="button" title="First step (Home)" aria-label="First step" disabled={atStart} onClick={() => step('start')} style={navBtn}><SkipBack size={13} /></button>
            <button type="button" title="Back over a call (Shift+←)" aria-label="Back over a call" disabled={atStart} onClick={() => step('backOver')} style={navBtn}><ChevronsLeft size={13} /></button>
            <button type="button" title="Back (←)" aria-label="Back" disabled={atStart} onClick={() => step('back')} style={navBtn}><ChevronLeft size={13} /></button>
            <button type="button" title="Out, back to the caller (↑)" aria-label="Out to caller" disabled={atStart} onClick={() => step('out')} style={navBtn}><CornerLeftUp size={13} /></button>
            <button type="button" title="Next (→)" aria-label="Next" disabled={atEnd} onClick={() => step('next')} style={navBtn}><ChevronRight size={13} /></button>
            <button type="button" title="Next over a call (Shift+→)" aria-label="Next over a call" disabled={atEnd} onClick={() => step('nextOver')} style={navBtn}><ChevronsRight size={13} /></button>
            <button type="button" title="Last step (End)" aria-label="Last step" disabled={atEnd} onClick={() => step('end')} style={navBtn}><SkipForward size={13} /></button>
            <span style={{ color: 'var(--fg-dim)', marginLeft: 4 }}>
              {/* Reserve width for the current-step number so the nav doesn't shift at the 9→10 boundary. */}
              <span style={{ display: 'inline-block', minWidth: `${String(stepCount).length}ch`, textAlign: 'right' }}>{cur + 1}</span>/{stepCount}
            </span>
          </div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <Editor
          path={file.path}
          language={MONACO_LANG[file.language] ?? 'plaintext'}
          value={file.content}
          theme={monacoTheme}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('ot-dark', otDark);
            monaco.editor.defineTheme('ot-light', otLight);
          }}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            glyphMargin: true,
            fontSize: 13,
            // matches --mono in theme.css (Monaco can't read CSS vars)
            fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
            automaticLayout: true,
          }}
          onMount={onMount}
        />
      </div>
    </div>
  );
}

const navBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-3)',
  color: 'var(--fg)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '1px 5px',
  cursor: 'pointer',
};
