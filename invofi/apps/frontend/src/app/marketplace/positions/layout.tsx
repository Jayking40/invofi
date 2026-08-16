import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Position Listings',
  description:
    'Browse position tokens offered for sale by lenders — invoice reference, size, and asking price. Discovery only; settlement is a direct SEP-41 transfer.',
  openGraph: {
    title: 'InvoFi Position Listings — Secondary-Market Discovery',
    description:
      'Browse position tokens offered for sale by lenders — invoice reference, size, and asking price. Discovery only; settlement is a direct SEP-41 transfer.',
  },
};

export default function PositionListingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
