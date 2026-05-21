import type { KeyboardEvent } from 'react';

/**
 * Keyboard handler that activates a clickable element on Enter or Space,
 * so non-button elements given role="button" behave like real buttons.
 */
export function keyActivate(handler: () => void) {
  return (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };
}
