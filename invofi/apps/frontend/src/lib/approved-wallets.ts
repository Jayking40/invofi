'use client';

// ADR-0001 (approved-wallet allowlist): this file is the single extension
// point for wallet support. Approving a third wallet means adding one entry
// to APPROVED_WALLETS — no other code changes.
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { LobstrModule, LOBSTR_ID } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
import { isConnected as isLobstrConnected } from '@lobstrco/signer-extension-api';
import { isConnected as isFreighterConnected } from '@stellar/freighter-api';

const hasWindow = (): boolean => typeof window !== 'undefined';

// Detection mirrors the kit modules' own availability checks (see
// stellar-wallets-kit modules/freighter + modules/lobstr): the official signer
// APIs handle postMessage handshakes, which raw window-global checks miss.
async function hasFreighterExtension(): Promise<boolean> {
  if (!hasWindow()) return false;
  try {
    const result = await isFreighterConnected();
    return !!result?.isConnected;
  } catch {
    return false;
  }
}

async function hasLobstrExtension(): Promise<boolean> {
  if (!hasWindow()) return false;
  try {
    return await isLobstrConnected();
  } catch {
    return false;
  }
}

export const APPROVED_WALLETS = [
  {
    id: FREIGHTER_ID,
    name: 'Freighter',
    description: 'Official Stellar browser wallet by SDF',
    installUrl: 'https://freighter.app',
    module: FreighterModule,
    isInstalled: hasFreighterExtension,
  },
  {
    id: LOBSTR_ID,
    name: 'LOBSTR',
    description: 'Popular Stellar wallet with extension support',
    installUrl: 'https://lobstr.co/extension',
    module: LobstrModule,
    isInstalled: hasLobstrExtension,
  },
] as const;

export type ApprovedWallet = (typeof APPROVED_WALLETS)[number];
export type ApprovedWalletId = ApprovedWallet['id'];

/** Stable app-internal identifiers, derived from the allowlist. */
export const WALLET_IDS = {
  freighter: FREIGHTER_ID,
  lobstr: LOBSTR_ID,
} as const;
