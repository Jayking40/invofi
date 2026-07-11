'use client';

import { useState } from 'react';
import { Loader2, Wallet, LogOut, Copy, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from './WalletProvider';
import { WalletSelectDialog } from './WalletSelectDialog';
import { formatAddress } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface WalletButtonProps {
  onConnected?: (publicKey: string) => void;
}

export function WalletButton({ onConnected }: WalletButtonProps) {
  const {
    publicKey, isConnected, isConnecting,
    isInstalled, networkMismatch,
    isCheckingWallet,
    connect, disconnect,
  } = useWallet();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelectWallet = async (walletId: string) => {
    try {
      await connect(walletId);
      setDialogOpen(false);
      if (onConnected && publicKey) onConnected(publicKey);
    } catch (err: unknown) {
      toast({
        title: 'Wallet connection failed',
        description:
          err instanceof Error ? err.message : 'Could not connect the selected wallet.',
        variant: 'destructive',
      });
    }
  };

  const handleCopy = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  if (isConnected && publicKey) {
    return (
      <div className="flex flex-col items-end gap-1">
        {networkMismatch && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-1">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Switch wallet to {process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet'}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Click to copy full address'}
            className="flex items-center gap-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-green-100 dark:hover:bg-green-900"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            <span className="font-mono text-green-800 dark:text-green-200">
              {formatAddress(publicKey)}
            </span>
            {copied
              ? <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              : <Copy className="h-3.5 w-3.5 text-green-500 opacity-60" />
            }
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={disconnect}
            title="Disconnect wallet"
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (isCheckingWallet) {
    return (
      <Button variant="outline" disabled className="gap-2 opacity-60">
        <Loader2 className="h-4 w-4 animate-spin" />
        Wallet
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        disabled={isConnecting}
        variant="outline"
        className="gap-2"
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>

      <WalletSelectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSelect={handleSelectWallet}
        connecting={isConnecting}
      />
    </>
  );
}
