import { useCallback, useEffect, useRef, useState } from 'react';
import { nextZoomFromPinch, touchDistance } from './pinchZoom';

interface Options {
  /** When false the gesture is not wired (e.g. desktop, where the +/- panel handles zoom). */
  enabled: boolean;
  /** Reads the current zoom % at gesture start. */
  getZoom: () => number;
  /** Receives the (unclamped) zoom % as the pinch moves; the store clamps it. */
  setZoom: (zoom: number) => void;
}

/**
 * Wire a two-finger pinch on an element to a zoom callback, returning a callback ref to
 * attach to that element. A callback ref (not a RefObject) is deliberate: the editor box
 * mounts only once a file is selected, and an effect keyed on a RefObject would never
 * re-run when `.current` flips from null to the node. Single-finger touches are left alone
 * so normal scrolling still works; listeners attach in the capture phase with preventDefault
 * so neither Monaco's own gesture handling nor the page's native zoom fights the font zoom.
 */
export function usePinchZoom({ enabled, getZoom, setZoom }: Options): (el: HTMLElement | null) => void {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const getZoomRef = useRef(getZoom);
  const setZoomRef = useRef(setZoom);
  getZoomRef.current = getZoom;
  setZoomRef.current = setZoom;

  useEffect(() => {
    if (!node || !enabled) return;

    let startDist = 0;
    let startZoom = 100;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      startDist = touchDistance(e.touches[0], e.touches[1]);
      startZoom = getZoomRef.current();
      e.preventDefault();
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || startDist <= 0) return;
      e.preventDefault();
      const dist = touchDistance(e.touches[0], e.touches[1]);
      setZoomRef.current(nextZoomFromPinch(startZoom, startDist, dist));
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) startDist = 0;
    };

    const opts: AddEventListenerOptions = { capture: true, passive: false };
    node.addEventListener('touchstart', onStart, opts);
    node.addEventListener('touchmove', onMove, opts);
    node.addEventListener('touchend', onEnd, opts);
    node.addEventListener('touchcancel', onEnd, opts);
    return () => {
      node.removeEventListener('touchstart', onStart, opts);
      node.removeEventListener('touchmove', onMove, opts);
      node.removeEventListener('touchend', onEnd, opts);
      node.removeEventListener('touchcancel', onEnd, opts);
    };
  }, [node, enabled]);

  return useCallback((el: HTMLElement | null) => setNode(el), []);
}
