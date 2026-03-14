#!/usr/bin/env bash
set -euo pipefail

# Close security issue and PR when all actions are up to date.
# Requires: GH_TOKEN, GH_REPO env vars

ISSUE_TITLE="Security: Outdated GitHub Actions detected"
BRANCH_NAME="automation/update-github-actions"

# Close existing issue
EXISTING_ISSUE=$(gh issue list --state open --search "in:title ${ISSUE_TITLE}" --json number --jq '.[0].number' 2>/dev/null || echo "")
if [[ -n "$EXISTING_ISSUE" ]]; then
  gh issue close "$EXISTING_ISSUE" --comment "All GitHub Actions are now up to date."
  echo "Closed issue #${EXISTING_ISSUE}"
else
  echo "No existing issue to close"
fi

# Close existing PR
EXISTING_PR=$(gh pr list --head "$BRANCH_NAME" --state open --json number --jq '.[0].number' 2>/dev/null || echo "")
if [[ -n "$EXISTING_PR" ]]; then
  gh pr close "$EXISTING_PR" --comment "All GitHub Actions are now up to date. Closing this automated PR." --delete-branch
  echo "Closed PR #${EXISTING_PR}"
else
  echo "No existing PR to close"
fi
