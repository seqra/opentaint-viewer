import { describe, it, expect } from 'vitest';
import { severityLabel } from './severity';

describe('severityLabel', () => {
  it('maps each severity to a human label', () => {
    expect(severityLabel('error')).toBe('Error');
    expect(severityLabel('warning')).toBe('Warning');
    expect(severityLabel('note')).toBe('Note');
  });
});
