import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import type { Invoice } from '@/types';

const supabase = createClient();

interface MarketplaceFilters {
  currency?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

export function useMarketplace(filters: MarketplaceFilters = {}) {
  return useQuery({
    queryKey: ['marketplace', filters],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*')
        .eq('status', 'Pending')
        .order('created_at', { ascending: false });

      if (filters.currency) query = query.eq('currency', filters.currency);
      if (filters.search) query = query.ilike('id', `%${filters.search}%`);

      const { data, error } = await query;
      if (error) throw error;

      let results = data as Invoice[];
      if (filters.minAmount) results = results.filter(i => Number(i.amount) >= filters.minAmount!);
      if (filters.maxAmount) results = results.filter(i => Number(i.amount) <= filters.maxAmount!);
      return results;
    },
  });
}
