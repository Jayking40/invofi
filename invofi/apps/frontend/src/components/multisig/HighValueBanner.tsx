'use client';

import { ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MULTISIG_REQUIRED_SIGNATURES } from '@/lib/constants';
import { formatThreshold, requiresMultisig } from '@/lib/multisig';
import type { Currency } from '@/types';

interface HighValueBannerProps {
  /** Amount in human units, e.g. the raw form value. */
  amount: string | number;
  currency: Currency;
  className?: string;
}

/**
 * Warns, inline, that an amount crosses the multi-sig threshold and will need
 * M-of-N approval before it can settle (issue #219). Renders nothing below the
 * threshold, so it can be dropped into any amount form unconditionally.
 */
export function HighValueBanner({ amount, currency, className }: HighValueBannerProps) {
  if (!requiresMultisig(amount ?? '0', currency)) return null;

  return (
    <Alert className={className}>
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>High-value operation</AlertTitle>
      <AlertDescription>
        This exceeds the {formatThreshold(currency)} threshold, so it requires{' '}
        {MULTISIG_REQUIRED_SIGNATURES} approvals before it can be submitted. It will be added to the{' '}
        approval queue for co-signers to review.
      </AlertDescription>
    </Alert>
  );
}
