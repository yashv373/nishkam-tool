#!/bin/bash
# bash docs/validation/sta-magic-spef.sh : Magic SPEF (tiny8, old browser flow) -> browser OpenSTA and native `sta` 3.1.0 (container gf180), same files, full diff.
# Run from the repo root with @yowasp/yosys resolvable (see pd.flow.mjs). Needs container gf180 running. Writes under $HOME_DESIGNS/nishkam_magicspef.
set -e; export MSYS_NO_PATHCONV=1
H=${HOME_DESIGNS:-/c/Users/Asus/eda/designs}/nishkam_magicspef; D=/foss/designs/nishkam_magicspef
rm -rf "$H"; mkdir -p "$H"; node docs/validation/sta-magic-spef.mjs "$(cygpath -m "$H")"
L=docs/validation/logs/sta-magic-spef; mkdir -p $L
for n in nospef spef; do d=$H/$n
  docker exec gf180 bash -lc "cd $D/$n && sta -no_init -exit run.tcl > native.out 2>&1"
  grep -v -e '^OpenSTA' -e '^License' -e '^This is free' -e '^This program' -e 'Copyright' -e '^Warranty' -e 'under the terms' -e 'under certain conditions' "$d/native.out" | grep -v '^$' > "$d/n.txt" || true
  grep -v '^$' "$d/browser.out" > "$d/b.txt"
  if diff -q "$d/n.txt" "$d/b.txt" >/dev/null; then echo "$n: IDENTICAL ($(wc -l <"$d/b.txt") lines)"; else echo "$n: DIFFERENT"; diff "$d/n.txt" "$d/b.txt" | head -20; fi
  cp $d/n.txt $L/native-$n.txt; cp $d/b.txt $L/browser-$n.txt; cp $d/run.tcl $L/run-$n.tcl
done
cp $H/spef/tiny8.spef $L/tiny8.magic.spef
