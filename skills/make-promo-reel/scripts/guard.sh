#!/bin/sh
# Refuses to let a destructive step touch anything outside the promo workspace.
#
#   export PROMO_WS=<reels>/<app>-reel_<MM-DD-YY>/work   # the workspace
#   export PROMO_SRC=/path/to/the/users/checkout    # the user's own repo: never a target
#   sh <skill>/scripts/guard.sh app/db.sqlite3 app/media || exit 1
#   rm -f app/db.sqlite3 ...
#
# Each path is resolved (symlinks and ..) before checking, and a path that doesn't exist yet
# is resolved through its nearest existing parent. It passes only when it is inside PROMO_WS
# and not inside PROMO_SRC. With --db NAME, it checks a database name instead: it must end in
# _promo, so a dropdb or flush can never hit the user's dev database.

fail() { echo "guard: REFUSED — $*" >&2; exit 1; }

[ -n "$PROMO_WS" ] || fail "PROMO_WS is not set"
[ -n "$PROMO_SRC" ] || fail "PROMO_SRC is not set (the user's checkout)"
[ $# -gt 0 ] || fail "no paths given"

resolve() {
  python3 - "$1" <<'EOF'
import os, sys
p = os.path.abspath(os.path.expanduser(sys.argv[1]))
tail = []
while not os.path.exists(p):
    p, t = os.path.split(p)
    tail.insert(0, t)
print(os.path.join(os.path.realpath(p), *tail))
EOF
}

ws=$(resolve "$PROMO_WS")
src=$(resolve "$PROMO_SRC")
case "$ws/" in "$src"/*) fail "PROMO_WS ($ws) is inside the user's checkout ($src)";; esac
case "$src/" in "$ws"/*) fail "PROMO_WS ($ws) contains the user's checkout ($src): use a per-promo folder";; esac
[ "$ws" != "/" ] && [ "$ws" != "$HOME" ] || fail "PROMO_WS ($ws) is too broad"

if [ "$1" = "--db" ]; then
  shift
  for name in "$@"; do
    case "$name" in *_promo) ;; *) fail "database '$name' doesn't end in _promo";; esac
  done
  exit 0
fi

for p in "$@"; do
  r=$(resolve "$p")
  case "$r/" in "$src"/*) fail "$p resolves into the user's checkout ($r)";; esac
  case "$r/" in "$ws"/*) ;; *) fail "$p resolves outside the workspace ($r)";; esac
  [ "$r" != "$ws" ] || fail "$p is the workspace itself"
done
