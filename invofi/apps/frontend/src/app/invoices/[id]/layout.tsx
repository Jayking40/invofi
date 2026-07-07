import type { Metadata } from 'next';

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Invoice ${params.id}`,
    description: `View details, financing offers, and repayment history for invoice ${params.id} on InvoFi.`,
  };
}

export default function InvoiceDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
