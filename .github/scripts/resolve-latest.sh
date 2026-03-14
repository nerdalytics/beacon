#!/usr/bin/env bash
set -euo pipefail

# Resolve latest release version and commit SHA for each action.
# Input:  actions-current.txt (action|sha|version_comment)
# Output: actions-latest.txt  (action|current_sha|current_tag|latest_sha|latest_tag)

SEMVER_RE='^v?[0-9]+\.[0-9]+\.[0-9]+$'

resolve_tag_sha() {
  local action="$1"
  local tag="$2"

  local ref_json
  ref_json=$(gh api "repos/${action}/git/refs/tags/${tag}" 2>/dev/null) || return 1

  local obj_type obj_sha
  obj_type=$(echo "$ref_json" | jq -r '.object.type')
  obj_sha=$(echo "$ref_json" | jq -r '.object.sha')

  if [[ "$obj_type" == "tag" ]]; then
    # Annotated tag — dereference to get commit SHA
    obj_sha=$(gh api "repos/${action}/git/tags/${obj_sha}" --jq '.object.sha' 2>/dev/null) || return 1
  fi

  echo "$obj_sha"
}

> actions-latest.txt

while IFS='|' read -r action current_sha current_tag; do
  echo "Resolving ${action}..."

  # Get latest release tag
  latest_tag=$(gh api "repos/${action}/releases/latest" --jq '.tag_name' 2>/dev/null || echo "")

  # Validate tag is strict semver
  if [[ -n "$latest_tag" ]] && [[ ! "$latest_tag" =~ $SEMVER_RE ]]; then
    echo "  Warning: latest release tag '${latest_tag}' is not strict semver, trying tags API"
    latest_tag=""
  fi

  # Fallback: tags API, find first strict semver tag
  if [[ -z "$latest_tag" ]]; then
    latest_tag=$(gh api "repos/${action}/tags" --jq '.[].name' 2>/dev/null \
      | grep -E "$SEMVER_RE" \
      | head -1 || echo "")
  fi

  if [[ -z "$latest_tag" ]]; then
    echo "  Warning: no valid semver tag found for ${action}, skipping"
    sleep 0.5
    continue
  fi

  # Resolve tag to commit SHA
  latest_sha=$(resolve_tag_sha "$action" "$latest_tag") || {
    echo "  Warning: could not resolve SHA for ${action}@${latest_tag}, skipping"
    sleep 0.5
    continue
  }

  # Validate resolved SHA
  if [[ ! "$latest_sha" =~ ^[a-f0-9]{40}$ ]]; then
    echo "  Warning: resolved SHA '${latest_sha}' is invalid for ${action}, skipping"
    sleep 0.5
    continue
  fi

  echo "${action}|${current_sha}|${current_tag}|${latest_sha}|${latest_tag}" >> actions-latest.txt
  echo "  ${latest_tag} (${latest_sha:0:7})"

  sleep 0.5
done < actions-current.txt
