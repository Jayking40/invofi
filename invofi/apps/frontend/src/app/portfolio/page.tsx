'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Clock, CheckCircle2, AlertCircle, Download, Copy, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { TableSkeleton } from '@/components/common/LoadingSkeleton';
import { supabase } from '@/lib/supabase';
import { formatAmount, formatDate, interestRateLabel, durationLabel, toStroopsBigInt, OFFER_STATUS_COLORS } from '@/lib/utils';
import { STROOPS_PER_XLM } from '@/lib/constants';
import { toCsv, downloadCsv } from '@/lib/csv';
import type { FinancingOffer } from '@/types';

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

const STATUS_ICONS = {
  Pending:   Clock,
  Accepted:  TrendingUp,
  Financed:  TrendingUp,
  Rejected:  AlertCircle,
  Repaid:    CheckCircle2,
  Defaulted: AlertCircle,
} as const;

/** Total repayment due in stroops: principal + simple yield (matches the contract). */
function offerTotalDue(offer: FinancingOffer): bigint {
  return toStroopsBigInt(offer.amount) + (toStroopsBigInt(offer.amount) * BigInt(offer.interest_rate)) / 10_000n;
}

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <button
      onClick={copy}
      title={copied ? 'Copied!' : 'Copy ID'}
      className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground group"
    >
      <span className="truncate max-w-[140px]">{id}</span>
      {copied
        ? <Check className="h-3 w-3 text-green-500 shrink-0" />
        : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" />
      }
    </button>
  );
}

export default function PortfolioPage() {
  const [offers, setOffers] = useState<FinancingOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        // Wallet-only user — no offers to show yet; stop the spinner.
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('financing_offers')
        .select('*, invoice:invoices(*)')
        .eq('lender_id', user.id)
        .order('created_at', { ascending: false });
      const rows = (data as unknown as FinancingOffer[]) ?? [];
      // Normalize mirror strings (and contract i128s) to bigint stroops so
      // amount/amount_repaid math and display are consistent.
      setOffers(rows.map(o => ({
        ...o,
        amount: toStroopsBigInt(o.amount),
        amount_repaid: toStroopsBigInt(o.amount_repaid),
      })));
      setLoading(false);
    });
  }, []);

  // An offer is active while it is financing an invoice: from acceptance until
  // it is fully repaid. Partial repayments flip offers to Financed on-chain,
  // so both statuses count as deployed capital.
  const active = offers.filter(o => o.status === 'Accepted' || o.status === 'Financed');
  const repaid = offers.filter(o => o.status === 'Repaid');
  const pending = offers.filter(o => o.status === 'Pending');

  const totalDeployed = active.reduce((sum, o) => sum + Number(o.amount) / STROOPS_PER_XLM, 0);
  const totalEarned = repaid.reduce((sum, o) => {
    const principal = Number(o.amount) / STROOPS_PER_XLM;
    const yield_ = principal * (o.interest_rate / 10000);
    return sum + yield_;
  }, 0);

  const exportOffersCsv = () => {
    const rows = offers.map(o => ({
      ...o,
      amount: Number(o.amount) / STROOPS_PER_XLM,
      funded_at: o.funded_at > 0 ? new Date(o.funded_at * 1000).toISOString().slice(0, 10) : '',
    }));
    const csv = toCsv(rows, [
      { key: 'id', header: 'Offer ID' },
      { key: 'invoice_id', header: 'Invoice ID' },
      { key: 'amount', header: 'Amount' },
      { key: 'currency', header: 'Currency' },
      { key: 'interest_rate', header: 'Interest Rate (bps)' },
      { key: 'duration', header: 'Duration (seconds)' },
      { key: 'status', header: 'Status' },
      { key: 'funded_at', header: 'Funded At' },
    ]);
    downloadCsv(`invofi-offers-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <AuthGuard>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Your Portfolio</h1>
            <p className="text-muted-foreground text-sm mt-1">Track your financing offers and returns</p>
          </div>
          {offers.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportOffersCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-5">
              <TrendingUp className="h-4 w-4 text-blue-500 mb-2" />
              <p className="text-2xl font-bold text-foreground">{active.length}</p>
              <p className="text-xs text-muted-foreground">Active Investments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <Clock className="h-4 w-4 text-yellow-500 mb-2" />
              <p className="text-2xl font-bold text-foreground">{pending.length}</p>
              <p className="text-xs text-muted-foreground">Pending Offers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <CheckCircle2 className="h-4 w-4 text-green-500 mb-2" />
              <p className="text-2xl font-bold text-foreground">{repaid.length}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <TrendingUp className="h-4 w-4 text-muted-foreground mb-2" />
              <p className="text-lg font-bold text-foreground font-mono">{totalDeployed.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total Deployed</p>
            </CardContent>
          </Card>
        </div>

        {/* Extra earned stat */}
        {repaid.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                Est. yield earned: {totalEarned.toFixed(4)} (across {repaid.length} repaid offer{repaid.length !== 1 ? 's' : ''})
              </p>
              <p className="text-xs text-green-600 dark:text-green-500">Based on agreed interest rates</p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && <TableSkeleton rows={4} />}

        {/* Empty state */}
        {!loading && offers.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
            <TrendingUp className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No financing offers yet.</p>
            <Link
              href="/marketplace"
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              Browse the marketplace →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {offers.map(offer => {
            const Icon = STATUS_ICONS[offer.status] ?? Clock;
            return (
              <Card key={offer.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <CopyId id={offer.invoice_id} />
                        <a
                          href={`https://stellar.expert/explorer/${NETWORK}/contract/${offer.invoice_id}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-xs text-blue-500 hover:underline"
                        >
                          ↗
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {interestRateLabel(offer.interest_rate)} · {durationLabel(offer.duration)}
                        {offer.funded_at > 0 && ` · Funded ${formatDate(offer.funded_at)}`}
                      </p>
                      {(offer.status === 'Accepted' || offer.status === 'Financed') &&
                        toStroopsBigInt(offer.amount_repaid) > 0n && (
                        <p className="text-xs mt-1 text-green-600">
                          {formatAmount(toStroopsBigInt(offer.amount_repaid))} repaid ·{' '}
                          {formatAmount(offerTotalDue(offer) - toStroopsBigInt(offer.amount_repaid))} remaining
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold font-mono text-foreground">
                        {formatAmount(offer.amount)} {offer.currency}
                      </p>
                    </div>
                    <Badge className={OFFER_STATUS_COLORS[offer.status]}>{offer.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AuthGuard>
  );
}
