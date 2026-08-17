import { describe, expect, it } from 'vitest';
import { isForbiddenStorageKey } from './useLocalStorage';

describe('isForbiddenStorageKey', () => {
  it('flags keys containing secret-like words', () => {
    expect(isForbiddenStorageKey('secret')).toBe(true);
    expect(isForbiddenStorageKey('wallet-privateKey')).toBe(true);
    expect(isForbiddenStorageKey('seed')).toBe(true);
    expect(isForbiddenStorageKey('mnemonic')).toBe(true);
    expect(isForbiddenStorageKey('signature')).toBe(true);
    expect(isForbiddenStorageKey('devicePassword')).toBe(true);
    expect(isForbiddenStorageKey('devicePw')).toBe(true);
    expect(isForbiddenStorageKey('recoveryPhrase')).toBe(true);
  });

  it('allows non-secret keys', () => {
    expect(isForbiddenStorageKey('theme')).toBe(false);
    expect(isForbiddenStorageKey('dashboard-invoice-view')).toBe(false);
    expect(isForbiddenStorageKey('invofi:last-wallet')).toBe(false);
    expect(isForbiddenStorageKey('invofi:invoice-draft:GABC123')).toBe(false);
  });
});
