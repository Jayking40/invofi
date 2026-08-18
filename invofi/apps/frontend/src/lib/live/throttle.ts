// ── Per-position update throttle (issue #221) ────────────────────────────────
// Live sources can burst many updates for the same position in a single second
// (a repayment transaction fires multiple on-chain events, a relay may fan out
// several messages). The acceptance criteria cap UI churn at one update per
// position per second, so we coalesce by key: while a key has a pending timer,
// newer values replace the pending one, and the *latest* is delivered when the
// timer fires.

export interface PerKeyThrottle<T> {
  /** Queue `value` for `key`, coalescing with anything already pending. */
  (key: string, value: T): void;
  /** Immediately deliver everything still pending. Used on shutdown. */
  flush: () => void;
  /** Cancel pending timers and drop queued values. */
  stop: () => void;
}

/**
 * Returns a throttled dispatcher that calls `deliver` at most once per `key`
 * per `intervalMs`, always with the most recent value.
 */
export function createPerKeyThrottle<T>(
  intervalMs: number,
  deliver: (key: string, value: T) => void,
): PerKeyThrottle<T> {
  const pending = new Map<string, T>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let stopped = false;

  function dispatch(key: string, value: T): void {
    if (stopped) return;
    pending.set(key, value);
    if (timers.has(key)) return; // a delivery is already scheduled
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        const latest = pending.get(key);
        if (latest === undefined) return;
        pending.delete(key);
        deliver(key, latest);
      }, intervalMs),
    );
  }

  dispatch.flush = () => {
    if (stopped) return;
    for (const [key, value] of pending) {
      pending.delete(key);
      deliver(key, value);
    }
  };

  dispatch.stop = () => {
    stopped = true;
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    pending.clear();
  };

  return dispatch;
}