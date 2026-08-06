import { Contract, TransactionBuilder, rpc, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';

export interface ChainConfig {
  rpcUrl: string;
  networkPassphrase: string;
  registryId: string;
  financingId: string;
  repaymentId: string;
  insuranceId: string;
  reputationId: string;
}

/** All five protocol contracts — used to filter getEvents. */
export function contractIds(c: ChainConfig): string[] {
  return [c.registryId, c.financingId, c.repaymentId, c.insuranceId, c.reputationId];
}

function server(c: ChainConfig) {
  return new rpc.Server(c.rpcUrl);
}

function encodeSymbol(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: 'symbol' });
}

function encodeAddress(address: string): xdr.ScVal {
  return nativeToScVal(address, { type: 'address' });
}

function encodeI128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: 'i128' });
}

function encodeU32(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: 'u32' });
}

function encodeU64(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: 'u64' });
}

/**
 * Read-only account for simulateTransaction. Soroban simulations require a
 * real (funded) source account even for pure reads, so on testnet we fund a
 * fixed read account via Friendbot once if it doesn't exist yet. Reads never
 * need auth on any InvoFi contract.
 */
const READ_ACCOUNT = 'GCHVSUK5XKL44CSZ3WGI2W2OZCC7SXZMM5B34TCOQ2YNEGPNP3BLOVMT';

async function ensureReadAccount(rpcServer: rpc.Server): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await rpcServer.getAccount(READ_ACCOUNT);
      return; // account exists
    } catch {
      // fall through to funding
    }
    const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(READ_ACCOUNT)}`);
    if (!res.ok && res.status !== 400) {
      throw new Error(`Friendbot funding of read account failed: ${res.status}`);
    }
    // Friendbot confirms in a later ledger — poll a couple of times.
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Read account could not be confirmed after funding');
}

/**
 * Read-only call via simulateTransaction (no signing).
 */
async function readContract(
  c: ChainConfig,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<xdr.ScVal> {
  const rpcServer = server(c);
  const contract = new Contract(contractId);
  await ensureReadAccount(rpcServer);
  const account = await rpcServer.getAccount(READ_ACCOUNT);
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: c.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Read ${method} failed: ${sim.error}`);
  }
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error(`Read ${method} returned no result`);
  }
  return sim.result.retval;
}

/** Authoritative on-chain totals (registry ProtocolStats). */
export async function readRegistryStats(c: ChainConfig): Promise<{
  totalInvoices: number;
  totalOffers: number;
  totalFinanced: bigint;
  totalRepaid: bigint;
}> {
  const val = await readContract(c, c.registryId, 'get_stats', []);
  const s = scValToNative(val) as {
    total_invoices: number;
    total_offers: number;
    total_financed: bigint | string;
    total_repaid: bigint | string;
  };
  return {
    totalInvoices: s.total_invoices,
    totalOffers: s.total_offers,
    totalFinanced: BigInt(s.total_financed),
    totalRepaid: BigInt(s.total_repaid),
  };
}

/** Insurance pool accounting total (on-chain authoritative). */
export async function readInsurancePool(c: ChainConfig): Promise<bigint> {
  const val = await readContract(c, c.insuranceId, 'get_pool_total', []);
  return BigInt(scValToNative(val) as bigint);
}

export interface EventPage {
  events: rpc.Api.EventResponse[];
  /** Server-provided pagination cursor (pass to the next call). */
  cursor: string;
  latestLedger: number;
}

const RANGE_RE = /startLedger must be within the ledger range: (\d+) - (\d+)/;

/**
 * Fetch one page of contract events from a ledger range.
 * NOTE: per the SDK's GetEventsRequest union, startLedger and cursor are
 * mutually exclusive — use fetchEventsFromRange for the first page, then
 * fetchEventsFromCursor for pagination.
 *
 * RPC only retains ~5 days of event history; if `startLedger` predates the
 * retention window the server rejects the query, so we clamp to the actual
 * retention start and report it via the returned `retentionStart`.
 */
export async function fetchEventsFromRange(
  c: ChainConfig,
  startLedger: number,
  endLedger: number,
): Promise<EventPage & { retentionStart: number }> {
  const rpcServer = server(c);
  let start = Math.max(1, startLedger);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await rpcServer.getEvents({
        startLedger: start,
        endLedger,
        filters: [{ type: 'contract', contractIds: contractIds(c) }],
        limit: 100,
      });
      return { events: res.events, cursor: res.cursor, latestLedger: res.latestLedger, retentionStart: start };
    } catch (err) {
      let msg: string;
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        msg = String((err as { message: unknown }).message);
      } else {
        msg = String(err);
      }
      const m = RANGE_RE.exec(msg);
      if (m) {
        // Clamp just past the retention start. Landing exactly on the boundary
        // can return an empty page from the RPC even though events exist.
        start = Number(m[1]) + 10;
        continue;
      }
      throw err;
    }
  }
  throw new Error('fetchEventsFromRange: could not find a valid ledger range');
}

/** Fetch the next page of contract events after a cursor. */
export async function fetchEventsFromCursor(c: ChainConfig, cursor: string): Promise<EventPage> {
  const rpcServer = server(c);
  const res = await rpcServer.getEvents({
    cursor,
    filters: [{ type: 'contract', contractIds: contractIds(c) }],
    limit: 100,
  });
  return { events: res.events, cursor: res.cursor, latestLedger: res.latestLedger };
}
