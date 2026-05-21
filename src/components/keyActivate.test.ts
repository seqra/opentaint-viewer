import { describe, it, expect, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { keyActivate } from './keyActivate';

const ev = (key: string) => ({ key, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

describe('keyActivate', () => {
  it('invokes the handler on Enter and Space and prevents default', () => {
    const fn = vi.fn();
    const handler = keyActivate(fn);
    const enter = ev('Enter');
    handler(enter);
    handler(ev(' '));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(enter.preventDefault).toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const fn = vi.fn();
    keyActivate(fn)(ev('a'));
    expect(fn).not.toHaveBeenCalled();
  });
});
