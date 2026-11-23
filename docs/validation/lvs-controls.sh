#!/bin/bash
# bash docs/validation/lvs-controls.sh : sr8 LVS negative controls (swapped gate nets, VSS shorted to VDD) in browser Netgen and native Netgen 1.5.318 on the same files.
# Run from the repo root. Container gf180 must run. Logs: docs/validation/logs/lvs-controls/.
set -e; export MSYS_NO_PATHCONV=1
H=${HOME_DESIGNS:-/c/Users/Asus/eda/designs}/nishkam_ctl; C=/foss/designs/nishkam_ctl; L=docs/validation/logs/lvs-controls; mkdir -p $L
rm -rf "$H"; mkdir -p "$H"
node docs/validation/lvs-controls.mjs "$(cygpath -m "$H")" | tee $L/browser-summary.txt
for k in good swap short short1; do
  docker exec gf180 bash -lc "cd $C/$k && netgen -batch source run.tcl > native.log 2>&1" || true
  cp "$H/$k/native.log" $L/native-$k.log; cp "$H/$k/browser.lvs.txt" $L/browser-$k.txt; cp "$H/$k/out.txt" $L/native-$k.out.txt; cmp $L/native-$k.out.txt $L/browser-$k.txt && echo "  report identical: $k"
  echo "native $k: $(grep -e '^Circuit 1 contains' "$H/$k/native.log" | tail -2 | tr "\n" ' ') $(grep -m1 -e 'Circuits match' -e 'do not match' "$H/$k/native.log")"
done
