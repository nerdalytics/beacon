#!/usr/bin/env bash
set -euo pipefail

# Verify package.json and jsr.json have the same version.
# Fails with exit code 1 if they differ.

PKG_VERSION=$(jq -r .version package.json)
JSR_VERSION=$(jq -r .version jsr.json)

echo "package.json version: $PKG_VERSION"
echo "jsr.json version:     $JSR_VERSION"

if [[ "$PKG_VERSION" != "$JSR_VERSION" ]]; then
  echo "ERROR: Version mismatch between package.json and jsr.json"
  exit 1
fi

echo "Versions match"
