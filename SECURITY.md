# Security Policy

## Supported Versions

InvoFi is currently in active development on Stellar testnet. The following versions receive security updates:

| Version | Status |
| --- | --- |
| `main` branch | Actively maintained |
| Older branches | Not supported |

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.** Public disclosure before a fix is ready puts users at risk.

### How to report

Private vulnerability reporting is **enabled** on this repository. To report confidentially:

1. Go to the [GitHub Security Advisories](https://github.com/Stellar-VaultLink/invofi/security/advisories/new) page for this repo.
2. Click **"New draft security advisory"** and fill in the details.
3. We will acknowledge your report within 48 hours and provide an estimated timeline for a fix.

> If you're reviewing the smart contracts, file in the dedicated contracts repo instead:
> [invofi-contracts security advisories](https://github.com/Stellar-VaultLink/invofi-contracts/security/advisories/new)

### Alternative contact

Prefer email? Reach the maintainer directly at:

- **samuelojetunde898@gmail.com**

Either channel works; the advisory route is preferred because it gives us a
tracked, embargoed thread. Include as much detail as possible:

- A description of the vulnerability
- Steps to reproduce it
- The potential impact
- Any suggested mitigations you are aware of

---

## What to Report

Please report anything that could harm users of the protocol, including:

- Smart contract vulnerabilities (reentrancy, authorization bypass, storage corruption)
- Frontend vulnerabilities (XSS, CSRF, wallet key exposure)
- Authentication bypass in Supabase RLS policies
- Dependency vulnerabilities with known exploits

---

## Process

We follow a responsible-disclosure flow:

1. **Acknowledge** your report within 48 hours.
2. **Triage** severity and impact; if it's a live risk we prioritize a fix.
3. **Fix + coordinate** a release, then disclose publicly (with credit if you want it).

Smart-contract findings also feed our [ADRs](https://github.com/Stellar-VaultLink/invofi-contracts/tree/main/adr)
and changelog so the audit trail stays honest.
