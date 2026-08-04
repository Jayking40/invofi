import Link from 'next/link';
import { REGISTRY_CONTRACT_ID, STELLAR_NETWORK, explorerContractUrl } from '@/lib/constants';

const LINKS = [
  { label: 'GitHub', href: 'https://github.com/Stellar-VaultLink/invofi' },
  { label: 'Frontend', href: 'https://github.com/Stellar-VaultLink/invofi-frontend' },
  { label: 'Contracts', href: 'https://github.com/Stellar-VaultLink/invofi-contracts' },
  { label: 'Docs', href: 'https://stellar-vault-link.gitbook.io/stellar-vault-link-docs' },
  { label: 'Issues', href: 'https://github.com/Stellar-VaultLink/invofi/issues' },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto flex flex-col gap-4 text-sm text-muted-foreground">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            <span className="font-semibold text-foreground">InvoFi</span>
            {' '}— Decentralized Invoice Financing on Stellar Soroban
          </p>

          <nav className="flex gap-5">
            {LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        {REGISTRY_CONTRACT_ID && (
          <p className="text-xs text-center sm:text-left">
            Contract on Stellar {STELLAR_NETWORK}:{' '}
            <a
              href={explorerContractUrl(REGISTRY_CONTRACT_ID)}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors"
              title="View the InvoFi contract on Stellar Expert"
            >
              {REGISTRY_CONTRACT_ID.slice(0, 8)}…{REGISTRY_CONTRACT_ID.slice(-8)}
            </a>
          </p>
        )}
      </div>
    </footer>
  );
}