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
    { token: '', foreground: 'f0dcdc' },
    { token: 'keyword', foreground: 'ff6b6b' },
    { token: 'type', foreground: 'ff6b6b' },
    { token: 'function', foreground: 'ffffff' },
    { token: 'identifier.function', foreground: 'ffffff' },
    { token: 'string', foreground: 'ff3838' },
    { token: 'comment', foreground: '8a7575', fontStyle: 'italic' },
    { token: 'number', foreground: 'ff3838' },
  ],
  colors: {
    'editor.background': '#140505',
    'editor.foreground': '#f0dcdc',
    'editorLineNumber.foreground': '#5e4a4a',
    'editorLineNumber.activeForeground': '#f0dcdc',
  },
};

export const otLight: MonacoThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: '', foreground: '44342c' },
    { token: 'keyword', foreground: 'b91c1c' },
    { token: 'type', foreground: 'b91c1c' },
    { token: 'function', foreground: '1e0c06' },
    { token: 'identifier.function', foreground: '1e0c06' },
    { token: 'string', foreground: 'ca2121' },
    { token: 'comment', foreground: '8d7a6e', fontStyle: 'italic' },
    { token: 'number', foreground: 'ca2121' },
  ],
  colors: {
    'editor.background': '#f9f7f5',
    'editor.foreground': '#44342c',
    'editorLineNumber.foreground': '#b3a396',
    'editorLineNumber.activeForeground': '#44342c',
  },
};

export function monacoThemeName(theme: Theme): 'ot-light' | 'ot-dark' {
  return theme === 'light' ? 'ot-light' : 'ot-dark';
}
