import type { Theme } from '../state/theme';

/** Structural shape accepted by monaco.editor.defineTheme — kept local to avoid importing monaco types. */
export interface MonacoThemeData {
  base: 'vs' | 'vs-dark';
  inherit: boolean;
  rules: { token: string; foreground?: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

/** Token-rule colors are hex WITHOUT '#'; the `colors` map uses '#'. Values mirror theme.css code tokens. */
export const otDark: MonacoThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'd4d4d8' },
    { token: 'keyword', foreground: 'c4b5fd' },
    { token: 'type', foreground: 'c4b5fd' },
    { token: 'function', foreground: '7dd3fc' },
    { token: 'identifier.function', foreground: '7dd3fc' },
    { token: 'string', foreground: 'f87171' },
    { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
    { token: 'number', foreground: 'fca5a5' },
  ],
  colors: {
    'editor.background': '#15181e',
    'editor.foreground': '#d4d4d8',
    'editorLineNumber.foreground': '#a1a1aa',
    'editorLineNumber.activeForeground': '#d4d4d8',
  },
};

export const otLight: MonacoThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: '', foreground: '3f3f46' },
    { token: 'keyword', foreground: '7c3aed' },
    { token: 'type', foreground: '7c3aed' },
    { token: 'function', foreground: '0284c7' },
    { token: 'identifier.function', foreground: '0284c7' },
    { token: 'string', foreground: 'dc2626' },
    { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
    { token: 'number', foreground: 'b91c1c' },
  ],
  colors: {
    'editor.background': '#f9fafb',
    'editor.foreground': '#3f3f46',
    'editorLineNumber.foreground': '#52525b',
    'editorLineNumber.activeForeground': '#3f3f46',
  },
};

export function monacoThemeName(theme: Theme): 'ot-light' | 'ot-dark' {
  return theme === 'light' ? 'ot-light' : 'ot-dark';
}
