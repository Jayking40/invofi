'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, FileText, TrendingUp, Wallet, Download, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { InvoiceCard } from '@/components/invoices/InvoiceCard';
import { InvoiceTable } from '@/components/invoices/InvoiceTable';
import { WalletButton } from '@/components/auth/WalletButton';
import { getUserProfile, supabase } from '@/lib/supabase';
import { getXlmBalance } from '@/lib/horizon';
import { useWallet } from '@/components/auth/WalletProvider';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STROOPS_PER_XLM } from '@/lib/constants';
import { toCsv, downloadCsv } from '@/lib/csv';
import type { UserProfile, Invoice } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [xlmBalance, setXlmBalance] = useState<string | null>(null);
  const [view, setView] = useLocalStorage<'grid' | 'table'>('dashboard-invoice-view', 'grid');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return; }
      const p = await getUserProfile(user.id);
      setProfile(p);

      const { data } = await supabase
        .from('invoices')
        .select('*')
        .eq('originator', user.id)
        .order('created_at', { ascending: false });
      if (data) setInvoices(data as unknown as Invoice[]);
    });
  }, [router]);

  useEffect(() => {
    if (!publicKey) return;
    getXlmBalance(publicKey).then(setXlmBalance).catch(() => setXlmBalance(null));
  }, [publicKey]);

  const isBusiness = profile?.role === 'business';

  const exportInvoicesCsv = () => {
    // Render amount in whole units (not stroops) and due_date as an ISO date.
    const rows = invoices.map(inv => ({
      ...inv,
      amount: Number(inv.amount) / STROOPS_PER_XLM,
      due_date: new Date(inv.due_date * 1000).toISOString().slice(0, 10),
    }));
    const csv = toCsv(rows, [
      { key: 'id', header: 'Invoice ID' },
      { key: 'originator', header: 'Originator' },
      { key: 'amount', header: 'Amount' },
      { key: 'currency', header: 'Currency' },
      { key: 'due_date', header: 'Due Date' },
      { key: 'status', header: 'Status' },
    ]);
    downloadCsv(`invofi-invoices-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <AuthGuard>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isBusiness ? 'Invoice Dashboard' : 'Lender Portfolio'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {profile?.display_name ?? 'Welcome back'}
              {profile?.role && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                  {profile.role}
                </span>
              )}
            </p>
          </div>
          {isBusiness && (
            <Button asChild>
              <Link href="/invoices/new">
                <Plus className="mr-2 h-4 w-4" /> New Invoice
              </Link>
            </Button>
          )}
        </div>

        {/* Wallet panel */}
        <Card className="mb-6 border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Stellar Wallet
            </CardTitle>
            <CardDescription>
              {publicKey
                ? 'Wallet connected. You can sign transactions.'
                : 'Connect your Freighter wallet to interact with contracts.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <WalletButton />
            {xlmBalance !== null && (
              <span className="text-sm text-gray-600 font-mono">
                {parseFloat(xlmBalance).toFixed(2)} XLM
              </span>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {isBusiness ? (
            <>
              <StatCard icon={FileText} label="Total Invoices" value={invoices.length} />
              <StatCard icon={FileText} label="Pending" value={invoices.filter(i => i.status === 'Pending').length} />
              <StatCard icon={TrendingUp} label="Financed" value={invoices.filter(i => i.status === 'Financed').length} />
              <StatCard icon={FileText} label="Repaid" value={invoices.filter(i => i.status === 'Repaid').length} />
            </>
          ) : (
            <>
              <StatCard icon={TrendingUp} label="Active Investments" value={0} />
              <StatCard icon={TrendingUp} label="Pending Offers" value={0} />
              <StatCard icon={FileText} label="Repaid" value={0} />
              <StatCard icon={TrendingUp} label="Total Yield" value="—" />
            </>
          )}
        </div>

        {/* Invoices / offers */}
        {isBusiness && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Your Invoices</h2>
              <div className="flex items-center gap-2">
                {invoices.length > 0 && (
                  <div className="flex items-center rounded-md border">
                    <button
                      onClick={() => setView('grid')}
                      className={`p-2 rounded-l-md ${view === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                      title="Grid view"
                      aria-label="Grid view"
                      aria-pressed={view === 'grid'}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setView('table')}
                      className={`p-2 rounded-r-md border-l ${view === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                      title="Table view"
                      aria-label="Table view"
                      aria-pressed={view === 'table'}
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {invoices.length > 0 && (
                  <Button variant="outline" size="sm" onClick={exportInvoicesCsv}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                  </Button>
                )}
              </div>
            </div>
            {invoices.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
                <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No invoices yet.</p>
                <Button asChild>
                  <Link href="/invoices/new">
                    <Plus className="mr-2 h-4 w-4" /> Create your first invoice
                  </Link>
                </Button>
              </div>
            ) : view === 'table' ? (
              <InvoiceTable
                invoices={invoices}
                onRowClick={inv => router.push(`/invoices/${inv.id}`)}
              />
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {invoices.map(inv => (
                  <InvoiceCard key={inv.id} invoice={inv} href={`/invoices/${inv.id}`} />
                ))}
              </div>
            )}
          </section>
        )}

        {!isBusiness && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Investments</h2>
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
              <TrendingUp className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No active investments yet.</p>
              <Button asChild>
                <Link href="/marketplace">Browse Marketplace</Link>
              </Button>
            </div>
          </section>
        )}
      </div>
    </AuthGuard>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <Icon className="h-4 w-4 text-gray-400 mb-2" />
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}
