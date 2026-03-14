#!/usr/bin/env bash
set -euo pipefail

# Create branch, stage workflow changes, and commit.
# Input: actions-outdated.txt (for count)
# Output: GITHUB_OUTPUT has_changes, branch_name

BRANCH_NAME="automation/update-github-actions"

git checkout -B "$BRANCH_NAME"
git add .github/workflows/*.yml

if git diff --cached --quiet; then
  echo "No changes to commit"
  echo "has_changes=false" >> "$GITHUB_OUTPUT"
  exit 0
fi

OUTDATED_COUNT=$(wc -l < actions-outdated.txt | tr -d ' ')
git commit -m "chore(core): update ${OUTDATED_COUNT} GitHub Action(s) to latest versions

Updates actions to SHA-pinned versions for security.
See workflow file changes for details."

echo "has_changes=true" >> "$GITHUB_OUTPUT"
echo "branch_name=${BRANCH_NAME}" >> "$GITHUB_OUTPUT"
