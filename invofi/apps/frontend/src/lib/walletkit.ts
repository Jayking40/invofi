'use client';

import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { LobstrModule, LOBSTR_ID } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
import { isConnected as isLobstrConnected } from '@lobstrco/signer-extension-api';

export { FREIGHTER_ID, LOBSTR_ID };
export const WALLET_IDS = { freighter: FREIGHTER_ID, lobstr: LOBSTR_ID } as const;
export type SupportedWalletId = typeof FREIGHTER_ID | typeof LOBSTR_ID;

const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
    ? 'Public Global Stellar Network ; September 2015'
    : 'Test SDF Network ; September 2015';

let _initialized = false;

export function initWalletKit(): void {
  if (typeof window === 'undefined' || _initialized) return;
  StellarWalletsKit.init({
    modules: [new FreighterModule(), new LobstrModule()],
  });
  _initialized = true;
}

export { StellarWalletsKit, NETWORK_PASSPHRASE };

/** Synchronous quick-check — Lobstr extension injects window.lobstrSignerExtension */
export function isLobstrInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as Record<string, unknown>).lobstrSignerExtension;
}

/** Async check — sends a postMessage to the extension for reliable detection */
export async function checkLobstrAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    return await isLobstrConnected();
  } catch {
    return false;
  }
}
