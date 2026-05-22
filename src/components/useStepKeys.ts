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
 * Global keyboard control of taint-path stepping:
 *   ←/→ back/next · Shift+←/→ back-over/next-over · ↑ out (back to caller) · Home/End start/end.
 * Ignored while a form control (rule filter, etc.) is focused.
 */
export function useStepKeys(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT') return;
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
