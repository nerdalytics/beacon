#!/usr/bin/env bash
set -euo pipefail

# Scan workflow files for GitHub Action references.
# Output: actions-current.txt (action|sha|version_comment per line)
# Output: GITHUB_OUTPUT action_count

declare -A SEEN
ACTION_COUNT=0

for workflow in .github/workflows/*.yml; do
  while IFS= read -r line; do
    if [[ "$line" =~ uses:[[:space:]]*([^@]+)@([^[:space:]#]+)([[:space:]]*#[[:space:]]*(.*))? ]]; then
      action="${BASH_REMATCH[1]}"
      sha="${BASH_REMATCH[2]}"
      comment="${BASH_REMATCH[4]:-}"

      # Trim whitespace from action and comment
      action="${action## }"
      action="${action%% }"
      comment="${comment## }"
      comment="${comment%% }"

      # Skip local actions and reusable workflows
      if [[ "$action" == ./* ]] || [[ "$action" == .github/* ]]; then
        continue
      fi

      # Validate action format: owner/repo
      if [[ ! "$action" =~ ^[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$ ]]; then
        continue
      fi

      # Deduplicate: first occurrence wins
      if [[ -n "${SEEN[$action]:-}" ]]; then
        continue
      fi
      SEEN[$action]=1

      echo "${action}|${sha}|${comment}"
      ((ACTION_COUNT++)) || true
    fi
  done < "$workflow"
done > actions-current.txt

echo "Found ${ACTION_COUNT} unique actions"
echo "action_count=${ACTION_COUNT}" >> "$GITHUB_OUTPUT"
