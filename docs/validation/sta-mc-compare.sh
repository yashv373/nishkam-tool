#!/bin/bash
# bash docs/validation/sta-mc-compare.sh <selftest OUT dir> : native OpenSTA (container gf180, /foss/tools/openroad/bin/sta) vs browser OpenSTA, every corner, full text diff.
# Run `OUT=<dir> node web/studio/engines/pnr-flow.selftest.mjs tiny8` first. Writes to $HOME_DESIGNS/nishkam_mc/cmp (default /c/Users/Asus/eda/designs).
set -e; export MSYS_NO_PATHCONV=1
H=${HOME_DESIGNS:-/c/Users/Asus/eda/designs}/nishkam_mc/cmp; D=/foss/designs/nishkam_mc/cmp
rm -rf "$H"; mkdir -p "$H"; node docs/validation/sta-mc-compare.mjs "$1" "$(cygpath -m "$H")"
for d in "$H"/*/; do n=$(basename "$d")
  docker exec gf180 bash -lc "cd $D/$n && sta -no_init -exit run.tcl > native.out 2>&1"
  grep -v -e '^OpenSTA' -e '^License' -e '^This is free' -e '^This program' -e 'Copyright' -e '^Warranty' -e 'under the terms' -e 'under certain conditions' "$d/native.out" | grep -v '^$' > "$d/n.txt" || true
  grep -v '^$' "$d/browser.out" > "$d/b.txt"
  w=$(grep -E "^(worst slack|tns)" "$d/b.txt" | tr '\n' ' ')
  if diff -q "$d/n.txt" "$d/b.txt" >/dev/null; then echo "$n: IDENTICAL ($(wc -l <"$d/b.txt") lines) $w"; else echo "$n: DIFFERENT $w"; diff "$d/n.txt" "$d/b.txt" | head -20; fi
done
