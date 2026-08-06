// ── InvofiClient — typed Soroban contract calls (Task 15) ────────────────────
// Ported out of apps/frontend/src/lib/contract.ts so contract-call logic lives
// in exactly one place. The SDK is framework-agnostic: no React, no Next.js,
// no wallet — callers inject their own `signTransaction` (and optionally a
// read source account) via createInvofiClient.

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
import type { InvofiClientConfig } from './config';
import type { Currency, FinancingOffer, Invoice } from './types';

const BASE_FEE = '100';

/** A "CODE:ISSUER" asset string, e.g. "POS:GBDD…". */
function parseAssetParts(asset: string): { code: string; issuer: string } {
  const [code, issuer] = asset.split(':');
  if (!code || !issuer) {
    throw new Error(`Invalid asset string: ${asset} (expected "CODE:ISSUER")`);
  }
  return { code, issuer };
}

/** Is this a testnet config (public network has no friendbot)? */
function isTestnet(cfg: InvofiClientConfig): boolean {
  return cfg.networkPassphrase === Networks.TESTNET;
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

export function createInvofiClient(cfg: InvofiClientConfig) {
  const server = () => new SorobanRpc.Server(cfg.rpcUrl, { allowHttp: false });
  const horizon = () => new Horizon.Server(cfg.horizonUrl);

  /**
   * Ensure `address` exists in the ledger so Soroban can simulate/build
   * transactions against it. On testnet a missing account is funded via
   * Friendbot and re-polled; on mainnet we fail with a clear message.
   */
  async function ensureAccount(rpcServer: SorobanRpc.Server, address: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await rpcServer.getAccount(address);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const missing = msg.includes('Account not found') || msg.includes('account not found') || msg.includes('404');
        if (!missing) throw err;
        if (!isTestnet(cfg)) {
          throw new Error('Your wallet has no XLM. Fund your Stellar mainnet account with at least 1 XLM and try again.');
        }
        const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`);
        if (!res.ok && res.status !== 400) {
          throw new Error(`Friendbot funding failed: ${res.status}`);
        }
        await new Promise(r => setTimeout(r, 3000)); // friendbot confirms next ledger
      }
    }
    throw new Error(`Account ${address.slice(0, 8)}… could not be confirmed after funding`);
  }

  /**
   * Sign-and-submit a state-changing contract call.
   * Returns the call's return value (or scvVoid when the contract returns void).
   */
  async function invokeContract(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
    sourceAddress: string,
  ): Promise<xdr.ScVal> {
    const rpc = server();
    await ensureAccount(rpc, sourceAddress);
    const account = await rpc.getAccount(sourceAddress);
    const contract = new Contract(contractId);

    let tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: cfg.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const simResult = await rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Simulation failed: ${simResult.error}`);
    }

    tx = SorobanRpc.assembleTransaction(tx, simResult).build();
    const signedXdr = await cfg.signTransaction(tx.toXDR(), cfg.networkPassphrase);
    const signedTx = new Transaction(signedXdr, cfg.networkPassphrase);

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

  /**
   * Read-only contract call via simulateTransaction (no signing).
   *
   * `sourceAccount` is optional: when given (the connected wallet), reads use
   * it directly (funding it first on testnet if needed). When omitted we fall
   * back to a fixed read account that is friendbot-funded on testnet — this
   * avoids the broken "throw-away account" pattern that failed reads when the
   * account did not exist in the ledger.
   */
  async function readContract(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
    sourceAccount?: string,
  ): Promise<xdr.ScVal> {
    const rpc = server();
    // Fixed read account — funded via friendbot on testnet. Public networks
    // cannot fund accounts, so callers should pass a real sourceAccount there.
    const readSource = sourceAccount ?? 'GCHVSUK5XKL44CSZ3WGI2W2OZCC7SXZMM5B34TCOQ2YNEGPNP3BLOVMT';
    await ensureAccount(rpc, readSource);
    const account = await rpc.getAccount(readSource);
    const contract = new Contract(contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: cfg.networkPassphrase,
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

  function parseInvoice(val: xdr.ScVal): Invoice {
    return scValToNative(val) as Invoice;
  }

  function parseOffer(val: xdr.ScVal): FinancingOffer {
    return scValToNative(val) as FinancingOffer;
  }

  return {
    // ── Registry contract ────────────────────────────────────────────────────
    registerInvoice: async (
      params: { id: string; amount: bigint; currency: Currency; dueDate: number },
      originatorAddress: string,
    ): Promise<Invoice> => {
      const val = await invokeContract(
        cfg.registryId,
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
    },

    getInvoice: (id: string, sourceAccount?: string): Promise<Invoice> =>
      readContract(cfg.registryId, 'get_invoice', [encodeSymbol(id)], sourceAccount).then(parseInvoice),

    cancelInvoice: async (invoiceId: string, originatorAddress: string): Promise<Invoice> => {
      const val = await invokeContract(
        cfg.registryId,
        'cancel_invoice',
        [encodeSymbol(invoiceId), encodeAddress(originatorAddress)],
        originatorAddress,
      );
      return parseInvoice(val);
    },

    // ── Financing contract ───────────────────────────────────────────────────
    createOffer: async (
      params: {
        offerId: string;
        invoiceId: string;
        amount: bigint;
        currency: Currency;
        interestRate: number;
        duration: number;
      },
      lenderAddress: string,
    ): Promise<FinancingOffer> => {
      const val = await invokeContract(
        cfg.financingId,
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
    },

    getOffer: (id: string, sourceAccount?: string): Promise<FinancingOffer> =>
      readContract(cfg.financingId, 'get_offer', [encodeSymbol(id)], sourceAccount).then(parseOffer),

    acceptOffer: async (offerId: string, originatorAddress: string): Promise<FinancingOffer> => {
      const val = await invokeContract(
        cfg.financingId,
        'accept_offer',
        [encodeSymbol(offerId), encodeAddress(originatorAddress)],
        originatorAddress,
      );
      return parseOffer(val);
    },

    rejectOffer: async (offerId: string, originatorAddress: string): Promise<FinancingOffer> => {
      const val = await invokeContract(
        cfg.financingId,
        'reject_offer',
        [encodeSymbol(offerId), encodeAddress(originatorAddress)],
        originatorAddress,
      );
      return parseOffer(val);
    },

    // ── Repayment contract ───────────────────────────────────────────────────
    repayInvoice: async (
      invoiceId: string,
      offerId: string,
      repayerAddress: string,
      amount: bigint,
    ): Promise<Invoice> => {
      const val = await invokeContract(
        cfg.repaymentId,
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
    },

    markOverdue: async (invoiceId: string, callerAddress: string): Promise<Invoice> => {
      const val = await invokeContract(cfg.repaymentId, 'mark_overdue', [encodeSymbol(invoiceId)], callerAddress);
      return parseInvoice(val);
    },

    reclaimInvoice: async (invoiceId: string, offerId: string, lenderAddress: string): Promise<FinancingOffer> => {
      const val = await invokeContract(
        cfg.repaymentId,
        'reclaim_invoice',
        [encodeSymbol(invoiceId), encodeSymbol(offerId), encodeAddress(lenderAddress)],
        lenderAddress,
      );
      return parseOffer(val);
    },

    // ── Position tokens (Task 7/8: SEP-41 claim tokens) ─────────────────────
    // Minted to the lender on offer acceptance (1 token = 1 base unit of
    // financed principal — ADR-0002). Balance reads + transfers are plain
    // SEP-41 token-contract calls; the token address comes from the financing
    // contract (single source of truth, no separate env var).

    getPositionTokenId: (sourceAccount?: string): Promise<string | null> =>
      readContract(cfg.financingId, 'get_position_token', [], sourceAccount).then(
        val => (scValToNative(val) as string | null) ?? null,
      ),

    getTokenBalance: (tokenId: string, address: string): Promise<bigint> =>
      readContract(tokenId, 'balance', [encodeAddress(address)]).then(val => scValToNative(val) as bigint),

    getTokenDecimals: (tokenId: string): Promise<number> =>
      readContract(tokenId, 'decimals', []).then(val => scValToNative(val) as number),

    transferPositionToken: async (
      tokenId: string,
      fromAddress: string,
      toAddress: string,
      amount: bigint,
    ): Promise<void> => {
      await invokeContract(
        tokenId,
        'transfer',
        [encodeAddress(fromAddress), encodeAddress(toAddress), encodeI128(amount)],
        fromAddress,
      );
    },

    // ── Position-token trustline support ─────────────────────────────────────
    // POS is a Stellar asset, so a holder needs a trustline before the
    // financing contract can mint to them (accept_offer) or a transfer can
    // credit them.

    hasPositionTrustline: async (address: string): Promise<boolean> => {
      const { code, issuer } = parseAssetParts(cfg.positionTokenAsset ?? '');
      const account = await horizon().loadAccount(address);
      return account.balances.some(
        b =>
          (b as { asset_code?: string; asset_issuer?: string }).asset_code === code &&
          (b as { asset_code?: string; asset_issuer?: string }).asset_issuer === issuer,
      );
    },

    addPositionTrustline: async (address: string): Promise<void> => {
      const { code, issuer } = parseAssetParts(cfg.positionTokenAsset ?? '');
      const account = await horizon().loadAccount(address);
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: cfg.networkPassphrase,
      })
        .addOperation(
          Operation.changeTrust({
            asset: new Asset(code, issuer),
            limit: '922337203685.4775807',
          }),
        )
        .setTimeout(60)
        .build();
      const signedXdr = await cfg.signTransaction(tx.toXDR(), cfg.networkPassphrase);
      const signedTx = new Transaction(signedXdr, cfg.networkPassphrase);
      await horizon().submitTransaction(signedTx);
    },
  };
}

export type InvofiClient = ReturnType<typeof createInvofiClient>;
