#!/usr/bin/env bash
# Sync invofi/apps/frontend and invofi/apps/contracts against the standalone
# invofi-frontend / invofi-contracts repos.
#
# Usage:
#   bash scripts/sync-subtrees.sh pull frontend   # bring merged PRs from invofi-frontend into this repo
#   bash scripts/sync-subtrees.sh pull contracts  # bring merged PRs from invofi-contracts into this repo
#   bash scripts/sync-subtrees.sh push frontend   # push commits made directly here out to invofi-frontend
#   bash scripts/sync-subtrees.sh push contracts  # push commits made directly here out to invofi-contracts
#
# IMPORTANT: `push` does NOT use `git subtree push`. This monorepo's git
# history briefly had committed Rust build artifacts (target/, 50-75MB .rlib
# files) in June 2026, since removed from HEAD but still present in history.
# `git subtree push` replays a synthetic branch built from that *entire*
# history, which drags those old blobs into the split repo the first time you
# push — even though they haven't existed in a checkout for a long time.
# Confirmed the hard way: don't re-introduce this. `push` instead clones the
# split repo fresh and copies over the current file contents only, so it never
# carries this monorepo's history into the split repos.
#
# `pull` (split repo -> monorepo) doesn't have this problem — it only affects
# this monorepo's own history, which is already bloated internally either way
# — so it still uses `git subtree pull`.
#
# Both split repos have branch protection on master (1 approval required,
# admins can bypass) — `push` always opens a PR, never pushes to master
# directly. Run from the repo root.

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
# pull nest duplicate copies under $PREFIX, and don't let a push overwrite them.
SCAFFOLDING=(README.md LICENSE CONTRIBUTING.md CHANGELOG.md .gitignore .github)

# Dependency lockfiles drift independently in each repo (each has its own
# Dependabot config, on its own schedule) — a push should never clobber the
# split repo's own version with whatever happens to be checked out here.
INDEPENDENT_ON_PUSH=(package.json package-lock.json Cargo.lock)

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
    WORKDIR=$(mktemp -d)
    trap 'rm -rf "$WORKDIR"' EXIT
    BRANCH_NAME="sync/$(date +%Y%m%d%H%M%S)"

    git clone --branch "$BRANCH" --single-branch --depth 50 "$REMOTE_URL" "$WORKDIR"
    (cd "$WORKDIR" && git checkout -b "$BRANCH_NAME")

    # Save the split repo's own lockfile/manifest before anything touches the
    # tree — these drift independently (own Dependabot) and must survive both
    # the deletion pass below and the cp -a overwrite.
    PRESERVE_DIR=$(mktemp -d)
    for f in "${INDEPENDENT_ON_PUSH[@]}"; do
      [ -f "$WORKDIR/$f" ] && cp -a "$WORKDIR/$f" "$PRESERVE_DIR/$(basename "$f").bak"
    done

    # Remove everything except .git and scaffolding, then copy in the current
    # prefix content, so deletions in the monorepo are reflected too.
    find "$WORKDIR" -mindepth 1 -maxdepth 1 ! -name '.git' -print0 |
      while IFS= read -r -d '' entry; do
        base=$(basename "$entry")
        skip=false
        for f in "${SCAFFOLDING[@]}"; do
          [ "$base" = "$f" ] && skip=true && break
        done
        [ "$skip" = false ] && rm -rf "$entry"
      done || true

    cp -a "$PREFIX"/. "$WORKDIR"/

    # Restore the preserved lockfile/manifest over whatever cp -a just wrote.
    for f in "${INDEPENDENT_ON_PUSH[@]}"; do
      [ -f "$PRESERVE_DIR/$(basename "$f").bak" ] && cp -a "$PRESERVE_DIR/$(basename "$f").bak" "$WORKDIR/$f"
    done
    rm -rf "$PRESERVE_DIR"

    (
      cd "$WORKDIR"
      git add -A
      if git diff --cached --quiet; then
        echo "Nothing to sync — $COMPONENT is already up to date on $REMOTE_URL."
        exit 0
      fi
      git commit -m "chore($COMPONENT): sync from invofi monorepo"
      git push origin "$BRANCH_NAME"
      if command -v gh >/dev/null 2>&1; then
        gh pr create --repo "Stellar-VaultLink/invofi-${COMPONENT}" \
          --base "$BRANCH" --head "$BRANCH_NAME" \
          --title "chore($COMPONENT): sync from invofi monorepo" \
          --body "Syncs the current invofi/apps/$COMPONENT tree from the integration monorepo. Needs review/approval to merge — master is protected."
      else
        echo "Pushed $BRANCH_NAME — open a PR manually (gh CLI not found)."
      fi
    )
    ;;
  *)
    echo "Unknown direction: $DIRECTION (expected 'pull' or 'push')" >&2
    exit 1
    ;;
esac
