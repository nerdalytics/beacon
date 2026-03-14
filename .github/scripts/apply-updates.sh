#!/usr/bin/env bash
set -euo pipefail

# Apply SHA and tag updates to workflow files via sed.
# Input:  actions-outdated.txt (action|current_sha|current_tag|latest_sha|latest_tag)
# Output: GITHUB_OUTPUT changes_made

SHA_RE='^[a-f0-9]{40}$'
TAG_RE='^v?[0-9]+\.[0-9]+\.[0-9]+$'
CHANGES_MADE=0

while IFS='|' read -r action _ _ latest_sha latest_tag; do
  # Validate SHA
  if [[ ! "$latest_sha" =~ $SHA_RE ]]; then
    echo "  Warning: invalid SHA '${latest_sha}' for ${action}, skipping"
    continue
  fi

  # Validate tag
  if [[ ! "$latest_tag" =~ $TAG_RE ]]; then
    echo "  Warning: invalid tag '${latest_tag}' for ${action}, skipping"
    continue
  fi

  echo "Updating ${action} -> ${latest_sha} # ${latest_tag}"

  for workflow in .github/workflows/*.yml; do
    if grep -q "uses:[[:space:]]*${action}@" "$workflow"; then
      # Use | as sed delimiter — safe because action names, SHAs, and
      # strict semver tags (digits, dots, optional v) contain no pipes
      sed -i "s|uses:\([[:space:]]*\)${action}@[^[:space:]#]*.*|uses:\1${action}@${latest_sha} # ${latest_tag}|" "$workflow"
      CHANGES_MADE=1
    fi
  done
done < actions-outdated.txt

echo "changes_made=${CHANGES_MADE}" >> "$GITHUB_OUTPUT"
