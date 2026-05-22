import { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useStore } from '../state/store';
import { useTheme } from '../state/theme';
import { findRuleLine } from '../rules/ruleLine';

type EditorInstance = Parameters<OnMount>[0];
type DecorationCollection = ReturnType<EditorInstance['createDecorationsCollection']>;

export function RulesView() {
  const content = useStore((s) => s.content);
  const activeRuleId = useStore((s) => s.activeRuleId);
  const activeRuleAnchor = useStore((s) => s.activeRuleAnchor);
  const ruleFocusTick = useStore((s) => s.ruleFocusTick);
  const monacoTheme = useTheme((s) => (s.theme === 'light' ? 'vs' : 'vs-dark'));
  const rule = content?.rules.find((r) => r.id === activeRuleId);

  const editorRef = useRef<EditorInstance | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decoRef = useRef<DecorationCollection | null>(null);

  // A rule file holds many rules; scroll to and highlight the one a finding hit.
  const focusRule = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !rule) return;
    decoRef.current?.clear();
    if (!activeRuleAnchor) return;
    const line = findRuleLine(rule.content, activeRuleAnchor);
    if (!line) return;
    decoRef.current = editor.createDecorationsCollection([
      { range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, className: 'rule-focus' } },
    ]);
    editor.revealLineInCenter?.(line);
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    focusRule();
  };

  useEffect(() => {
    focusRule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRuleId, activeRuleAnchor, ruleFocusTick, rule?.content]);

  if (!rule) return null;

  return (
    <div data-testid="rules-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontSize: 11, color: 'var(--fg-dim)', padding: '3px 8px', background: 'var(--bg-2)' }}>
        {rule.path.split('/').join(' › ')}
      </div>
      <div style={{ flex: 1 }}>
        <Editor
          path={rule.path}
          language="yaml"
          value={rule.content}
          theme={monacoTheme}
          onMount={onMount}
          options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
        />
      </div>
    </div>
  );
}
