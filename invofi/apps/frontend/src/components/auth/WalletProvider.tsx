'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  isFreighterInstalled,
  getFreighterPublicKey,
  getFreighterNetwork,
  connectFreighter,
} from '@/lib/freighter';
import type { WalletState } from '@/types';

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  isCheckingWallet: boolean;
}

const WalletContext = createContext<WalletContextValue>({
  publicKey: null,
  isConnected: false,
  isConnecting: false,
  isInstalled: false,
  networkMismatch: false,
  isCheckingWallet: true,
  connect: async () => {},
  disconnect: () => {},
});

const EXPECTED_NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet').toLowerCase();

function networkMismatchFor(freighterNet: string | null): boolean {
  if (!freighterNet) return false;
  const normalized = freighterNet.toLowerCase() === 'public' ? 'mainnet' : freighterNet.toLowerCase();
  return normalized !== EXPECTED_NETWORK;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isCheckingWallet, setIsCheckingWallet] = useState(true);
  const [state, setState] = useState<WalletState>({
    publicKey: null,
    isConnected: false,
    isConnecting: false,
    isInstalled: false,
    networkMismatch: false,
  });

  useEffect(() => {
    (async () => {
      const installed = await isFreighterInstalled();
      if (!installed) {
        setState(s => ({ ...s, isInstalled: false }));
        setIsCheckingWallet(false);
        return;
      }
      const key = await getFreighterPublicKey();
      if (key) {
        const net = await getFreighterNetwork();
        setState({
          publicKey: key,
          isConnected: true,
          isConnecting: false,
          isInstalled: true,
          networkMismatch: networkMismatchFor(net),
        });
      } else {
        setState(s => ({ ...s, isInstalled: true }));
      }
      setIsCheckingWallet(false);
    })();
  }, []);

  const connect = useCallback(async () => {
    setState(s => ({ ...s, isConnecting: true }));
    try {
      const key = await connectFreighter();
      const net = await getFreighterNetwork();
      setState({
        publicKey: key,
        isConnected: true,
        isConnecting: false,
        isInstalled: true,
        networkMismatch: networkMismatchFor(net),
      });
    } catch {
      setState(s => ({ ...s, isConnecting: false }));
      throw new Error('Failed to connect wallet. Make sure Freighter is installed.');
    }
  }, []);

  const disconnect = useCallback(() => {
    setState(s => ({
      ...s,
      publicKey: null,
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
