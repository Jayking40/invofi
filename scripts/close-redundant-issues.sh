#!/usr/bin/env bash
# Closes feature-tracking issues on this repo that are now redundant: this
# repo is the integration/deployment monorepo (see README's Repositories
# section), and feature work should be tracked as issues on the component
# repo that owns it — invofi-frontend or invofi-contracts — not here.
# Usage: bash scripts/close-redundant-issues.sh

REPO="Stellar-VaultLink/invofi"

echo "Closing redundant issues..."

gh issue close 28 --repo "$REPO" --comment \
"Closing: this is frontend + Supabase work (a form, a table, a badge). Feature tracking for the frontend now lives on https://github.com/Stellar-VaultLink/invofi-frontend/issues, not here — this repo is the integration/deployment monorepo."

gh issue close 29 --repo "$REPO" --comment \
"Closing: this is frontend + Supabase work (a table, RLS policies, a UI timeline). Feature tracking for the frontend now lives on https://github.com/Stellar-VaultLink/invofi-frontend/issues, not here."

gh issue close 30 --repo "$REPO" --comment \
"Closing: implementation would live in the frontend repo (a Supabase Edge Function ships alongside the frontend project). Feature tracking now lives on https://github.com/Stellar-VaultLink/invofi-frontend/issues, not here."

gh issue close 31 --repo "$REPO" --comment \
"Closing: this is a frontend page (/portfolio). Feature tracking for the frontend now lives on https://github.com/Stellar-VaultLink/invofi-frontend/issues, not here."

gh issue close 32 --repo "$REPO" --comment \
"Closing: documentation task, not implementation — no code changes tracked here. Revisit as a real issue (in whichever repo ends up owning it) if usage ever shows rate limiting is actually needed."

gh issue close 33 --repo "$REPO" --comment \
"Closing: this is a repo settings toggle (Settings -> Features -> Discussions), not a coding task — doesn't need a tracked issue."

gh issue close 34 --repo "$REPO" --comment \
"Closing: speculative future work with no concrete consumer yet (depends on #30/#31 landing first, both of which now live on invofi-frontend). Revisit as a real issue, in a new invofi-indexer repo, once there's an actual need."

gh issue close 35 --repo "$REPO" --comment \
"Closing: this is a Vercel/deploy config task for the frontend repo specifically. Feature tracking for the frontend now lives on https://github.com/Stellar-VaultLink/invofi-frontend/issues, not here."

echo ""
echo "All 8 redundant issues closed."
