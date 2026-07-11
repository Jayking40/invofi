'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  isFreighterInstalled,
  getFreighterPublicKey,
  getFreighterNetwork,
  connectFreighter,
} from '@/lib/freighter';
import { signOut as supabaseSignOut } from '@/lib/supabase';
import {
  StellarWalletsKit,
  initWalletKit,
  isLobstrInstalled,
  WALLET_IDS,
} from '@/lib/walletkit';
import { signInWithWallet } from '@/lib/supabase';
import type { WalletState } from '@/types';

interface WalletContextValue extends WalletState {
  connect: (walletId: string) => Promise<string>;
  disconnect: () => void;
  isCheckingWallet: boolean;
}

const WalletContext = createContext<WalletContextValue>({
  publicKey: null,
  walletId: null,
  isConnected: false,
  isConnecting: false,
  isInstalled: false,
  networkMismatch: false,
  isCheckingWallet: true,
  connect: async () => '',
  disconnect: () => {},
});

const EXPECTED_NETWORK = (
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet'
).toLowerCase();

function networkMismatchFor(freighterNet: string | null): boolean {
  if (!freighterNet) return false;
  const n =
    freighterNet.toLowerCase() === 'public' ? 'mainnet' : freighterNet.toLowerCase();
  return n !== EXPECTED_NETWORK;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isCheckingWallet, setIsCheckingWallet] = useState(true);
  const [state, setState] = useState<WalletState>({
    publicKey: null,
    walletId: null,
    isConnected: false,
    isConnecting: false,
    isInstalled: false,
    networkMismatch: false,
  });

  useEffect(() => {
    initWalletKit();

    (async () => {
      const freighterOk = await isFreighterInstalled();
      const lobstrOk = isLobstrInstalled();
      const anyInstalled = freighterOk || lobstrOk;

      if (!anyInstalled) {
        setState(s => ({ ...s, isInstalled: false }));
        setIsCheckingWallet(false);
        return;
      }

      setState(s => ({ ...s, isInstalled: true }));

      // Try to restore a prior Freighter session
      if (freighterOk) {
        const key = await getFreighterPublicKey();
        if (key) {
          const net = await getFreighterNetwork();
          setState({
            publicKey: key,
            walletId: WALLET_IDS.freighter,
            isConnected: true,
            isConnecting: false,
            isInstalled: true,
            networkMismatch: networkMismatchFor(net),
          });
          // Ensure a Supabase session exists for the restored wallet connection.
          signInWithWallet(key).catch(() => {});
          setIsCheckingWallet(false);
          return;
        }
      }

      setIsCheckingWallet(false);
    })();
  }, []);

  const connect = useCallback(async (walletId: string): Promise<string> => {
    setState(s => ({ ...s, isConnecting: true }));
    try {
      let address: string;

      if (walletId === WALLET_IDS.freighter) {
        address = await connectFreighter();
        const net = await getFreighterNetwork();
        setState({
          publicKey: address,
          walletId,
          isConnected: true,
          isConnecting: false,
          isInstalled: true,
          networkMismatch: networkMismatchFor(net),
        });
      } else {
        // Lobstr and other kit-managed wallets
        StellarWalletsKit.setWallet(walletId);
        const result = await StellarWalletsKit.fetchAddress();
        address = result.address;
        setState({
          publicKey: address,
          walletId,
          isConnected: true,
          isConnecting: false,
          isInstalled: true,
          networkMismatch: false,
        });
      }

      // Create / resume a Supabase session so AuthGuard and DB queries work.
      // This is fire-and-forget — wallet connection is the primary auth.
      signInWithWallet(address).catch(() => {});

      return address;
    } catch (err) {
      setState(s => ({ ...s, isConnecting: false }));
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    setState(s => ({
      ...s,
      publicKey: null,
      walletId: null,
      isConnected: false,
      isConnecting: false,
      networkMismatch: false,
    }));
    // Sign out of Supabase so protected routes redirect to login.
    supabaseSignOut().catch(() => {});
  }, []);

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect, isCheckingWallet }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
