import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface DbConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
}

/** Aggregate row written by the indexer (protocol_stats, id=1). */
export interface ProtocolStats {
  id: number;
  total_invoices: number;
  total_offers: number;
  invoices_financed: number;
  total_volume: string; // stroops (i128 → string to avoid precision loss)
  total_repaid: string; // stroops
  repayment_rate: number; // 0..1
  active_lenders: number;
  defaulted_invoices: number;
  insurance_pool: string; // stroops
  last_ledger: number;
  updated_at?: string;
}

export function db(cfg: DbConfig): SupabaseClient {
  return createClient(cfg.supabaseUrl, cfg.supabaseServiceKey);
}

/** Read the current stats row (or null on first run). */
export async function loadStats(client: SupabaseClient): Promise<ProtocolStats | null> {
  const { data, error } = await client.from('protocol_stats').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(`loadStats failed: ${error.message}`);
  return (data as ProtocolStats | null) ?? null;
}

/** Upsert the single stats row. */
export async function saveStats(client: SupabaseClient, stats: ProtocolStats): Promise<void> {
  const { error } = await client.from('protocol_stats').upsert(stats, { onConflict: 'id' });
  if (error) throw new Error(`saveStats failed: ${error.message}`);
}
