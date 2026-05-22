import { describe, it, expect, beforeEach } from 'vitest';
import { useTheme } from './theme';

describe('theme store', () => {
  beforeEach(() => {
    useTheme.getState().setTheme('dark');
  });

  it('toggles between dark and light', () => {
    useTheme.getState().toggle();
    expect(useTheme.getState().theme).toBe('light');
    useTheme.getState().toggle();
    expect(useTheme.getState().theme).toBe('dark');
  });

  it('setTheme sets an explicit theme', () => {
    useTheme.getState().setTheme('light');
    expect(useTheme.getState().theme).toBe('light');
  });
});
