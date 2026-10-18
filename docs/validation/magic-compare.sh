#!/bin/bash
# bash docs/validation/magic-compare.sh [designs...] : browser Magic (DRC + SPICE extraction) vs native Magic in container gf180, same routed DEF and PDK files.
# Writes only under /foss/designs/nishkam_validation. Compares the DRC count, the DRC rule texts, the extracted SPICE and the GDS (as KLayout XOR, if present).
set -e; export MSYS_NO_PATHCONV=1
mkdir -p "${HOME_DESIGNS:-$HOME/eda/designs}/nishkam_validation"; cp docs/validation/gds-xor.py "${HOME_DESIGNS:-$HOME/eda/designs}/nishkam_validation/"
HD=${HOME_DESIGNS:-$HOME/eda/designs}/nishkam_validation/magic; C=/foss/designs/nishkam_validation/magic
for d in ${@:-sr8 adder2 tiny8}; do
  rm -rf "$HD/$d"; mkdir -p "$HD/$d"
  node docs/validation/magic-compare.mjs $d "$(cygpath -m "$HD/$d")" | tee docs/validation/logs/magic-browser-$d.txt
  docker exec gf180 bash -lc "cd $C/$d && magic -dnull -noconsole -norcfile run.tcl > native.log 2>&1" || true
  cp "$HD/$d/native.log" docs/validation/logs/magic-native-$d.txt
  nc=$(grep -o 'Total DRC errors found: [0-9]*' "$HD/$d/native.log" | grep -o '[0-9]*$')
  echo "native $d: DRC $nc tiles; browser: $(head -1 "$HD/$d/browser.drc")"
  sed -n 's/^RULE //p' "$HD/$d/native.log" | sort -u > "$HD/$d/n.rules"; t=$(cat "$HD/$d/top.txt")
  tail -n +2 "$HD/$d/browser.drc" | grep -v -e '^$' -e 'No errors found' | sort -u > "$HD/$d/b.rules"
  diff -q "$HD/$d/n.rules" "$HD/$d/b.rules" >/dev/null && echo "  rule texts identical" || echo "  rule texts differ (see $HD/$d/{n,b}.rules)"
  diff -q <(grep -v '^\*' "$HD/$d/$t.spice" | sed 's/\$SUB/SUB/g') <(grep -v '^\*' "$HD/$d/browser.spice" | sed 's/\$SUB/SUB/g') >/dev/null && echo "  extracted SPICE identical" || echo "  extracted SPICE differs"
  docker exec gf180 bash -lc "cd $C/$d && klayout -b -r /foss/designs/nishkam_validation/gds-xor.py -rd a=$t.gds -rd b=browser.gds -rd top=$t" 2>&1 | grep -e XOR -e layer | sed 's/^/  GDS /' | tee -a docs/validation/logs/magic-native-$d.txt
done
