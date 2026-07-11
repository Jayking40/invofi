'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { isFreighterInstalled } from '@/lib/freighter';
import { isLobstrInstalled, WALLET_IDS } from '@/lib/walletkit';

interface WalletSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (walletId: string) => void;
  connecting: boolean;
}

interface WalletOption {
  id: string;
  name: string;
  description: string;
  installUrl: string;
  installed: boolean | null;
  logo: React.ReactNode;
}

const FreighterLogo = () => (
  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
    F
  </div>
);

const LobstrLogo = () => (
  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
    L
  </div>
);

export function WalletSelectDialog({
  open,
  onClose,
  onSelect,
  connecting,
}: WalletSelectDialogProps) {
  const [wallets, setWallets] = useState<WalletOption[]>([
    {
      id: WALLET_IDS.freighter,
      name: 'Freighter',
      description: 'Official Stellar browser wallet by SDF',
      installUrl: 'https://freighter.app',
      installed: null,
      logo: <FreighterLogo />,
    },
    {
      id: WALLET_IDS.lobstr,
      name: 'LOBSTR',
      description: 'Popular Stellar wallet with extension support',
      installUrl: 'https://lobstr.co/extension',
      installed: null,
      logo: <LobstrLogo />,
    },
  ]);

  useEffect(() => {
    if (!open) return;
    isFreighterInstalled().then(installed => {
      setWallets(prev =>
        prev.map(w => (w.id === WALLET_IDS.freighter ? { ...w, installed } : w)),
      );
    });
    setWallets(prev =>
      prev.map(w =>
        w.id === WALLET_IDS.lobstr ? { ...w, installed: isLobstrInstalled() } : w,
      ),
    );
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>
            Choose a Stellar wallet extension to connect.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          {wallets.map(wallet => {
            const isReady = wallet.installed === true;
            const isChecking = wallet.installed === null;

            return (
              <div
                key={wallet.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card"
              >
                {wallet.logo}

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-card-foreground text-sm">{wallet.name}</p>
                  <p className="text-xs text-muted-foreground">{wallet.description}</p>
                  {wallet.installed === false && (
                    <a
                      href={wallet.installUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-0.5"
                    >
                      Install extension <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {isChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                ) : isReady ? (
                  <Button
                    size="sm"
                    disabled={connecting}
                    onClick={() => onSelect(wallet.id)}
                  >
                    {connecting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Connect'
                    )}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled className="opacity-50">
                    Not found
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-1">
          Both wallets work via their browser extensions.
        </p>
      </DialogContent>
    </Dialog>
  );
}
