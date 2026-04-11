#!/usr/bin/env bash
# deploy.sh — commit everything, push dev, fast-forward merge to main, push main, return to dev
# Usage: ./deploy.sh "your commit message"
set -euo pipefail

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  echo "Usage: ./deploy.sh \"commit message\""
  exit 1
fi

git add -A
git commit -m "$MSG"
git push origin dev
git checkout main
git merge dev --ff-only
git push origin main
git checkout dev
echo "✓ Deployed to dev + main"
