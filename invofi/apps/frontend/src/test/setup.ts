import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  // Some suites (e.g. src/lib/sep10-server.test.ts) opt into the plain Node
  // environment via `// @vitest-environment node` because they exercise
  // @stellar/stellar-sdk's Ed25519 key generation directly and don't need
  // (or want) jsdom's crypto shims. This setup file still runs for those
  // suites, so guard the DOM-only cleanup instead of assuming `window` exists.
  if (typeof window === 'undefined') return;
  cleanup();
  window.localStorage.clear();
});
