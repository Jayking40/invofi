import { describe, expect, it } from 'vitest';
import { stroopsFromWire } from './convert';

describe('stroopsFromWire', () => {
  it('passes bigints and numbers through as stroops', () => {
    expect(stroopsFromWire(1_000_000n)).toBe(1_000_000n);
    expect(stroopsFromWire(1_000_000)).toBe(1_000_000n);
  });

  it('treats integer strings as raw stroops (wire convention)', () => {
    expect(stroopsFromWire('1000000')).toBe(1_000_000n);
    expect(stroopsFromWire('-500')).toBe(-500n);
  });

  it('treats decimal strings as human units, unlike integer strings', () => {
    expect(stroopsFromWire('1.0')).toBe(10_000_000n);
    expect(stroopsFromWire('1.5')).toBe(15_000_000n);
  });

  it('normalizes empty and nullish values', () => {
    expect(stroopsFromWire('')).toBe(0n);
    expect(stroopsFromWire(null)).toBe(0n);
    expect(stroopsFromWire(undefined)).toBe(0n);
  });
});