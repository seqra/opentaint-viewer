import { useMemo } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useStore } from '../state/store';
import { fileByPath, findingById } from '../content/loadContent';
import { decorationsForFile } from '../taint/decorations';

const MONACO_LANG: Record<string, string> = {
  java: 'java', kotlin: 'kotlin', yaml: 'yaml', xml: 'xml', properties: 'ini', plaintext: 'plaintext',
};

export function CodeView() {
  const content = useStore((s) => s.content);
  const activeFile = useStore((s) => s.activeFile);
  const activeFindingId = useStore((s) => s.activeFindingId);
  const selectFile = useStore((s) => s.selectFile);

  const finding = content && activeFindingId ? findingById(content, activeFindingId) : undefined;
  const file = content && activeFile ? fileByPath(content, activeFile) : undefined;

  const tabFiles = useMemo(() => {
    const set = new Set(finding?.steps.map((s) => s.file) ?? []);
    if (activeFile) set.add(activeFile);
    return [...set];
  }, [finding, activeFile]);

  const onMount: OnMount = (editor, monaco) => {
    if (!finding || !activeFile) return;
    const decos = decorationsForFile(finding.steps, activeFile);
    editor.createDecorationsCollection(
      decos.map((d) => ({
        range: new monaco.Range(d.line, 1, d.line, 1),
        options: { isWholeLine: true, className: d.className, glyphMarginClassName: d.className, linesDecorationsClassName: d.className },
      })),
    );
  };

  if (!file) return null;
  return (
    <div data-testid="code-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div role="tablist" style={{ display: 'flex', background: 'var(--bg-2)', fontSize: 11 }}>
        {tabFiles.map((path) => (
          <button
            key={path}
            role="tab"
            aria-selected={path === activeFile}
            onClick={() => selectFile(path)}
            style={{ padding: '4px 10px', background: path === activeFile ? 'var(--bg)' : 'transparent', color: 'var(--fg-dim)', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer' }}
          >
            {path.split('/').pop()}
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <Editor
          path={file.path}
          language={MONACO_LANG[file.language] ?? 'plaintext'}
          value={file.content}
          theme="vs-dark"
          options={{ readOnly: true, minimap: { enabled: false }, glyphMargin: true, fontSize: 13 }}
          onMount={onMount}
        />
      </div>
    </div>
  );
}
