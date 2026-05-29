import { describe, expect, it } from 'vitest';
import { nextZoomFromPinch, touchDistance } from './pinchZoom';

describe('touchDistance', () => {
  it('measures the gap between two points', () => {
    expect(touchDistance({ clientX: 0, clientY: 0 }, { clientX: 3, clientY: 4 })).toBe(5);
  });

  it('is zero for coincident points', () => {
    expect(touchDistance({ clientX: 7, clientY: 9 }, { clientX: 7, clientY: 9 })).toBe(0);
  });
});

describe('nextZoomFromPinch', () => {
  it('grows the zoom when the fingers spread apart', () => {
    expect(nextZoomFromPinch(100, 100, 150)).toBe(150);
  });

  it('shrinks the zoom when the fingers close together', () => {
    expect(nextZoomFromPinch(100, 200, 100)).toBe(50);
  });

  it('keeps the zoom steady when the gap is unchanged', () => {
    expect(nextZoomFromPinch(120, 80, 80)).toBe(120);
  });

  it('is a no-op for a degenerate start distance', () => {
    expect(nextZoomFromPinch(100, 0, 250)).toBe(100);
  });
});
