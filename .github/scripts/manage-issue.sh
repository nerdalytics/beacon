#!/usr/bin/env bash
set -euo pipefail

# Create or update security issue for outdated actions.
# Input: outdated-actions-report.md
# Output: GITHUB_OUTPUT issue_number
# Requires: GH_TOKEN, GH_REPO env vars

ISSUE_TITLE="Security: Outdated GitHub Actions detected"

# Ensure required labels exist
gh label create "security" --description "Security-related issues" --color "D93F0B" --force 2>/dev/null || true
gh label create "dependencies" --description "Dependency updates" --color "0366D6" --force 2>/dev/null || true

EXISTING_ISSUE=$(gh issue list --state open --search "in:title ${ISSUE_TITLE}" --json number --jq '.[0].number' 2>/dev/null || echo "")

if [[ -n "$EXISTING_ISSUE" ]]; then
  gh issue edit "$EXISTING_ISSUE" --body-file outdated-actions-report.md
  echo "Updated issue #${EXISTING_ISSUE}"
  echo "issue_number=${EXISTING_ISSUE}" >> "$GITHUB_OUTPUT"
else
  NEW_ISSUE_URL=$(gh issue create \
    --title "$ISSUE_TITLE" \
    --label "security,dependencies" \
    --body-file outdated-actions-report.md)
  NEW_ISSUE_NUMBER="${NEW_ISSUE_URL##*/}"
  echo "Created new issue #${NEW_ISSUE_NUMBER}"
  echo "issue_number=${NEW_ISSUE_NUMBER}" >> "$GITHUB_OUTPUT"
fi
