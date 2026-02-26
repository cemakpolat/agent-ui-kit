import '@testing-library/jest-dom';

// ResizeObserver is used by Recharts (ResponsiveContainer). jsdom doesn't
// implement it. We provide a mock that immediately fires the callback with
// a 400×200 rect so Recharts renders its SVG during tests.
type ResizeCallback = ResizeObserverCallback;
class MockResizeObserver {
  private cb: ResizeCallback;
  constructor(cb: ResizeCallback) { this.cb = cb; }
  observe(el: Element) {
    const entry = {
      target: el,
      contentRect: { width: 400, height: 200, top: 0, left: 0, bottom: 200, right: 400, x: 0, y: 0, toJSON: () => ({}) },
      borderBoxSize: [{ inlineSize: 400, blockSize: 200 }],
      contentBoxSize: [{ inlineSize: 400, blockSize: 200 }],
      devicePixelContentBoxSize: [{ inlineSize: 400, blockSize: 200 }],
    } as unknown as ResizeObserverEntry;
    this.cb([entry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}
if (typeof window !== 'undefined') {
  (window as typeof window & { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver;
}

// jsdom does not implement window.matchMedia — provide a minimal stub so
// components that use matchMedia (e.g. useNarrowLayout) don't throw.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// JSDOM requires a URL to enable localStorage. Provide a simple in-memory
// implementation so tests that seed localStorage work correctly.
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
