import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinancingOffer } from '@invofi/sdk';
import { LivePortfolioEngine } from './engine';

const { wsStartMock, wsStopMock, pollingStartMock, pollingStopMock } = vi.hoisted(() => ({
  wsStartMock: vi.fn(),
  wsStopMock: vi.fn(),
  pollingStartMock: vi.fn(),
  pollingStopMock: vi.fn(),
}));

vi.mock('./transports', () => ({
  createWebSocketTransport: vi.fn(() => ({ start: wsStartMock, stop: wsStopMock })),
  createPollingTransport: vi.fn(() => ({ start: pollingStartMock, stop: pollingStopMock })),
}));

const DAY = 86_400;
const activeOffer: FinancingOffer = {
  id: 'off_1',
  invoice_id: 'inv_1',
  lender: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  amount: 10_000_000n,
  currency: 'USDC',
  interest_rate: 500,
  duration: 30 * DAY,
  amount_repaid: 0n,
  status: 'Financed',
  funded_at: 1_000_000,
};

describe('LivePortfolioEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    wsStartMock.mockClear();
    wsStopMock.mockClear();
    pollingStartMock.mockClear();
    pollingStopMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('degrades to the polling transport when no WebSocket relay is configured', async () => {
    const statuses: Array<[string, string]> = [];
    const engine = new LivePortfolioEngine({
      wsUrl: null,
      contractIds: ['registry'],
      rpcUrl: 'https://rpc',
      networkPassphrase: 'testnet',
      fetchPositions: async () => [activeOffer],
      onPositions: () => {},
      onUpdate: () => {},
      onConnectionChange: (connection, transport) => statuses.push([connection, transport]),
    });

    await engine.start();

    expect(wsStartMock).not.toHaveBeenCalled();
    expect(pollingStartMock).toHaveBeenCalledTimes(1);
    expect(statuses).toContainEqual(['polling', 'polling']);
    engine.stop();
  });

  it('prefers the WebSocket relay when configured', async () => {
    const engine = new LivePortfolioEngine({
      wsUrl: 'wss://relay.invofi.dev',
      contractIds: ['registry'],
      rpcUrl: 'https://rpc',
      networkPassphrase: 'testnet',
      fetchPositions: async () => [],
      onPositions: () => {},
      onUpdate: () => {},
      onConnectionChange: () => {},
    });

    await engine.start();

    expect(wsStartMock).toHaveBeenCalledTimes(1);
    expect(pollingStartMock).not.toHaveBeenCalled();
    engine.stop();
  });

  it('throttles yield accrual to one update per position per second', async () => {
    const updates: Array<{ kind: string; positionId: string }> = [];
    const engine = new LivePortfolioEngine({
      wsUrl: null,
      contractIds: [],
      rpcUrl: 'https://rpc',
      networkPassphrase: 'testnet',
      fetchPositions: async () => [activeOffer],
      onPositions: () => {},
      onUpdate: update => updates.push(update),
      onConnectionChange: () => {},
      throttleMs: 1_000,
      yieldTickMs: 250,
    });

    await engine.start();
    expect(updates).toHaveLength(0);

    // First accrual tick lands at 250ms; the throttle delivers at +1000ms.
    await vi.advanceTimersByTimeAsync(1_300);
    expect(updates).toHaveLength(1);
    expect(updates[0].kind).toBe('yield_calculated');
    expect(updates[0].positionId).toBe('off_1');

    // One more second → exactly one more delivery (never more than 1/sec).
    await vi.advanceTimersByTimeAsync(1_300);
    expect(updates).toHaveLength(2);

    engine.stop();
  });
});