#!/usr/bin/env bash
set -euo pipefail

# Compare current SHA vs latest SHA for each action.
# Input:  actions-latest.txt  (action|current_sha|current_tag|latest_sha|latest_tag)
# Output: actions-outdated.txt (same format, only mismatches)
# Output: GITHUB_OUTPUT has_outdated

OUTDATED_COUNT=0
> actions-outdated.txt

while IFS='|' read -r action current_sha current_tag latest_sha latest_tag; do
  if [[ "$current_sha" != "$latest_sha" ]]; then
    echo "  Outdated: ${action} ${current_tag:-unknown} -> ${latest_tag}"
    echo "${action}|${current_sha}|${current_tag}|${latest_sha}|${latest_tag}" >> actions-outdated.txt
    ((OUTDATED_COUNT++)) || true
  else
    echo "  Up to date: ${action} (${current_tag:-${current_sha:0:7}})"
  fi
done < actions-latest.txt

if [[ $OUTDATED_COUNT -gt 0 ]]; then
  echo "${OUTDATED_COUNT} outdated action(s) found"
  echo "has_outdated=true" >> "$GITHUB_OUTPUT"
else
  echo "All actions are up to date!"
  echo "has_outdated=false" >> "$GITHUB_OUTPUT"
fi
