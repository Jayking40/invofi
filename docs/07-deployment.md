# Deployment Guide

This guide covers the full deployment process for InvoFi on free infrastructure. By the end you will have:

- Three live Soroban contracts on Stellar testnet (registry, financing, repayment)
- A running Next.js frontend on Vercel
- A configured Supabase project for auth and data

Total cost: **$0**

---

## Prerequisites

Install these tools before starting:

```bash
# Rust (for building the contracts)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32v1-none wasm32-unknown-unknown

# Stellar CLI (for deploying the contracts)
cargo install --locked stellar-cli

# Node.js 20+ (for the frontend)
# https://nodejs.org or via nvm: nvm install 20
```

---

## Step 1 — Set Up Supabase

Follow the [Supabase Setup guide](./06-supabase.md) to:

1. Create a free Supabase project
2. Run the database schema SQL
3. Copy your **Project URL** and **Anon Key**

---

## Step 2 — Deploy the Three Contracts

The protocol runs as three Soroban contracts, each deployed from the dedicated
[invofi-contracts](https://github.com/Stellar-VaultLink/invofi-contracts) repo:

| Contract | Responsibility |
| --- | --- |
| `invofi-registry` | Invoice CRUD, admin, pause, rates, blacklist, disputes |
| `invofi-financing` | Offers, accept/reject, currency registry, lender stats |
| `invofi-repayment` | Repay, mark overdue, reclaim |

### 2a. One-click (recommended)

Open the **Deploy Contracts to Testnet** workflow in `invofi-contracts`
(`.github/workflows/deploy-contract.yml`), run it, and it will:
build all three WASM binaries, deploy them, fund the deployer via Friendbot,
and **initialize + wire** the contracts (admin, cross-contract caller
registrations, USDC currency). The three contract IDs are printed in the run
summary.

> Set `STELLAR_DEPLOYER_SECRET_KEY` as a repo secret to keep the same admin key
> across runs. Without it, a fresh deployer keypair is generated each run.

### 2b. Manual (CLI)

```bash
git clone https://github.com/Stellar-VaultLink/invofi-contracts.git
cd invofi-contracts
stellar keys generate --global invofi-deployer --network testnet
stellar keys fund invofi-deployer --network testnet   # Friendbot: 10,000 XLM
stellar contract build

REGISTRY_ID=$(stellar contract deploy --wasm target/wasm32v1-none/release/invofi_registry.wasm --source invofi-deployer --network testnet)
FINANCING_ID=$(stellar contract deploy --wasm target/wasm32v1-none/release/invofi_financing.wasm --source invofi-deployer --network testnet)
REPAYMENT_ID=$(stellar contract deploy --wasm target/wasm32v1-none/release/invofi_repayment.wasm --source invofi-deployer --network testnet)

ADMIN_PUBLIC=$(stellar keys public-key invofi-deployer)
XLM_TOKEN=$(stellar contract id asset --asset native --network testnet)
USDC_TOKEN=$(stellar contract id asset --asset USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 --network testnet)

# Initialize each contract (admin is the deployer)
stellar contract invoke --id "$REGISTRY_ID" --source invofi-deployer --network testnet -- initialize --admin "$ADMIN_PUBLIC"
stellar contract invoke --id "$FINANCING_ID" --source invofi-deployer --network testnet -- initialize --admin "$ADMIN_PUBLIC" --registry "$REGISTRY_ID" --token "$XLM_TOKEN"
stellar contract invoke --id "$REPAYMENT_ID" --source invofi-deployer --network testnet -- initialize --admin "$ADMIN_PUBLIC" --registry "$REGISTRY_ID" --financing "$FINANCING_ID" --token "$XLM_TOKEN"

# Wire cross-contract callers (required for accept_offer / repay_invoice)
stellar contract invoke --id "$REGISTRY_ID" --source invofi-deployer --network testnet -- set_financing_contract --admin "$ADMIN_PUBLIC" --financing "$FINANCING_ID"
stellar contract invoke --id "$REGISTRY_ID" --source invofi-deployer --network testnet -- set_repayment_contract --admin "$ADMIN_PUBLIC" --repayment "$REPAYMENT_ID"
stellar contract invoke --id "$FINANCING_ID" --source invofi-deployer --network testnet -- set_repayment_contract --admin "$ADMIN_PUBLIC" --repayment "$REPAYMENT_ID"
stellar contract invoke --id "$FINANCING_ID" --source invofi-deployer --network testnet -- register_currency --admin "$ADMIN_PUBLIC" --currency USDC --token_addr "$USDC_TOKEN"
```

**Copy the three IDs** — you need them in the next step.

---

## Step 3 — Configure the Frontend

```bash
cd invofi/apps/frontend
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

NEXT_PUBLIC_REGISTRY_CONTRACT_ID=CD4PT7V5U6TMF44IGWXWDRHERCW6VB5OJM4AHTFCQK3X75WJIJP4IYOB
NEXT_PUBLIC_FINANCING_CONTRACT_ID=CCJUYGGMF664FZOLKQEZKAVL3CWCWAVQBE75GVJN5CH5C3ZY55YEEL4P
NEXT_PUBLIC_REPAYMENT_CONTRACT_ID=CASENBBH7KEHOGGBTYSVOM46I7GJ5EC5RF7YVCCDGKMN3EOXVW56X5XU

NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
```

> Legacy: if the three variables above are unset, the app falls back to the
> single `NEXT_PUBLIC_CONTRACT_ID` and routes every call to that one contract.

### Verify locally

```bash
npm install
npm run dev
# → http://localhost:3000
```

Test the full flow:
1. Register with an email
2. Connect Freighter **or LOBSTR** (get testnet XLM from [Stellar Laboratory](https://laboratory.stellar.org/#account-creator))
3. Create an invoice (registry)
4. Open a second browser profile, register as a lender, make an offer (financing)
5. Accept the offer as the business (financing — moves real testnet tokens)
6. Repay the invoice (repayment)

If all steps work locally, deploy to Vercel.

---

## Step 4 — Deploy to Vercel

### 4a. Push to GitHub

```bash
git add .
git commit -m "feat: ready for deployment"
git push origin main
```

### 4b. Import to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New → Project**.
3. Select the `invofi` repository.
4. Set **Root Directory** to `invofi/apps/frontend`.
5. Framework preset: **Next.js** (auto-detected).

### 4c. Add environment variables

In the Vercel project settings under **Environment Variables**, add:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | Registry contract ID |
| `NEXT_PUBLIC_FINANCING_CONTRACT_ID` | Financing contract ID |
| `NEXT_PUBLIC_REPAYMENT_CONTRACT_ID` | Repayment contract ID |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` |
| `NEXT_PUBLIC_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_HORIZON_URL` | `https://horizon-testnet.stellar.org` |

### 4d. Deploy

Click **Deploy**. Vercel builds the Next.js app and gives you a URL like `https://invofi.vercel.app`.

### 4e. Update your Supabase Auth redirect URL

1. In Supabase: go to **Authentication → URL Configuration**.
2. Add your Vercel URL to **Redirect URLs**: `https://invofi.vercel.app/**`
3. Set **Site URL** to `https://invofi.vercel.app`.

---

## Step 5 — Verify Production

Once deployed, test the golden path:

1. Open your Vercel URL in a browser with Freighter or LOBSTR installed
2. Register as a business
3. Connect your wallet (use testnet XLM from Friendbot if needed)
4. Create an invoice
5. Switch to a different account, register as a lender
6. Find the invoice in the marketplace and make an offer
7. Switch back to the business account and accept the offer
8. Repay the invoice

All state changes should be visible on [Stellar Expert](https://stellar.expert/explorer/testnet).

---

## Deploying to Mainnet

When ready to go to mainnet:

1. Fund a real mainnet keypair (buy XLM from an exchange).
2. Deploy the three contracts to mainnet (same commands as Step 2b with `--network mainnet`).
3. Update Vercel environment variables:

| Variable | Mainnet value |
| --- | --- |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `mainnet` |
| `NEXT_PUBLIC_RPC_URL` | `https://soroban-rpc.stellar.org` |
| `NEXT_PUBLIC_HORIZON_URL` | `https://horizon.stellar.org` |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | Your mainnet registry contract ID |
| `NEXT_PUBLIC_FINANCING_CONTRACT_ID` | Your mainnet financing contract ID |
| `NEXT_PUBLIC_REPAYMENT_CONTRACT_ID` | Your mainnet repayment contract ID |

4. Redeploy on Vercel.

---

## Continuous Deployment

Once Vercel is connected to your GitHub repo, every push to `main` triggers an automatic redeploy. No CI configuration needed for the frontend.

For contract changes, redeploy via the **Deploy Contracts to Testnet** workflow in `invofi-contracts` and update the three `NEXT_PUBLIC_*_CONTRACT_ID` environment variables in Vercel.
