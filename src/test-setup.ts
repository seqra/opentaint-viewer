import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Exclude <option> elements from getByText queries because option text is
// rendered as part of a native <select> widget, not as visible page content.
configure({ defaultIgnore: 'script, style, option' });

// react-resizable-panels relies on ResizeObserver, which jsdom does not implement.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom does not implement scrollIntoView; stub it so components that reveal the
// active element (e.g. StepsList) can run under tests.
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

// jsdom doesn't implement window.matchMedia. AppShell uses it to pick desktop vs
// mobile; CodeView's phoneEditorOverrides reads it once at editor mount. Default
// to "no match" (desktop) so existing tests render DesktopShell; the few tests
// that exercise the mobile-side helper stub matchMedia themselves with cleanup.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {},
    dispatchEvent() { return false; },
  })) as unknown as typeof window.matchMedia;
}

// vitest's jsdom exposes a `globalThis.localStorage` object with no methods; the
// store's safeStorage wrapper swallows that silently, but tests that need to drive
// the persist middleware (e.g. rehydrate guards) need a real shim.
if (typeof globalThis.localStorage?.setItem !== 'function') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}
