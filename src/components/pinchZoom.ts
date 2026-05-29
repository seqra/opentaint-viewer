/** Pure helpers for the editor's two-finger pinch-to-zoom gesture. */

interface Point {
  clientX: number;
  clientY: number;
}

/** Euclidean distance between two active touch points. */
export function touchDistance(a: Point, b: Point): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * New zoom % from a pinch: the zoom captured at gesture start, scaled by how much
 * the finger gap has grown (zoom in) or shrunk (zoom out). Returns the start zoom
 * unchanged for a degenerate start distance so a stray single-point gesture is a no-op.
 * Clamping to the allowed range is left to the store's setEditorZoom.
 */
export function nextZoomFromPinch(startZoom: number, startDist: number, currentDist: number): number {
  if (!(startDist > 0)) return startZoom;
  return startZoom * (currentDist / startDist);
}
