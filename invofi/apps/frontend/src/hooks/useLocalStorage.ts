import { useEffect, useState } from 'react';

/**
 * Security guard (issue #187): keys or signature material must never touch
 * localStorage — it is readable by any XSS and persists across sessions.
 *
 * This is the single choke point through which every `useLocalStorage` write
 * flows, so refusing secret-sounding keys here is defense-in-depth on top of
 * the static CI guard (`scripts/localstorage-secrets-guard.mjs`, which scans
 * the source for `localStorage` writes). If a future feature tries to persist
 * a key containing any of these words, the write is refused and an error is
 * logged instead of silently storing a secret.
 *
 * Note: connection state that is not secret (e.g. the last-connected wallet's
 * *public address*) is fine in localStorage — public addresses are not
 * credentials. Secrets (device passwords, seeds, signatures) belong in
 * sessionStorage or in-memory state only.
 */
export const FORBIDDEN_STORAGE_KEY_WORDS = [
  'secret',
  'privatekey',
  'seed',
  'mnemonic',
  'passphrase',
  'password',
  'pw', // shorthand for password — the original #187 regression used `devicePw`
  'signature',
  'signing',
  'credential',
  'recovery',
] as const;

export function isForbiddenStorageKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return FORBIDDEN_STORAGE_KEY_WORDS.some(word => normalized.includes(word));
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (isForbiddenStorageKey(key)) {
      // Refuse the write rather than storing a secret. This must never fire
      // for current callers — it is a tripwire for future regressions.
      console.error(
        `[storage-guard] Refusing to write key "${key}" to localStorage: keys matching ` +
          `secret/privateKey/seed/signature/password must never be persisted. ` +
          `Store this value in sessionStorage or in-memory state instead.`,
      );
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage quota exceeded or unavailable
    }
  }, [key, value]);

  return [value, setValue] as const;
}
