import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { create } from 'zustand';
import { useStore } from './store';

// Mock localStorage for the test environment
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

vi.stubGlobal('localStorage', mockLocalStorage);

describe('store — mobileTab persistence guard', () => {
  beforeEach(() => {
    useStore.getState().reset();
    // Clear localStorage before each test
    mockLocalStorage.clear();
  });

  afterEach(() => {
    // Clear localStorage after each test
    mockLocalStorage.clear();
  });

  it('defaults mobileTab to "code"', () => {
    expect(useStore.getState().mobileTab).toBe('code');
  });

  it('setMobileTab updates the field', () => {
    useStore.getState().setMobileTab('details');
    expect(useStore.getState().mobileTab).toBe('details');
    useStore.getState().setMobileTab('rule');
    expect(useStore.getState().mobileTab).toBe('rule');
  });

  it('merge guard defaults invalid mobileTab back to "code"', async () => {
    // Direct invocation of the merge function via the store's persist API.
    // We simulate a corrupted persisted blob and confirm the runtime value is safe.
    localStorage.setItem(
      'ot-view',
      JSON.stringify({ state: { mobileTab: 'garbage' }, version: 1 }),
    );
    // Recreate by reading; zustand-persist applies merge on hydrate.
    // (Reset reseeds initial; we want to reload from storage.)
    await useStore.persist.rehydrate();
    expect(useStore.getState().mobileTab).toBe('code');
  });
});
