#!/usr/bin/env bash
# Decide whether this push should publish a release.
#
# Prints `version=<x.y.z>` and `publish=true|false` for $GITHUB_OUTPUT.
# Fails when manifest.json and package.json disagree on the version, so a
# half-done bump never ships. A version that already has a release is
# skipped, not failed: a push that only changes docs or tests is normal.
#
# Usage: scripts/release-check.sh [existing-tags-file]
# The tags file (one tag per line) stands in for `gh release list` in tests.
set -euo pipefail

manifest_version=$(node -p "require('./manifest.json').version")
package_version=$(node -p "require('./package.json').version")

if [ "$manifest_version" != "$package_version" ]; then
  echo "::error::manifest.json is $manifest_version but package.json is $package_version; bump both" >&2
  exit 1
fi
if ! [[ "$manifest_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "::error::manifest.json version \"$manifest_version\" is not semver" >&2
  exit 1
fi

tag="v$manifest_version"
if [ -n "${1:-}" ]; then
  existing=$(cat "$1")
else
  existing=$(gh release list --limit 1000 --json tagName --jq '.[].tagName')
fi

echo "version=$manifest_version"
if grep -qxF "$tag" <<<"$existing"; then
  echo "publish=false"
  echo "::notice::$tag is already released; bump the version in manifest.json and package.json to publish" >&2
else
  echo "publish=true"
fi
