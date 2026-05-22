import { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Mon from 'monaco-editor';
import { useStore } from '../state/store';
import { useTheme } from '../state/theme';
import { findRuleLine } from '../rules/ruleLine';
import { ruleRefs, ruleRefTarget, RULE_REF_SCHEME } from '../rules/ruleRefs';

type EditorInstance = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];
type DecorationCollection = ReturnType<EditorInstance['createDecorationsCollection']>;

/**
 * Register, once, a Monaco link provider + opener so each `rule:` cross-reference
 * in a rule file behaves like a URL link: underlined, Cmd/Ctrl+click to follow.
 * Following one navigates to the referenced file, anchored to the referenced rule.
 */
let linksRegistered = false;
function registerRuleRefLinks(monaco: Monaco) {
  if (linksRegistered) return;
  linksRegistered = true;

  monaco.languages.registerLinkProvider('yaml', {
    provideLinks: (model: Mon.editor.ITextModel) => ({
      links: ruleRefs(model.getValue()).map((r) => ({
        range: new monaco.Range(r.line, r.startColumn, r.line, r.endColumn),
        url: monaco.Uri.from({ scheme: RULE_REF_SCHEME, path: r.path, fragment: r.anchor ?? '' }),
        tooltip: `Open rule ${r.anchor ?? r.path}`,
      })),
    }),
  });

  monaco.editor.registerLinkOpener({
    open: (uri: Mon.Uri) => {
      const target = ruleRefTarget(uri.scheme, uri.path, uri.fragment);
      if (!target) return false;
      useStore.getState().selectRule(target.path, target.anchor);
      return true;
    },
  });
}

export function RulesView() {
  const content = useStore((s) => s.content);
  const activeRuleId = useStore((s) => s.activeRuleId);
  const activeRuleAnchor = useStore((s) => s.activeRuleAnchor);
  const ruleFocusTick = useStore((s) => s.ruleFocusTick);
  const monacoTheme = useTheme((s) => (s.theme === 'light' ? 'vs' : 'vs-dark'));
  const rule = content?.rules.find((r) => r.id === activeRuleId);

  const editorRef = useRef<EditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const focusDecoRef = useRef<DecorationCollection | null>(null);

  // A rule file holds many rules; scroll to and highlight the one a finding/link hit.
  const focusRule = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !rule) return;
    focusDecoRef.current?.clear();
    if (!activeRuleAnchor) return;
    const line = findRuleLine(rule.content, activeRuleAnchor);
    if (!line) return;
    focusDecoRef.current = editor.createDecorationsCollection([
      { range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, className: 'rule-focus' } },
    ]);
    editor.revealLineInCenter?.(line);
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerRuleRefLinks(monaco);
    focusRule();
  };

  useEffect(() => {
    focusRule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRuleId, activeRuleAnchor, ruleFocusTick, rule?.content]);

  if (!rule) return null;

  return (
    <div data-testid="rules-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div data-testid="rule-path" style={{ fontSize: 11, color: 'var(--fg-dim)', padding: '3px 8px', background: 'var(--bg-2)' }}>
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
