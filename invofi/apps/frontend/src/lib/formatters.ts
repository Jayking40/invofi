import { STROOPS_PER_XLM } from './constants';

export function formatAmount(stroops: string | number, currency: string = 'XLM'): string {
  const units = Number(stroops) / STROOPS_PER_XLM;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(units) + ` ${currency}`;
}

export function formatBasisPoints(bps: number): string {
  return (bps / 100).toFixed(2) + '%';
}

export function formatDate(ts: number | string): string {
  const date = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
}

export function formatRelativeDate(ts: number | string): string {
  const date = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  const diff = date.getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d remaining`;
}

export function formatWalletAddress(address: string, chars: number = 6): string {
  if (!address || address.length < chars * 2) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  if (days >= 1) return `${days} day${days !== 1 ? 's' : ''}`;
  const hours = Math.floor(seconds / 3_600);
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}
