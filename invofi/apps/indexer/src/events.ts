// ── Event definitions (must match invofi-contracts) ──────────────────────────
// Each entry maps a protocol event name to (contract, what it means).
// The indexer decodes topics: topic[0] = event name (Symbol), topic[1] = subject.
export interface EventInfo {
  /** Event name symbol, e.g. 'inv_reg' */
  name: string;
  /** Which contract emits it */
  contract: 'registry' | 'financing' | 'repayment' | 'insurance' | 'reputation';
  /** Category used for aggregation */
  category:
    | 'invoice'
    | 'offer'
    | 'acceptance'
    | 'repayment'
    | 'default'
    | 'pool_stake'
    | 'pool_unstake'
    | 'pool_payout'
    | 'reputation';
}

export const KNOWN_EVENTS: EventInfo[] = [
  { name: 'inv_reg', contract: 'registry', category: 'invoice' },
  { name: 'inv_amt', contract: 'registry', category: 'invoice' },
  { name: 'inv_sts', contract: 'registry', category: 'invoice' },
  { name: 'inv_cxl', contract: 'registry', category: 'invoice' },
  { name: 'inv_ovd', contract: 'registry', category: 'invoice' },
  { name: 'inv_def', contract: 'registry', category: 'default' },
  { name: 'inv_dsp', contract: 'registry', category: 'invoice' },
  { name: 'inv_rsl', contract: 'registry', category: 'invoice' },
  { name: 'off_new', contract: 'financing', category: 'offer' },
  { name: 'off_wdr', contract: 'financing', category: 'offer' },
  { name: 'off_acc', contract: 'financing', category: 'acceptance' },
  { name: 'off_rej', contract: 'financing', category: 'offer' },
  { name: 'off_def', contract: 'repayment', category: 'default' },
  { name: 'pos_mint', contract: 'financing', category: 'acceptance' },
  { name: 'inv_rep', contract: 'repayment', category: 'repayment' },
  { name: 'pool_stk', contract: 'insurance', category: 'pool_stake' },
  { name: 'pool_un', contract: 'insurance', category: 'pool_unstake' },
  { name: 'pool_pay', contract: 'insurance', category: 'pool_payout' },
  { name: 'reputn', contract: 'reputation', category: 'reputation' },
];

export const EVENT_NAMES = new Set(KNOWN_EVENTS.map(e => e.name));
