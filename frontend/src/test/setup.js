
import '@testing-library/jest-dom';

// Polyfill for Request/Response in jsdom environment if needed (Vitest usually handles this, but good for safety)
/* eslint-disable no-undef */
import { fetch } from 'cross-fetch';
if (!global.fetch) {
  global.fetch = fetch;
  global.Request = Request;
  global.Response = Response;
  global.Headers = Headers;
}

// Mock ResizeObserver for React components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia for Ant Design
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
