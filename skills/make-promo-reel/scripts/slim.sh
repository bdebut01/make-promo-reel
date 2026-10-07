#!/bin/sh
# Shrink a finished reel's workspace to what spot fixes need, so the app clone and installs
# don't sit on disk for every reel. Everything removed can be rebuilt:
#
#   kept      studio source, promo.json, captures (frames + manifests), brand assets, the
#             lockfile, seed/reset/shot scripts, notes.md
#   saved     app.commit, app.patch (the clone's edits), app-extra/ (its untracked files),
#             app-env/ (its .env files), and rebuild-app.sh, which recreates app/ from them.
#             A copy made with `git archive` (no .git) needs app.commit written at export
#             time; its edits and new files are diffed against a fresh export into app.patch.
#   removed   app/, studio/node_modules, studio/out, logs/, stale login states
#
#   export PROMO_WS=<reel>/work PROMO_SRC=/path/to/users/checkout
#   sh <skill>/scripts/slim.sh --dry-run     # show what would happen
#   sh <skill>/scripts/slim.sh
#
# Afterwards: copy or timing fixes need `npm ci` in studio/; re-filming needs
# `sh rebuild-app.sh`, then setup.sh (or the steps in notes.md).

set -e
DRY=0; [ "$1" = "--dry-run" ] && DRY=1
HERE=$(cd "$(dirname "$0")" && pwd)
[ -n "$PROMO_WS" ] && [ -d "$PROMO_WS" ] || { echo "slim: PROMO_WS must be the reel's work/ folder" >&2; exit 1; }
cd "$PROMO_WS"
before=$(du -sh . | cut -f1)

if [ -d app/.git ]; then
  commit=$(git -C app rev-parse HEAD)
  # Rebuild from the user's checkout: the clone's origin can be a path that has since moved.
  src=${PROMO_SRC:-$(git -C app remote get-url origin 2>/dev/null)}
  git -C "$src" cat-file -e "$commit^{commit}" 2>/dev/null || echo "slim: warning: $src doesn't have $commit; rebuild-app.sh will need a source that does" >&2
  if [ $DRY = 1 ]; then
    echo "would save: app.commit ($commit), app.patch ($(git -C app diff --stat | tail -1 | sed 's/^ *//'))"
    git -C app ls-files --others --exclude-standard | sed 's/^/would save untracked: /'
    for f in app/.env*; do case "$f" in *.example) ;; *) [ -f "$f" ] && ! git -C app ls-files --error-unmatch "${f#app/}" >/dev/null 2>&1 && echo "would save env: ${f#app/}" ;; esac; done
  else
    echo "$commit" > app.commit
    git -C app diff > app.patch
    rm -rf app-extra app-env; mkdir -p app-extra app-env
    git -C app ls-files --others --exclude-standard | while read -r f; do
      mkdir -p "app-extra/$(dirname "$f")"; cp "app/$f" "app-extra/$f"
    done
    for f in app/.env*; do case "$f" in *.example) ;; *) [ -f "$f" ] && ! git -C app ls-files --error-unmatch "${f#app/}" >/dev/null 2>&1 && cp "$f" app-env/ ;; esac; done
    rmdir app-extra 2>/dev/null || true
    cat > rebuild-app.sh <<EOF
#!/bin/sh
# Recreates app/ exactly as it was filmed: the checkout at the filmed commit, plus this
# reel's edits and local env. Then run setup.sh (or follow notes.md) to install and seed.
set -e
cd "\$(dirname "\$0")"
[ -e app ] && { echo "app/ already exists"; exit 1; }
git clone --local --no-checkout "$src" app
git -C app checkout -q "\$(cat app.commit)"
[ -s app.patch ] && git -C app apply ../app.patch
[ -d app-extra ] && cp -R app-extra/. app/
[ -d app-env ] && cp -R app-env/. app/
echo "app/ rebuilt at \$(git -C app rev-parse --short HEAD). Next: sh setup.sh (or notes.md)"
EOF
    chmod +x rebuild-app.sh
    echo "saved app.commit, app.patch, app-env/, rebuild-app.sh"
  fi
elif [ -d app ] && [ -s app.commit ]; then
  # A copy exported with `git archive` (the sandbox can refuse a clone): no .git, so the edits
  # are found by diffing the copy against a fresh export of the same commit.
  commit=$(cat app.commit)
  src=$PROMO_SRC
  [ -n "$src" ] && git -C "$src" cat-file -e "$commit^{commit}" 2>/dev/null || { echo "slim: PROMO_SRC must be a checkout that has $commit" >&2; exit 1; }
  tmp=$(mktemp -d "${TMPDIR:-/tmp}/slim.XXXXXX")
  mkdir "$tmp/a"
  git -C "$src" archive "$commit" | tar -x -C "$tmp/a"
  ln -s "$PROMO_WS/app" "$tmp/b"
  # Text edits only; databases, media and installs are rebuilt by setup.sh and the seed.
  (cd "$tmp" && diff -ruN -x node_modules -x .venv -x venv -x __pycache__ -x '*.pyc' -x '*.sqlite3' -x '*.db' \
    -x media -x uploads -x build -x dist -x .next -x staticfiles -x '.env*' -x '*.log' a b/ \
    | grep -v '^Binary files' > "$tmp/app.patch") || true
  if [ $DRY = 1 ]; then
    echo "would save: app.commit ($commit, exported copy), app.patch ($(grep -c '^+++ ' "$tmp/app.patch") files changed)"
    for f in app/.env*; do case "$f" in *.example) ;; *) [ -f "$f" ] && echo "would save env: ${f#app/}" ;; esac; done
  else
    cp "$tmp/app.patch" app.patch
    rm -rf app-env; mkdir -p app-env
    for f in app/.env*; do case "$f" in *.example) ;; *) [ -f "$f" ] && cp "$f" app-env/ ;; esac; done
    cat > rebuild-app.sh <<EOF
#!/bin/sh
# Recreates app/ as it was filmed: the filmed commit exported from the checkout, plus this
# reel's edits and local env. Then run setup.sh (or follow notes.md) to install and seed.
set -e
cd "\$(dirname "\$0")"
[ -e app ] && { echo "app/ already exists"; exit 1; }
mkdir app
git -C "$src" archive "\$(cat app.commit)" | tar -x -C app
[ -s app.patch ] && (cd app && patch -s -p1 < ../app.patch)
[ -d app-env ] && cp -R app-env/. app/
echo "app/ rebuilt at \$(cat app.commit | cut -c1-7). Next: sh setup.sh (or notes.md)"
EOF
    chmod +x rebuild-app.sh
    echo "saved app.commit, app.patch, app-env/, rebuild-app.sh"
  fi
  rm -rf "$tmp"
fi

targets=""
for t in app studio/node_modules studio/out logs; do [ -e "$t" ] && targets="$targets $PROMO_WS/$t"; done
for t in studio/auth*.json studio/*.auth.json; do [ -e "$t" ] && targets="$targets $PROMO_WS/$t"; done
[ -z "$targets" ] && { echo "nothing to remove"; exit 0; }

# shellcheck disable=SC2086
sh "$HERE/guard.sh" $targets || exit 1
if [ $DRY = 1 ]; then
  for t in $targets; do echo "would remove: ${t#$PROMO_WS/} ($(du -sh "$t" | cut -f1))"; done
  echo "now $before"
else
  # shellcheck disable=SC2086
  rm -rf $targets
  echo "slimmed $before -> $(du -sh . | cut -f1)"
fi
