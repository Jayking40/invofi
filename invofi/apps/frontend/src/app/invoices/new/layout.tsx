import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register Invoice',
  description: 'Tokenize a new invoice as a Soroban on-chain asset and list it for financing on the InvoFi marketplace.',
};

export default function NewInvoiceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
