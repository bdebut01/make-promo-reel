#!/bin/sh
# Checks that guard.sh passes workspace paths and refuses everything else.
#   sh tests/guard-test.sh
set -u
G="$(cd "$(dirname "$0")/.." && pwd)/scripts/guard.sh"
T=$(mktemp -d "${TMPDIR:-/tmp}/guard-test.XXXXXX")
mkdir -p "$T/ws/app" "$T/src"
ln -s "$T/src" "$T/ws/app/link-to-src"
export PROMO_WS="$T/ws" PROMO_SRC="$T/src"
fails=0
pass() { sh "$G" "$@" 2>/dev/null || { echo "FAIL: should pass: $*"; fails=$((fails + 1)); }; }
refuse() { if sh "$G" "$@" 2>/dev/null; then echo "FAIL: should refuse: $*"; fails=$((fails + 1)); fi; }

pass "$T/ws/app/db.sqlite3"
pass "$T/ws/app/media" "$T/ws/studio/out"
pass --db weekly_promo
refuse "$T/src/db.sqlite3"
refuse "$T/ws/../src/db.sqlite3"
refuse "$T/ws/app/link-to-src/db.sqlite3"
refuse "$T/elsewhere"
refuse "$T/ws"
refuse --db weekly
refuse --db weekly_promo_old
PROMO_WS="$T/src/inner" refuse "$T/src/inner/x"
PROMO_WS="$T" refuse "$T/ws/x"
PROMO_WS="" refuse "$T/ws/x"

rm -rf "$T"
[ "$fails" = 0 ] && echo "guard: all checks passed" || { echo "guard: $fails failed"; exit 1; }
