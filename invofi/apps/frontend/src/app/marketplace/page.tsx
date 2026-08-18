'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { MarketplaceCard } from '@/components/marketplace/MarketplaceCard';
import { MarketplaceTabs } from '@/components/marketplace/MarketplaceTabs';
import { CardSkeleton } from '@/components/common/LoadingSkeleton';
import { supabase } from '@/lib/supabase';
import type { Currency, Invoice, InvoiceStatus } from '@/types';

type Filters = { currency: Currency | 'ALL'; status: InvoiceStatus | 'ALL' };
type SortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc' | 'due_soonest';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Amount: high to low' },
  { value: 'amount_asc', label: 'Amount: low to high' },
  { value: 'due_soonest', label: 'Due date: soonest' },
];

export default function MarketplacePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>({ currency: 'ALL', status: 'ALL' });
  const [sort, setSort] = useState<SortKey>('newest');

  useEffect(() => {
  setLoading(true);
  supabase
    .from('invoices')
    .select('*')
    .in('status', ['Pending', 'Financed', 'Overdue'])
    .order('created_at', { ascending: false })
    .then(({ data }: { data: Invoice[] | null }) => {
      setInvoices((data as unknown as Invoice[]) ?? []);
      setLoading(false);
    });
}, []);

  const filtered = invoices.filter(inv => {
    if (filters.currency !== 'ALL' && inv.currency !== filters.currency) return false;
    if (filters.status !== 'ALL' && inv.status !== filters.status) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!inv.id.toLowerCase().includes(q) && !inv.originator.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      case 'amount_desc':
        return Number(b.amount) - Number(a.amount);
      case 'amount_asc':
        return Number(a.amount) - Number(b.amount);
      case 'due_soonest':
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      case 'newest':
      default:
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    }
  });

  return (
    <AuthGuard>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Invoice Marketplace</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse invoices available for financing and submit offers to earn yield.
          </p>
        </div>

        <MarketplaceTabs />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice ID or originator…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value as InvoiceStatus | 'ALL' }))}
          >
            <option value="ALL">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Financed">Financed</option>
            <option value="Overdue">Overdue</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            value={filters.currency}
            onChange={e => setFilters(f => ({ ...f, currency: e.target.value as Currency | 'ALL' }))}
          >
            <option value="ALL">All currencies</option>
            <option value="XLM">XLM</option>
            <option value="USDC">USDC</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            aria-label="Sort invoices"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <CardSkeleton key={i} />)}
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">No invoices match your filters</p>
            <p className="text-sm mt-1">Try adjusting the search or filters.</p>
          </div>
        )}

        {!loading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map(inv => (
              <MarketplaceCard key={inv.id} invoice={inv} />
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
