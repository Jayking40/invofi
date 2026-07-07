import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'Browse open invoices and submit financing offers. Earn yield by funding real-world receivables on Stellar.',
  openGraph: {
    title: 'InvoFi Marketplace — Finance Real Invoices on Stellar',
    description: 'Browse open invoices and submit financing offers. Earn yield by funding real-world receivables on Stellar.',
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
