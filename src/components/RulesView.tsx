import Editor from '@monaco-editor/react';
import { useStore } from '../state/store';

export function RulesView() {
  const content = useStore((s) => s.content);
  const activeRuleId = useStore((s) => s.activeRuleId);
  const rule = content?.rules.find((r) => r.id === activeRuleId);
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
          theme="vs-dark"
          options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
        />
      </div>
    </div>
  );
}
