import { useEffect } from 'react';
import { useStore } from '../state/store';
import type { StepOp } from '../taint/nav';

function opForKey(e: KeyboardEvent): StepOp | null {
  switch (e.key) {
    case 'ArrowLeft':
      return e.shiftKey ? 'backOver' : 'back';
    case 'ArrowRight':
      return e.shiftKey ? 'nextOver' : 'next';
    case 'ArrowUp':
      return 'out';
    case 'Home':
      return 'start';
    case 'End':
      return 'end';
    default:
      return null;
  }
}

/**
 * True when the event targets a widget that should own arrow keys itself — a form
 * control, a contenteditable, or the (read-only) Monaco code editor, where arrows move
 * the caret / selection. Keeps step navigation from firing on top of cursor movement.
 */
function isTypingContext(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  return el.closest?.('.monaco-editor') != null;
}

/**
 * Global keyboard control of taint-path stepping:
 *   ←/→ back/next · Shift+←/→ back-over/next-over · ↑ out (back to caller) · Home/End start/end.
 * Yields to the focused widget when the user is in a form control or the code editor, so
 * arrow keys move the caret there instead of stepping (use the on-screen buttons, or click
 * outside the editor, to step from the keyboard while the editor holds focus).
 */
export function useStepKeys(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingContext(e.target)) return;
      const op = opForKey(e);
      if (!op) return;
      const s = useStore.getState();
      if (!s.activeFindingId) return;
      e.preventDefault();
      s.step(op);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);
}
