import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { REGISTRY_CONTRACT_ID, STELLAR_NETWORK, explorerContractUrl } from '@/lib/constants';

export function Footer() {
  const t = useTranslations('Footer');

  const LINKS = [
    { label: t('stats'), href: '/stats' },
    { label: t('github'), href: 'https://github.com/Stellar-VaultLink/invofi' },
    { label: t('docs'), href: 'https://stellar-vault-link.gitbook.io/stellar-vault-link-docs' },
    { label: t('issues'), href: 'https://github.com/Stellar-VaultLink/invofi/issues' },
  ];

  return (
    <footer className="border-t border-border bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto flex flex-col gap-4 text-sm text-muted-foreground">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            <span className="font-semibold text-foreground">InvoFi</span>
            {' '}— {t('tagline')}
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
            {t('contractOnStellar', { network: STELLAR_NETWORK })}{' '}
            <a
              href={explorerContractUrl(REGISTRY_CONTRACT_ID)}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors"
              title={t('viewOnStellarExpert')}
            >
              {REGISTRY_CONTRACT_ID.slice(0, 8)}…{REGISTRY_CONTRACT_ID.slice(-8)}
            </a>
          </p>
        )}
      </div>
    </footer>
  );
}