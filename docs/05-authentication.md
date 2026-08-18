# Authentication

InvoFi supports three authentication methods that can be used independently or together.

---

## Method 1 — Email + Password (via Supabase)

Standard email/password auth backed by Supabase Auth.

### Sign up flow

1. User visits `/auth/register`
2. Selects a role: **Business** or **Lender**
3. Fills in display name, email, password, password confirmation
4. Frontend calls `signUpWithEmail(email, password, role, displayName)` from `lib/supabase.ts`
5. Supabase creates an auth user and sends a verification email
6. A row is inserted into `user_profiles` with the user's ID, role, and display name
7. User is redirected to `/auth/login` with a "check your email" message

### Login flow

1. User visits `/auth/login`
2. Enters email and password
3. Frontend calls `signInWithEmail(email, password)`
4. Supabase returns a JWT session token stored in an httpOnly cookie
5. User is redirected to `/dashboard`

### Session persistence

Supabase JS client handles session storage and refresh automatically. The session persists across page reloads.

---

## Method 2 — Wallet Connect (linking, not proof of ownership)

For enabling on-chain transaction signing, and as a legacy/best-effort sign-in path.

> **Important:** this method does **not** cryptographically prove the connecting
> address belongs to the caller — see [Security Notes](#security-notes). For an
> actual verified wallet *login*, use [Method 3 — SEP-10](#method-3--sep-10-stellar-account-login).

### Connect flow

1. User clicks "Connect Wallet" on the login page or in the Navbar
2. The `WalletSelectDialog` lists the approved wallets from `lib/approved-wallets.ts`
3. The chosen wallet's extension popup appears asking the user to approve
4. On approval, `@creit.tech/stellar-wallets-kit` returns the user's Stellar address
5. The `WalletProvider` context stores the public key in React state and marks it active for signing
6. `signInWithWallet(address)` (`lib/supabase.ts`) opportunistically establishes *some* Supabase session tied to the address — an existing session, anonymous auth, or a device-local password-based account — so the app has a profile row to attach data to. **This step does not verify a signature; it trusts the caller's claimed address.** It exists for backward compatibility and for silently restoring a wallet connection that was already granted in a previous visit.

### Wallet linking

A user can register with email and link their Freighter wallet later:

1. Sign in with email
2. On the Dashboard, click "Connect Freighter"
3. The frontend calls `linkWalletAddress(userId, walletAddress)` which updates the `wallet_address` column in `user_profiles`
4. From this point, the wallet can be used to sign on-chain transactions

### On-chain signing

Wallet connection is separate from transaction signing. Even if the user is logged in with email, they need Freighter connected to:

- Register an invoice (signs with `register_invoice`)
- Submit a financing offer (signs with `create_offer`)
- Accept or reject an offer (signs with `accept_offer` / `reject_offer`)
- Repay an invoice (signs with `repay_invoice`)

The frontend always checks `isConnected` before attempting any contract call and shows a warning if the wallet is not connected.

---

## Method 3 — SEP-10 Stellar Account Login

Real, cryptographic proof that the signed-in user controls the private key for the wallet address they claim — closing the gap left by Method 2's blind-trust linking (issue #103). This is what powers the "Sign in with Wallet" card on `/auth/login`.

[SEP-10](https://stellar.org/protocol/sep-10) ("Stellar Web Authentication") is the standard challenge/response protocol for proving account ownership without ever moving the private key off the wallet. The server never sees, requests, or needs a private key at any point — only a signed challenge transaction that is never submitted to the network.

### Challenge issuance

1. Client calls `requestChallenge(account)` (`lib/sep10.ts`), which `POST`s the connected wallet's public key to `POST /api/auth/sep10/challenge`.
2. The Route Handler (`src/app/api/auth/sep10/challenge/route.ts`) validates `account` is a well-formed Stellar public key, then calls `buildSep10Challenge` (`src/lib/sep10-server.ts`), which wraps `WebAuth.buildChallengeTx` from `@stellar/stellar-sdk`.
3. That builds a throwaway Stellar transaction — sequence number `0` (so it can never be submitted on-chain), a `ManageData` operation encoding a random 48-byte nonce keyed to the home domain, and a short validity window (default 300s) — signed by the server's own key (`SEP10_SERVER_SIGNING_SECRET`).
4. The signed-by-server challenge XDR is returned to the client, along with the network passphrase to sign with.

### Client signing

5. `signChallenge(xdr, networkPassphrase)` (`lib/sep10.ts`) hands the XDR to `signTransactionWithActiveWallet` (`lib/walletkit.ts`) — the *same* signing primitive used for every on-chain contract call, so wallet login goes through no parallel/bespoke signing path. The connected wallet's extension (Freighter or LOBSTR) prompts the user to approve, and adds the client's own signature to the transaction. The private key never leaves the extension.

### Server verification

6. `verifyChallenge(signedXdr)` (`lib/sep10.ts`) `POST`s the now-doubly-signed XDR to `POST /api/auth/sep10/verify`.
7. The Route Handler (`src/app/api/auth/sep10/verify/route.ts`) calls `verifySep10Challenge` (`src/lib/sep10-server.ts`), which:
   - Runs `WebAuth.readChallengeTx`, confirming the transaction is structurally a challenge this server issued (correct source account, sequence-number-zero convention, matching home/web-auth domain) **and that it has not expired** (SEP-10's replay/expiry protection — an expired or previously-consumed-looking challenge is rejected outright, not silently accepted).
   - Runs `WebAuth.verifyChallengeTxSigners`, confirming the *claimed* client account is genuinely among the transaction's signers — i.e. the wallet that signed really does hold the private key for that address.
   - Throws on any failure. **There is no fallback path** — a failed verification always returns `401` with a generic error message; the server never falls back to trusting the claimed address unverified, and never leaks the signing secret or a stack trace in the response.

### Supabase session binding

8. On success, the verify endpoint derives a deterministic identity for the wallet (`{address}@stellar.wallet`, lower-cased) and calls `admin.auth.admin.generateLink({ type: 'magiclink', email })` via the **service-role** Supabase client (`src/utils/supabase/admin.ts`) — this both creates the auth user on first login and returns a one-time `hashed_token`.
9. The endpoint upserts `user_profiles`: get-or-create the profile row, and set `wallet_address` **and** `wallet_verified = true` (a real, signature-proven binding, distinct from Method 2's merely-linked address). See `docs/08-environment-variables.md` for the `wallet_verified` column requirement.
10. The client receives `{ account, email, tokenHash }` and immediately redeems it: `supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })`. This establishes a **real Supabase session** — same JWT-in-secure-cookie mechanism as Method 1 — for a user whose wallet ownership was cryptographically proven, not merely claimed.
11. `loginWithSep10(account)` (`lib/sep10.ts`) orchestrates steps 1–10 as a single call; the login page calls it from `WalletButton`'s `onConnected` callback and pushes to `/dashboard` only after it resolves.

### Replay and expiry protection

- **Expiry**: challenges default to a 300-second validity window (`SEP10_DEFAULT_TIMEOUT_SECONDS` in `lib/sep10-server.ts`); `WebAuth.readChallengeTx` rejects anything presented after its timebound.
- **Sequence number zero**: SEP-10 challenges always use sequence number `0`, which is invalid for real submission — this is what makes the challenge transaction structurally distinguishable from a "real" transaction and guarantees it can never be broadcast to move funds, even if captured in transit.
- **Domain binding**: the home/web-auth domain is baked into the challenge and re-checked on verify (`NEXT_PUBLIC_SEP10_HOME_DOMAIN` / `NEXT_PUBLIC_SEP10_WEB_AUTH_DOMAIN`), so a challenge issued for one deployment cannot be replayed against another.
- The server never sees a private key at any step — only public keys and signed XDR blobs.

### Manual testnet walkthrough

Real Freighter/LOBSTR browser-extension signing can't run in CI, so the offline parts (challenge building, signature/expiry/tamper verification) are covered by automated tests (`src/lib/sep10-server.test.ts`, `src/lib/sep10.test.ts`), and the end-to-end flow is verified by hand:

1. Set up local env vars (see `docs/08-environment-variables.md`): `SEP10_SERVER_SIGNING_SECRET` (any freshly generated Stellar keypair — it does not need to be funded), `SUPABASE_SERVICE_ROLE_KEY` (from your Supabase project), and `NEXT_PUBLIC_SEP10_HOME_DOMAIN=localhost` (or your dev domain).
2. Run `npm run dev` in `invofi/apps/frontend` and open `/auth/login`.
3. Install the [Freighter](https://freighter.app) extension (or LOBSTR), create/import a **testnet** account, and fund it via [Friendbot](https://friendbot.stellar.org) if needed (funding is not actually required for SEP-10 itself, but is handy for exercising the rest of the app afterward).
4. Click **Sign in with Wallet**, pick your wallet in the dialog, and approve the connection.
5. A signature prompt should appear asking you to approve a `ManageData`-only transaction (the SEP-10 challenge) — inspect it in the extension to confirm it is not a value-moving transaction, then approve.
6. Confirm you land on `/dashboard` without ever being asked for a password, and that a Supabase session now exists (e.g. reload the page — you should stay signed in; the session persists via Supabase's normal cookie mechanism, no custom persistence code needed).
7. In the Supabase dashboard, confirm a `user_profiles` row exists for the wallet with `wallet_verified = true`.
8. Click **Sign out** and confirm the session clears and the dashboard redirects back to `/auth/login`.
9. To exercise a rejection: click **Sign in with Wallet** again and reject the signature prompt in the extension — confirm you see a "Wallet sign-in failed" toast and remain on the login page (not silently signed in).

---

## Auth State in the App

The app uses two independent auth states that work together:

| State | Source | What it controls |
| --- | --- | --- |
| Supabase session | `supabase.auth.getUser()` | Route protection (AuthGuard), user profile, role-based UI |
| Wallet state | `WalletProvider` context | Contract signing, address display, XLM balance |

A user can be:
- **Email only** — can browse the app but cannot submit on-chain transactions
- **Wallet only** — can sign transactions but has no persistent profile unless a Supabase account is linked
- **Both** — full functionality

**Verified vs. merely-linked wallet**: `user_profiles.wallet_address` can be populated two ways — Method 2's blind-trust `signInWithWallet`/`linkWalletAddress` (the address is trusted as claimed, no signature required) or Method 3's SEP-10 flow (the address is proven by a signed challenge). `user_profiles.wallet_verified` distinguishes the two: `true` only after a successful SEP-10 verification, `false`/`null`/missing otherwise. Anything that needs to *rely on* wallet identity (as opposed to just displaying it) should check `wallet_verified`, not just whether `wallet_address` is set.

---

## Route Protection

Protected pages are wrapped in `<AuthGuard>`:

```tsx
// Every protected page
export default function DashboardPage() {
  return (
    <AuthGuard>
      {/* page content */}
    </AuthGuard>
  );
}
```

`AuthGuard` checks `supabase.auth.getUser()` and wallet connection state on mount. If no session or wallet exists, it redirects to `/auth/login`. While checking, it renders a centered loading spinner. It also accepts an optional `isUnauthorized` prop for resource-level guards to redirect unauthorized access attempts to `/403`.

---

## Security Notes

- Supabase session tokens are managed by the Supabase JS client using secure cookies.
- Wallet private keys never leave the connected extension (Freighter or LOBSTR) — InvoFi only ever receives signed transaction XDR strings, whether that's a contract call or a SEP-10 challenge.
- The `user_profiles` table has Row Level Security enabled: users can only read and write their own profile row. The SEP-10 verify endpoint writes with the Supabase **service-role** key precisely because it must create/update a profile the caller doesn't have a session for yet — RLS is bypassed there deliberately, server-side only, and only after signature verification has already succeeded.
- The `wallet_address` field in `user_profiles` is informational for on-chain purposes — on-chain transactions are still validated by Soroban's `require_auth()`, not by the database — but as of Method 3, `wallet_address` **combined with `wallet_verified = true`** is a genuine, cryptographically-checked identity claim suitable for off-chain authentication/authorization decisions (e.g. minting the Supabase session itself). Do not conflate a merely-linked (`wallet_verified` false/unset) address with a verified one.
- `SEP10_SERVER_SIGNING_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are the first server-side secrets in this stack (see `docs/08-environment-variables.md`) — they are read only inside Next.js Route Handlers, never in a Client Component, and never logged or echoed back in an API response (verify failures return a generic 401 with no internal detail).
- SEP-10 challenge transactions always use sequence number `0` and a short expiry window, so a captured challenge can never be replayed to move funds or reused past its validity window.
