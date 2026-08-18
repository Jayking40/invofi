import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPerKeyThrottle } from './throttle';

describe('createPerKeyThrottle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces bursts per key and delivers the latest value', () => {
    vi.useFakeTimers();
    const delivered: Array<[string, number]> = [];
    const throttle = createPerKeyThrottle<number>(1_000, (key, value) => delivered.push([key, value]));

    throttle('a', 1);
    throttle('a', 2);
    throttle('a', 3);
    throttle('b', 10);

    vi.advanceTimersByTime(1_000);

    expect(delivered).toEqual([
      ['a', 3],
      ['b', 10],
    ]);
  });

  it('delivers at most once per interval per key', () => {
    vi.useFakeTimers();
    const delivered: string[] = [];
    const throttle = createPerKeyThrottle<string>(1_000, key => delivered.push(key));

    for (let i = 0; i < 5; i++) {
      throttle('a', String(i));
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(1_000);

    expect(delivered).toEqual(['a']);
  });

  it('keeps per-key windows independent', () => {
    vi.useFakeTimers();
    const delivered: string[] = [];
    const throttle = createPerKeyThrottle<string>(1_000, key => delivered.push(key));

    throttle('a', '1');
    vi.advanceTimersByTime(500);
    throttle('b', '2');
    vi.advanceTimersByTime(500); // a fires now, b is not yet due
    throttle('a', '3'); // a is throttled again until the next window
    vi.advanceTimersByTime(1_000); // b fires, then a (coalesced) fires

    expect(delivered).toEqual(['a', 'b', 'a']);
  });

  it('flush delivers pending values immediately and prevents double delivery', () => {
    vi.useFakeTimers();
    const delivered: number[] = [];
    const throttle = createPerKeyThrottle<number>(1_000, (_key, value) => delivered.push(value));

    throttle('a', 1);
    throttle.flush();
    vi.advanceTimersByTime(1_000);

    expect(delivered).toEqual([1]);
  });

  it('stop cancels timers and drops pending values', () => {
    vi.useFakeTimers();
    const delivered: number[] = [];
    const throttle = createPerKeyThrottle<number>(1_000, (_key, value) => delivered.push(value));

    throttle('a', 1);
    throttle.stop();
    vi.advanceTimersByTime(2_000);

    expect(delivered).toEqual([]);
  });
});