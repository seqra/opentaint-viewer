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
 * True when the event targets a form control or contenteditable that owns its own
 * arrow / Home / End keys. The (read-only) Monaco code panel is deliberately *not* a
 * typing context — step nav overrides its caret keys.
 */
function isTypingContext(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
  return el.isContentEditable;
}

/**
 * Global keyboard control of taint-path stepping:
 *   ←/→ back/next · Shift+←/→ back-over/next-over · ↑ out (back to caller) · Home/End start/end.
 * Yields to the focused widget in form controls and contenteditables. Inside the read-only
 * code panel we swallow the key (capture-phase + stopPropagation) so Monaco's caret keys
 * don't fire alongside the step.
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
      e.stopPropagation();
      s.step(op);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);
}
