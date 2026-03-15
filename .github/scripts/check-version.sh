#!/usr/bin/env bash
set -euo pipefail

# Compare package.json version at HEAD vs HEAD~1.
# Output: GITHUB_OUTPUT changed (true/false), version (current version string)

CURRENT_VERSION=$(jq -r .version package.json)
PREVIOUS_VERSION=$(git show HEAD~1:package.json | jq -r .version 2>/dev/null || echo "")

echo "Current version:  $CURRENT_VERSION"
echo "Previous version: $PREVIOUS_VERSION"

if [[ "$CURRENT_VERSION" != "$PREVIOUS_VERSION" ]]; then
  echo "Version changed: $PREVIOUS_VERSION → $CURRENT_VERSION"
  echo "changed=true" >> "$GITHUB_OUTPUT"
else
  echo "Version unchanged"
  echo "changed=false" >> "$GITHUB_OUTPUT"
fi

echo "version=$CURRENT_VERSION" >> "$GITHUB_OUTPUT"
