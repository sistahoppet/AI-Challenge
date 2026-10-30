#!/bin/sh
# Pull-based deploy (valencia): move the checkout to origin/live, which CI only moves after green checks on main.
# Run by frontend-deploy.timer every minute. serve.py re-reads changed files itself, so no restart.
set -eu
cd "${FRONTEND_DIR:-$HOME/frontend}"
git fetch -q origin live 2>/dev/null || exit 0          # no live branch yet
new=$(git rev-parse FETCH_HEAD)
[ "$(git rev-parse HEAD)" = "$new" ] && exit 0
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "local changes in $(pwd), not deploying $new" >&2; exit 1
fi
git checkout -q -B live "$new"
echo "deployed $(git log --oneline -1)"
