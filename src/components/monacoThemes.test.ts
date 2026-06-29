import { describe, it, expect } from 'vitest';
import { otDark, otLight, monacoThemeName, type MonacoThemeData } from './monacoThemes';

describe('monacoThemes', () => {
  it('maps the app theme to a registered Monaco theme name', () => {
    expect(monacoThemeName('light')).toBe('ot-light');
    expect(monacoThemeName('dark')).toBe('ot-dark');
  });

  it('dark theme extends vs-dark with the Red Phosphor code background', () => {
    expect(otDark.base).toBe('vs-dark');
    expect(otDark.colors['editor.background']).toBe('#140505');
    expect(otDark.colors['editorLineNumber.foreground']).toBe('#5e4a4a');
  });

  it('light theme extends vs with the red keyword color (no leading #)', () => {
    expect(otLight.base).toBe('vs');
    const keyword = otLight.rules.find((r) => r.token === 'keyword');
    expect(keyword?.foreground).toBe('b91c1c');
  });

  it('inherits the base theme so unlisted tokens stay styled', () => {
    expect(otDark.inherit).toBe(true);
    expect(otLight.inherit).toBe(true);
  });

  // Monaco rejects rule foregrounds containing a leading '#'; guard the invariant for every rule in both themes.
  it.each<[string, MonacoThemeData]>([
    ['otDark', otDark],
    ['otLight', otLight],
  ])('%s rule foregrounds are 6-digit hex without a leading #', (_name, theme) => {
    for (const rule of theme.rules) {
      if (rule.foreground !== undefined) {
        expect(rule.foreground).toMatch(/^[0-9a-fA-F]{6}$/);
      }
    }
  });
});
