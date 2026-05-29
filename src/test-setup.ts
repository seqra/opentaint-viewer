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

// Ensure localStorage is properly available in the test environment
// jsdom provides a localStorage but it may not be fully functional, so we wrap it.
const createLocalStorageMock = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
};

if (!globalThis.localStorage || typeof globalThis.localStorage.setItem !== 'function') {
  globalThis.localStorage = createLocalStorageMock();
}
