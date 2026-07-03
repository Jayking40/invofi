import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import type { Invoice } from '@/types';

const supabase = createClient();

export function useInvoices(originatorId?: string) {
  return useQuery({
    queryKey: ['invoices', originatorId],
    queryFn: async () => {
      let query = supabase.from('invoices').select('*').order('created_at', { ascending: false });
      if (originatorId) query = query.eq('originator_id', originatorId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: true,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Invoice;
    },
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoice: Omit<Invoice, 'created_at'>) => {
      const { data, error } = await supabase.from('invoices').insert(invoice).select().single();
      if (error) throw error;
      return data as Invoice;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase.from('invoices').update({ status }).eq('id', id).select().single();
      if (error) throw error;
      return data as Invoice;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    },
  });
}
