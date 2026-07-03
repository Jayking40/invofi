#!/usr/bin/env bash
# Sync invofi/apps/frontend and invofi/apps/contracts against the standalone
# invofi-frontend / invofi-contracts repos using git subtree.
#
# Usage:
#   bash scripts/sync-subtrees.sh pull frontend   # bring merged PRs from invofi-frontend into this repo
#   bash scripts/sync-subtrees.sh pull contracts  # bring merged PRs from invofi-contracts into this repo
#   bash scripts/sync-subtrees.sh push frontend   # push commits made directly here out to invofi-frontend
#   bash scripts/sync-subtrees.sh push contracts  # push commits made directly here out to invofi-contracts
#
# Run from the repo root. Resolve conflicts like any normal git merge, then
# commit and push this repo as usual.

set -euo pipefail

DIRECTION="${1:?usage: sync-subtrees.sh <pull|push> <frontend|contracts>}"
COMPONENT="${2:?usage: sync-subtrees.sh <pull|push> <frontend|contracts>}"

case "$COMPONENT" in
  frontend)
    PREFIX="invofi/apps/frontend"
    REMOTE_URL="https://github.com/Stellar-VaultLink/invofi-frontend.git"
    REMOTE_NAME="frontend-split"
    BRANCH="master"
    ;;
  contracts)
    PREFIX="invofi/apps/contracts"
    REMOTE_URL="https://github.com/Stellar-VaultLink/invofi-contracts.git"
    REMOTE_NAME="contracts-split"
    BRANCH="master"
    ;;
  *)
    echo "Unknown component: $COMPONENT (expected 'frontend' or 'contracts')" >&2
    exit 1
    ;;
esac

if ! git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  git remote add "$REMOTE_NAME" "$REMOTE_URL"
fi
git fetch "$REMOTE_NAME" "$BRANCH"

# Files that live at the root of the split repos (their own README, LICENSE,
# CI, etc.) but that this monorepo already has at its own root — don't let a
# pull nest duplicate copies under $PREFIX.
SCAFFOLDING=(README.md LICENSE CONTRIBUTING.md CHANGELOG.md .github)

case "$DIRECTION" in
  pull)
    git subtree pull --prefix="$PREFIX" "$REMOTE_NAME" "$BRANCH" --squash \
      -m "chore($COMPONENT): sync merged PRs from $REMOTE_URL"
    to_remove=()
    for f in "${SCAFFOLDING[@]}"; do
      [ -e "$PREFIX/$f" ] && to_remove+=("$PREFIX/$f")
    done
    if [ "${#to_remove[@]}" -gt 0 ]; then
      git rm -rq "${to_remove[@]}"
      git commit --amend --no-edit
      echo "Removed duplicated scaffolding files: ${to_remove[*]}"
    fi
    ;;
  push)
    git subtree push --prefix="$PREFIX" "$REMOTE_NAME" "$BRANCH"
    ;;
  *)
    echo "Unknown direction: $DIRECTION (expected 'pull' or 'push')" >&2
    exit 1
    ;;
esac
