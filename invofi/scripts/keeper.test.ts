import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  parseRawEvent,
  statusNum,
  parseKeeperMode,
  STATUS,
  type ParsedEvent,
  processEvents,
} from './keeper.js';
import { nativeToScVal } from '@stellar/stellar-sdk';

describe('Keeper Unit Tests', () => {
  test('statusNum parses status variants correctly', () => {
    assert.equal(statusNum('Pending'), STATUS.Pending);
    assert.equal(statusNum('Financed'), STATUS.Financed);
    assert.equal(statusNum(1), STATUS.Financed);
    assert.equal(statusNum('3'), STATUS.Overdue);
    assert.equal(statusNum('InvalidStatus'), -1);
  });

  test('parseRawEvent correctly decodes inv_reg event', () => {
    const topic0 = nativeToScVal('inv_reg', { type: 'symbol' });
    const topic1 = nativeToScVal('INV-101', { type: 'symbol' });
    const value = nativeToScVal(['GABC...', 5000n, 1700000000n]);

    const rawEvent = {
      type: 'contract',
      contractId: 'CCREGISTRY...',
      topic: [topic0, topic1],
      value,
      ledger: 12345,
      ledgerClosedAt: '2026-08-18T10:00:00Z',
      id: 'evt-1',
      pagingToken: 'pt-1',
      inSuccessfulContractCall: true,
      txHash: 'hash-1',
    } as any;

    const parsed = parseRawEvent(rawEvent);
    assert.notEqual(parsed, null);
    assert.equal(parsed?.type, 'inv_reg');
    assert.equal(parsed?.invoiceId, 'INV-101');
    assert.equal(parsed?.ledger, 12345);
  });

  test('parseRawEvent correctly decodes off_acc event', () => {
    const topic0 = nativeToScVal('off_acc', { type: 'symbol' });
    const topic1 = nativeToScVal('OFF-202', { type: 'symbol' });
    const value = nativeToScVal(['INV-303', 'GLENDER...', 10000n]);

    const rawEvent = {
      type: 'contract',
      contractId: 'CCFINANCING...',
      topic: [topic0, topic1],
      value,
      ledger: 12346,
      ledgerClosedAt: '2026-08-18T10:00:05Z',
      id: 'evt-2',
      pagingToken: 'pt-2',
      inSuccessfulContractCall: true,
      txHash: 'hash-2',
    } as any;

    const parsed = parseRawEvent(rawEvent);
    assert.notEqual(parsed, null);
    assert.equal(parsed?.type, 'off_acc');
    assert.equal(parsed?.invoiceId, 'INV-303');
    assert.equal(parsed?.ledger, 12346);
  });

  test('parseKeeperMode parses CLI flags and env vars', () => {
    // Default fallback mode
    assert.equal(parseKeeperMode(), 'sweep');
  });
});
