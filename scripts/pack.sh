#!/usr/bin/env bash
# Make plugin.tar.gz the way the Home Screens installer reads it: one root
# folder wrapping manifest.json and dist/bundle.js. The installer unpacks with
# --strip-components=1, so a flat tarball loses manifest.json and is refused.
set -euo pipefail
cd "$(dirname "$0")/.."

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

id=$(node -p "require('./manifest.json').id")
mkdir -p "$stage/$id/dist"
cp manifest.json "$stage/$id/"
cp dist/bundle.js "$stage/$id/dist/"
# Fixed owner and no macOS extended attributes, so the archive is the same
# wherever it is made.
COPYFILE_DISABLE=1 tar -czf plugin.tar.gz -C "$stage" "$id"
echo "plugin.tar.gz: $(tar -tzf plugin.tar.gz | tr '\n' ' ')"
