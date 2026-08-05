import {
  Asset,
  Contract,
  Horizon,
  Networks,
  Operation,
  rpc as SorobanRpc,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { signTransactionWithActiveWallet } from './walletkit';
import { fundAccountViaFriendbot } from './horizon';
import { POSITION_TOKEN_ASSET } from './constants';
import type { Currency, FinancingOffer, Invoice } from '@/types';

// ── Contract IDs (Task 6: 3-contract deployment) ─────────────────────────────
// The protocol now runs across three Soroban contracts:
//   registry   — invoice CRUD, admin, pause, rates, blacklist, disputes
//   financing  — offer CRUD, accept/reject, currency registry, lender stats
//   repayment  — repay, mark overdue, reclaim
// Each function below routes to the contract that owns it. For backwards
// compatibility, if the new variables are unset we fall back to the legacy
// single NEXT_PUBLIC_CONTRACT_ID (all calls route to that one contract).
const LEGACY_CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? '';
const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? LEGACY_CONTRACT_ID;
const FINANCING_ID = process.env.NEXT_PUBLIC_FINANCING_CONTRACT_ID ?? LEGACY_CONTRACT_ID;
const REPAYMENT_ID = process.env.NEXT_PUBLIC_REPAYMENT_CONTRACT_ID ?? LEGACY_CONTRACT_ID;

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const NETWORK_PASSPHRASE = NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const BASE_FEE = '100';

/** Returns true when all three contracts are configured and StrKey-valid. */
export function isContractConfigured(): boolean {
  return [REGISTRY_ID, FINANCING_ID, REPAYMENT_ID].every(id => {
    if (!id) return false;
    try {
      new Contract(id);
      return true;
    } catch {
      return false;
    }
  });
}

function server() {
  return new SorobanRpc.Server(RPC_URL, { allowHttp: false });
}

function encodeSymbol(value: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(value);
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

async function invokeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourceAddress: string,
): Promise<xdr.ScVal> {
  const rpc = server();

  // If the account doesn't exist on testnet, fund it via Friendbot and retry once.
  let account: Awaited<ReturnType<typeof rpc.getAccount>>;
  try {
    account = await rpc.getAccount(sourceAddress);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Account not found') || msg.includes('account not found') || msg.includes('404')) {
      const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
      if (network !== 'mainnet' && network !== 'public') {
        await fundAccountViaFriendbot(sourceAddress);
        account = await rpc.getAccount(sourceAddress);
      } else {
        throw new Error(
          'Your wallet has no XLM. Fund your Stellar mainnet account with at least 1 XLM and try again.',
        );
      }
    } else {
      throw err;
    }
  }

  const contract = new Contract(contractId);

  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResult = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  tx = SorobanRpc.assembleTransaction(tx, simResult).build();
  const signedXdr = await signTransactionWithActiveWallet(tx.toXDR(), NETWORK_PASSPHRASE);
  const signedTx = new Transaction(signedXdr, NETWORK_PASSPHRASE);

  const sendResult = await rpc.sendTransaction(signedTx);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Transaction failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  let getResult = await rpc.getTransaction(sendResult.hash);
  for (let attempts = 0; attempts < 20 && getResult.status === 'NOT_FOUND'; attempts++) {
    await new Promise(r => setTimeout(r, 1000));
    getResult = await rpc.getTransaction(sendResult.hash);
  }

  if (getResult.status !== 'SUCCESS') {
    throw new Error(`Transaction did not succeed: ${getResult.status}`);
  }

  return getResult.returnValue ?? xdr.ScVal.scvVoid();
}

function parseInvoice(val: xdr.ScVal): Invoice {
  return scValToNative(val) as Invoice;
}

function parseOffer(val: xdr.ScVal): FinancingOffer {
  return scValToNative(val) as FinancingOffer;
}

// ── Read-only calls (use simulateTransaction, no signing needed) ──────────────

async function readContract(contractId: string, method: string, args: xdr.ScVal[]): Promise<xdr.ScVal> {
  const rpc = server();
  const contract = new Contract(contractId);

  // Use a throw-away account for reads (any valid account works)
  const dummyKeypair = { publicKey: () => 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN' };
  const account = await rpc.getAccount(dummyKeypair.publicKey()).catch(() => {
    throw new Error('RPC unavailable');
  });

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Read failed: ${sim.error}`);
  }
  if (!SorobanRpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error('Read simulation returned no result');
  }
  return sim.result.retval;
}

// ── Registry contract ─────────────────────────────────────────────────────────

export async function registerInvoice(
  params: {
    id: string;
    amount: bigint;
    currency: Currency;
    dueDate: number;
  },
  originatorAddress: string,
): Promise<Invoice> {
  const val = await invokeContract(
    REGISTRY_ID,
    'register_invoice',
    [
      encodeSymbol(params.id),
      encodeAddress(originatorAddress),
      encodeI128(params.amount),
      encodeSymbol(params.currency),
      encodeU64(BigInt(params.dueDate)),
    ],
    originatorAddress,
  );
  return parseInvoice(val);
}

export async function getInvoice(id: string): Promise<Invoice> {
  const val = await readContract(REGISTRY_ID, 'get_invoice', [encodeSymbol(id)]);
  return parseInvoice(val);
}

// Cancels a Pending invoice on-chain. Originator-only; the invoice must still
// be Pending (no offers accepted). Emits the inv_cxl protocol event.
export async function cancelInvoice(
  invoiceId: string,
  originatorAddress: string,
): Promise<Invoice> {
  const val = await invokeContract(
    REGISTRY_ID,
    'cancel_invoice',
    [encodeSymbol(invoiceId), encodeAddress(originatorAddress)],
    originatorAddress,
  );
  return parseInvoice(val);
}

// ── Financing contract ────────────────────────────────────────────────────────

export async function createOffer(
  params: {
    offerId: string;
    invoiceId: string;
    amount: bigint;
    currency: Currency;
    interestRate: number;
    duration: number;
  },
  lenderAddress: string,
): Promise<FinancingOffer> {
  const val = await invokeContract(
    FINANCING_ID,
    'create_offer',
    [
      encodeSymbol(params.offerId),
      encodeSymbol(params.invoiceId),
      encodeAddress(lenderAddress),
      encodeI128(params.amount),
      encodeSymbol(params.currency),
      encodeU32(params.interestRate),
      encodeU64(BigInt(params.duration)),
    ],
    lenderAddress,
  );
  return parseOffer(val);
}

export async function getOffer(id: string): Promise<FinancingOffer> {
  const val = await readContract(FINANCING_ID, 'get_offer', [encodeSymbol(id)]);
  return parseOffer(val);
}

export async function acceptOffer(
  offerId: string,
  originatorAddress: string,
): Promise<FinancingOffer> {
  const val = await invokeContract(
    FINANCING_ID,
    'accept_offer',
    [encodeSymbol(offerId), encodeAddress(originatorAddress)],
    originatorAddress,
  );
  return parseOffer(val);
}

export async function rejectOffer(
  offerId: string,
  originatorAddress: string,
): Promise<FinancingOffer> {
  const val = await invokeContract(
    FINANCING_ID,
    'reject_offer',
    [encodeSymbol(offerId), encodeAddress(originatorAddress)],
    originatorAddress,
  );
  return parseOffer(val);
}

// ── Repayment contract ────────────────────────────────────────────────────────

export async function repayInvoice(
  invoiceId: string,
  offerId: string,
  repayerAddress: string,
  amount: bigint,
): Promise<Invoice> {
  const val = await invokeContract(
    REPAYMENT_ID,
    'repay_invoice',
    [
      encodeSymbol(invoiceId),
      encodeSymbol(offerId),
      encodeAddress(repayerAddress),
      encodeI128(amount),
    ],
    repayerAddress,
  );
  return parseInvoice(val);
}

// Marks a Financed invoice Overdue once its due_date has passed. Callable
// by anyone — no auth required on-chain, so any signed-in wallet can submit it.
export async function markOverdue(
  invoiceId: string,
  callerAddress: string,
): Promise<Invoice> {
  const val = await invokeContract(
    REPAYMENT_ID,
    'mark_overdue',
    [encodeSymbol(invoiceId)],
    callerAddress,
  );
  return parseInvoice(val);
}

// After an Overdue invoice's 7-day grace period elapses, the financing
// lender can mark their offer Defaulted. This is an on-chain default
// record for off-chain recovery — no funds move, since principal was
// already paid to the business at accept_offer time.
export async function reclaimInvoice(
  invoiceId: string,
  offerId: string,
  lenderAddress: string,
): Promise<FinancingOffer> {
  const val = await invokeContract(
    REPAYMENT_ID,
    'reclaim_invoice',
    [encodeSymbol(invoiceId), encodeSymbol(offerId), encodeAddress(lenderAddress)],
    lenderAddress,
  );
  return parseOffer(val);
}

// ── Position tokens (Task 7/8: SEP-41 claim tokens) ─────────────────────────
// When an offer is accepted, the financing contract mints a SEP-41 position
// token to the lender (1 token = 1 base unit of financed principal — ADR-0002
// in invofi-contracts). The token is a standard Stellar asset contract, so
// balance reads and transfers are plain token-contract calls.

/**
 * Reads the configured position-token contract from the financing contract
 * (single source of truth — no separate env var needed). Returns null when
 * the deployment has not configured position tokens yet.
 */
export async function getPositionTokenId(): Promise<string | null> {
  const val = await readContract(FINANCING_ID, 'get_position_token', []);
  return (scValToNative(val) as string | null) ?? null;
}

/** Reads a token's balance for an address (u128 → BigInt base units). */
export async function getTokenBalance(tokenId: string, address: string): Promise<bigint> {
  const val = await readContract(tokenId, 'balance', [encodeAddress(address)]);
  return scValToNative(val) as bigint;
}

/** Reads a token's decimal places (for human-readable display). */
export async function getTokenDecimals(tokenId: string): Promise<number> {
  const val = await readContract(tokenId, 'decimals', []);
  return scValToNative(val) as number;
}

/**
 * Transfers position tokens from the connected wallet to another address
 * via the token contract's standard SEP-41 transfer (from = signer).
 */
export async function transferPositionToken(
  tokenId: string,
  fromAddress: string,
  toAddress: string,
  amount: bigint,
): Promise<void> {
  await invokeContract(
    tokenId,
    'transfer',
    [encodeAddress(fromAddress), encodeAddress(toAddress), encodeI128(amount)],
    fromAddress,
  );
}

// ── Position-token trustline support ─────────────────────────────────────────
// The POS token is a Stellar asset, so a holder must establish a trustline
// before the financing contract can mint to them (accept_offer) or a transfer
// can credit them. These helpers let the UI check and establish it in one
// click with the connected wallet.

function positionAssetParts(): { code: string; issuer: string } {
  const [code, issuer] = POSITION_TOKEN_ASSET.split(':');
  if (!code || !issuer) {
    throw new Error(`Invalid POSITION_TOKEN_ASSET: ${POSITION_TOKEN_ASSET}`);
  }
  return { code, issuer };
}

/** True when the address already holds a trustline to the POS asset. */
export async function hasPositionTrustline(address: string): Promise<boolean> {
  const { code, issuer } = positionAssetParts();
  const horizon = new Horizon.Server(HORIZON_URL);
  const account = await horizon.loadAccount(address);
  return account.balances.some(
    b =>
      (b as { asset_code?: string; asset_issuer?: string }).asset_code === code &&
      (b as { asset_code?: string; asset_issuer?: string }).asset_issuer === issuer,
  );
}

/** Establishes a POS trustline via a changeTrust op signed by the wallet. */
export async function addPositionTrustline(address: string): Promise<void> {
  const { code, issuer } = positionAssetParts();
  const horizon = new Horizon.Server(HORIZON_URL);
  const account = await horizon.loadAccount(address);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset(code, issuer),
        limit: '922337203685.4775807',
      }),
    )
    .setTimeout(60)
    .build();
  const signedXdr = await signTransactionWithActiveWallet(tx.toXDR(), NETWORK_PASSPHRASE);
  const signedTx = new Transaction(signedXdr, NETWORK_PASSPHRASE);
  await horizon.submitTransaction(signedTx);
}
