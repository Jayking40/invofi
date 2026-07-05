import Link from 'next/link';

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
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
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
    </footer>
  );
}