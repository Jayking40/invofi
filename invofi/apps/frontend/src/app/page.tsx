import Link from 'next/link';
import {
  ArrowRight, FileText, TrendingUp, Zap,
  Building2, Wallet, CheckCircle, Clock, Globe, Lock, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATS = [
  { label: 'Total Invoices Financed', value: '124' },
  { label: 'Total Volume', value: '$2.4M' },
  { label: 'Active Lenders', value: '340' },
  { label: 'Avg. Interest Rate', value: '8.5%' },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: FileText,
    title: 'Register Your Invoice',
    description:
      'Connect your Stellar wallet, fill in the invoice details — amount, currency, due date — and mint it as a Soroban on-chain asset in seconds.',
  },
  {
    step: '02',
    icon: TrendingUp,
    title: 'Lenders Compete',
    description:
      'Your invoice appears in the live marketplace. Investors worldwide submit competing offers with their own rates and durations. You pick the best one.',
  },
  {
    step: '03',
    icon: Zap,
    title: 'Receive Funds & Repay',
    description:
      "Accept the best offer — the smart contract transfers the principal to your wallet instantly. Repay in full or partially at your own pace.",
  },
];

const FOR_BUSINESSES = [
  'Instant liquidity — funds in your wallet within minutes of accepting an offer',
  'No bank account, credit score, or collateral required',
  'Partial repayment support — pay back on your schedule',
  'Global lender competition drives your interest rate down',
  'Full transparency — every offer and repayment recorded on-chain',
];

const FOR_LENDERS = [
  'Earn predictable yield on real-world trade finance — not speculation',
  'Browse and filter invoices by amount, currency, and due date',
  'Smart contract enforces all terms — no intermediary risk',
  'Partial repayments tracked on-chain — always know your exposure',
  'Portfolio dashboard shows active positions, yields, and history',
];

const ASSETS = [
  {
    symbol: 'XLM',
    name: 'Stellar Lumens',
    gradient: 'from-violet-500 to-purple-600',
    description:
      'The native asset of the Stellar network. Zero custody risk, sub-cent fees, 5-second finality.',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    gradient: 'from-blue-400 to-blue-600',
    description:
      "Circle's fully-reserved stablecoin on Stellar via SEP-41. Eliminate FX risk for USD-denominated invoices.",
  },
];

const STELLAR_PROPS = [
  {
    icon: Clock,
    title: '5-Second Finality',
    description:
      'Stellar confirms transactions in seconds — funds are truly final, not "pending".',
  },
  {
    icon: Lock,
    title: 'Soroban Smart Contracts',
    description:
      'Purpose-built for DeFi. Deterministic, auditable, and efficient — no runaway gas costs.',
  },
  {
    icon: Globe,
    title: 'Global & Permissionless',
    description:
      'Anyone with a Stellar wallet can participate. No geography, no gatekeepers.',
  },
];

const FAQS = [
  {
    q: 'Do I need a bank account?',
    a: 'No. All you need is a Stellar wallet — InvoFi supports both Freighter and LOBSTR. There is no KYC, no bank account, and no credit check required to use InvoFi.',
  },
  {
    q: 'Which wallets are supported?',
    a: 'InvoFi supports Freighter (browser extension — freighter.app) and LOBSTR (mobile + browser extension — lobstr.co). When you click "Connect Wallet" you can choose either. More wallets may be added as the Stellar ecosystem grows.',
  },
  {
    q: 'How does the lender get their money back?',
    a: 'The business repays through the smart contract, which transfers funds directly to the lender\'s wallet. Partial repayments are supported — the offer tracks amount_repaid on-chain until the full balance (principal + yield) is cleared.',
  },
  {
    q: 'What happens if the business never repays?',
    a: 'After a 7-day grace period following the due date, the lender can call reclaim_invoice. This marks the offer as Defaulted on-chain. InvoFi does not hold collateral — the on-chain default record is a permanent, transparent signal to the network.',
  },
  {
    q: 'What currencies are supported?',
    a: "Currently XLM (Stellar Lumens) and USDC (Circle's stablecoin on Stellar). More SEP-41 tokens will be added as the protocol grows.",
  },
  {
    q: 'Is the contract audited?',
    a: 'The contract is open source and live on Stellar Testnet. A formal third-party audit is on the roadmap before mainnet launch. Read the full source on GitHub.',
  },
  {
    q: 'How do I start as a lender?',
    a: 'Create an account, choose the Lender role, connect your Stellar wallet (Freighter or LOBSTR), and go to the Marketplace. Browse open invoices and submit a financing offer with your desired rate and duration.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live on Stellar Testnet
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Invoice Financing,
            <br />
            <span className="text-blue-200">On-Chain.</span>
          </h1>

          <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            Businesses tokenize unpaid invoices as Soroban assets and get immediate
            liquidity. Investors earn yield by financing real-world receivables —
            trustlessly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-white text-blue-700 hover:bg-blue-50 font-semibold"
            >
              <Link href="/auth/register">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white text-white bg-white/10 hover:bg-white/20"
            >
              <Link href="/marketplace">Browse Marketplace</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-background border-b border-border py-12 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24 px-4 bg-muted">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">
            How InvoFi Works
          </h2>
          <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
            Three steps from unpaid invoice to funded wallet — all on-chain, all trustless.
          </p>

          <div className="grid md:grid-cols-3 gap-10">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={item.step} className="relative flex flex-col items-center text-center">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+2.5rem)] w-[calc(100%-2.5rem)] h-px border-t-2 border-dashed border-blue-300 dark:border-blue-700" />
                )}
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center mb-4 shrink-0 z-10">
                  <item.icon className="h-7 w-7 text-white" />
                </div>
                <span className="text-xs font-mono font-bold tracking-widest text-blue-500 uppercase mb-2">
                  Step {item.step}
                </span>
                <h3 className="text-lg font-semibold text-foreground mb-3">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Businesses / For Lenders ── */}
      <section className="py-24 px-4 bg-background">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-16">
            Built for Both Sides
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center mb-6 shrink-0">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-card-foreground mb-2">For Businesses</h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                Turn unpaid invoices into immediate working capital — without giving up equity or waiting 90 days.
              </p>
              <ul className="space-y-3 flex-1">
                {FOR_BUSINESSES.map((point) => (
                  <li key={point} className="flex gap-3 text-sm text-card-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-8 w-full">
                <Link href="/auth/register?role=business">
                  Register an Invoice <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mb-6 shrink-0">
                <Wallet className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-card-foreground mb-2">For Lenders</h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                Earn predictable yield on real-world trade finance. Your terms, your rate, your risk appetite.
              </p>
              <ul className="space-y-3 flex-1">
                {FOR_LENDERS.map((point) => (
                  <li key={point} className="flex gap-3 text-sm text-card-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-8 w-full">
                <Link href="/marketplace">
                  Browse Marketplace <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Supported Assets ── */}
      <section className="py-24 px-4 bg-muted">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Supported Assets</h2>
          <p className="text-muted-foreground mb-12 max-w-md mx-auto">
            Invoices and financing offers can be denominated in any supported Stellar asset.
          </p>

          <div className="grid sm:grid-cols-2 gap-6">
            {ASSETS.map((asset) => (
              <div
                key={asset.symbol}
                className="rounded-2xl border border-border bg-card p-8 flex gap-5 items-start text-left"
              >
                <div
                  className={`w-14 h-14 rounded-full bg-gradient-to-br ${asset.gradient} flex items-center justify-center text-white font-bold text-lg shrink-0`}
                >
                  {asset.symbol[0]}
                </div>
                <div>
                  <p className="font-bold text-card-foreground">{asset.symbol}</p>
                  <p className="text-xs text-muted-foreground mb-2">{asset.name}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{asset.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built on Stellar ── */}
      <section className="py-24 px-4 bg-gradient-to-br from-indigo-900 to-blue-900 text-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-block bg-white/10 border border-white/20 rounded-full px-4 py-1 text-sm mb-6">
            Powered by Stellar
          </div>
          <h2 className="text-3xl font-bold mb-4">Why We Build on Stellar</h2>
          <p className="text-blue-200 mb-16 max-w-xl mx-auto">
            Stellar was purpose-built for financial applications. Soroban brings smart contracts
            that are deterministic, cheap to run, and designed to move real money.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {STELLAR_PROPS.map((prop) => (
              <div
                key={prop.title}
                className="bg-white/10 border border-white/10 rounded-xl p-6 text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mb-4">
                  <prop.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold mb-2">{prop.title}</h3>
                <p className="text-blue-200 text-sm leading-relaxed">{prop.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-4 bg-background">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Frequently Asked Questions
          </h2>

          <div className="divide-y divide-border">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-medium text-foreground">
                  {faq.q}
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-muted-foreground text-sm leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4 bg-muted text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">Ready to get started?</h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Connect your Stellar wallet or create an account — no bank, no broker, no wait.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/auth/register?role=business">I&apos;m a Business</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/register?role=lender">I&apos;m a Lender</Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 px-4 text-center text-sm text-muted-foreground">
        <p>
          InvoFi — Decentralized Invoice Financing on Stellar Soroban.{' '}
          <a
            href="https://github.com/Stellar-VaultLink/invofi"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            Open Source
          </a>
        </p>
      </footer>
    </div>
  );
}
