'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  isFreighterInstalled,
  getFreighterPublicKey,
  getFreighterNetwork,
  connectFreighter,
} from '@/lib/freighter';
import {
  StellarWalletsKit,
  initWalletKit,
  isLobstrInstalled,
  WALLET_IDS,
} from '@/lib/walletkit';
import type { WalletState } from '@/types';

interface WalletContextValue extends WalletState {
  connect: (walletId: string) => Promise<void>;
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
  connect: async () => {},
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
          setIsCheckingWallet(false);
          return;
        }
      }

      setIsCheckingWallet(false);
    })();
  }, []);

  const connect = useCallback(async (walletId: string) => {
    setState(s => ({ ...s, isConnecting: true }));
    try {
      if (walletId === WALLET_IDS.freighter) {
        const key = await connectFreighter();
        const net = await getFreighterNetwork();
        setState({
          publicKey: key,
          walletId,
          isConnected: true,
          isConnecting: false,
          isInstalled: true,
          networkMismatch: networkMismatchFor(net),
        });
      } else {
        // Lobstr and other kit-managed wallets
        StellarWalletsKit.setWallet(walletId);
        const { address } = await StellarWalletsKit.fetchAddress();
        setState({
          publicKey: address,
          walletId,
          isConnected: true,
          isConnecting: false,
          isInstalled: true,
          networkMismatch: false,
        });
      }
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
