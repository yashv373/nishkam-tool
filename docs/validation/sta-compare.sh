#!/bin/bash
# bash docs/validation/sta-compare.sh : native OpenSTA (container gf180, read-only apart from /foss/designs/nishkam_validation) vs browser OpenSTA, full text diff.
# Run from the repo root, in Git Bash, from a folder where node finds @yowasp/yosys is not needed (STA only).
set -e; export MSYS_NO_PATHCONV=1
D=/foss/designs/nishkam_validation/sta; H=${HOME_DESIGNS:-$HOME/eda/designs}/nishkam_validation/sta
rm -rf "$H"; mkdir -p "$H"; node docs/validation/sta-compare.mjs "$(cygpath -m "$H")"
for t in shreg4 cnt8; do
  docker exec gf180 bash -lc "cd $D/$t && sta -no_init -exit run.tcl > native.out 2>&1"
  grep -v -e '^OpenSTA' -e '^License' -e '^This is free' -e '^This program' -e 'Copyright' -e '^Warranty' -e 'under the terms' -e 'under certain conditions' "$H/$t/native.out" | grep -v '^$' > "$H/$t/n.txt" || true
  grep -v '^$' "$H/$t/browser.out" > "$H/$t/b.txt"
  cp "$H/$t/native.out" docs/validation/logs/sta-native-$t.txt; cp "$H/$t/browser.out" docs/validation/logs/sta-browser-$t.txt
  if diff -q "$H/$t/n.txt" "$H/$t/b.txt" >/dev/null; then echo "$t: native and browser OpenSTA output IDENTICAL ($(wc -l <"$H/$t/b.txt") lines)"; else echo "$t: DIFFERENT"; diff "$H/$t/n.txt" "$H/$t/b.txt" | head -30; fi
done
