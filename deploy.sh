#!/usr/bin/env bash
# deploy.sh — commit everything, push dev, fast-forward merge to main, push main, return to dev
# Usage: ./deploy.sh "your commit message"
set -euo pipefail

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  echo "Usage: ./deploy.sh \"commit message\""
  exit 1
fi

# Bump all ?v= cache-busting params in index.html to the next commit number
VERSION=$(( $(git rev-list --count HEAD) + 1 ))
sed -i "s/?v=[0-9][0-9]*/?v=$VERSION/g" public/index.html
echo "  cache version → v=$VERSION"

git add -A
git commit -m "$MSG"
git push origin dev
git checkout main
git merge dev --ff-only
git push origin main
git checkout dev
echo "✓ Deployed to dev + main"
