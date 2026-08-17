import { describe, expect, it } from 'vitest';
import { findViolations } from './localstorage-secrets-guard.mjs';

describe('localstorage-secrets-guard', () => {
  it('flags localStorage.setItem with a secret-like key', () => {
    const src = `localStorage.setItem('secret', 'x');`;
    const violations = findViolations(src, 'test.ts');
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(1);
    expect(violations[0].message).toMatch(/setItem key/);
  });

  it('flags localStorage.setItem whose value is a secret identifier', () => {
    // `devicePw` is the exact variable name from the original #187 regression
    // (the device password was written to localStorage).
    const src = `localStorage.setItem(storageKey, devicePw);`;
    const violations = findViolations(src, 'test.ts');
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toMatch(/setItem value "devicePw"/);
  });

  it('flags localStorage.setItem whose key is a password shorthand', () => {
    const src = `localStorage.setItem(pwKey, JSON.stringify(v));`;
    const violations = findViolations(src, 'test.ts');
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toMatch(/setItem key "pwKey"/);
  });

  it('flags window.localStorage.setItem with a privateKey value', () => {
    const src = `window.localStorage.setItem('session', privateKey);`;
    const violations = findViolations(src, 'test.ts');
    expect(violations).toHaveLength(1);
  });

  it('flags localStorage dot-assignment with a secret name', () => {
    const src = `localStorage.privateKey = x;`;
    const violations = findViolations(src, 'test.ts');
    expect(violations).toHaveLength(1);
  });

  it('flags localStorage bracket-assignment with a secret key', () => {
    const src = `localStorage['seedPhrase'] = x;`;
    const violations = findViolations(src, 'test.ts');
    expect(violations).toHaveLength(1);
  });

  it('flags secret words inside longer keys', () => {
    const src = `localStorage.setItem('sessionSecretKey', JSON.stringify(v));`;
    const violations = findViolations(src, 'test.ts');
    expect(violations).toHaveLength(1);
  });

  it('reports correct line numbers for multi-line files', () => {
    const src = `const a = 1;\n\nlocalStorage.setItem('theme', 'dark');\nlocalStorage.setItem('seed', x);\n`;
    const violations = findViolations(src, 'test.ts');
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(4);
  });

  it('allows sessionStorage for secrets', () => {
    const src = `sessionStorage.setItem('invofi_wlt_GABC', devicePw);`;
    expect(findViolations(src, 'test.ts')).toHaveLength(0);
  });

  it('allows non-secret keys and data payloads', () => {
    const src = [
      `localStorage.setItem('theme', 'dark');`,
      `localStorage.setItem('dashboard-invoice-view', 'grid');`,
      `localStorage.setItem('invofi:last-wallet', JSON.stringify({ walletId, publicKey }));`,
      `localStorage.setItem('invofi:invoice-draft:GABC123', JSON.stringify({ amount: '1', currency: 'USDC' }));`,
      `localStorage.removeItem('invofi:last-wallet');`,
    ].join('\n');
    expect(findViolations(src, 'test.ts')).toHaveLength(0);
  });

  it('handles multi-line setItem calls', () => {
    const src = `localStorage.setItem(\n  'invofi:last-wallet',\n  JSON.stringify({ walletId, publicKey }),\n);`;
    expect(findViolations(src, 'test.ts')).toHaveLength(0);
  });
});
