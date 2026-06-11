import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';

describe('parseArgs', () => {
  it('reads --key value pairs', () => {
    expect(parseArgs(['--sarif', 'r.sarif', '--name', 'demo'])).toEqual({ sarif: 'r.sarif', name: 'demo' });
  });
  it('treats --no-open as open=false', () => {
    expect(parseArgs(['--no-open'])).toEqual({ open: false });
  });
  it('treats a flag with no value (or followed by another flag) as true', () => {
    expect(parseArgs(['--src', '--rules', 'r'])).toEqual({ src: true, rules: 'r' });
  });
  it('treats a trailing bare flag (end of array) as true', () => {
    expect(parseArgs(['--verbose'])).toEqual({ verbose: true });
  });
});
