import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import type { FinancingOffer } from '@/types';

const supabase = createClient();

export function useOffers(invoiceId?: string) {
  return useQuery({
    queryKey: ['offers', invoiceId],
    queryFn: async () => {
      let query = supabase.from('financing_offers').select('*').order('created_at', { ascending: false });
      if (invoiceId) query = query.eq('invoice_id', invoiceId);
      const { data, error } = await query;
      if (error) throw error;
      return data as FinancingOffer[];
    },
  });
}

export function useMyOffers(lenderId: string) {
  return useQuery({
    queryKey: ['offers', 'lender', lenderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financing_offers')
        .select('*, invoices(*)')
        .eq('lender_id', lenderId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (FinancingOffer & { invoices: unknown })[];
    },
    enabled: !!lenderId,
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (offer: Omit<FinancingOffer, 'created_at' | 'status'>) => {
      const { data, error } = await supabase
        .from('financing_offers')
        .insert({ ...offer, status: 'Pending' })
        .select()
        .single();
      if (error) throw error;
      return data as FinancingOffer;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['offers', vars.invoice_id] });
    },
  });
}
