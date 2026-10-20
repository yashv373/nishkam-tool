#!/bin/bash
# bash docs/validation/netgen-compare.sh [designs...] : browser flow + browser Netgen, then NATIVE Netgen in container gf180 on the very same files (lvs-dump.mjs).
# Writes only under /foss/designs/nishkam_validation. Compares the verdict and the device / net counts of the two Netgen logs.
set -e; export MSYS_NO_PATHCONV=1
HD=${HOME_DESIGNS:-/c/Users/Asus/eda/designs}/nishkam_validation/lvs; C=/foss/designs/nishkam_validation/lvs
for d in ${@:-adder2 mult8 tiny8}; do
  rm -rf "$HD/$d"; mkdir -p "$HD/$d"
  node docs/validation/lvs-dump.mjs $d "$(cygpath -m "$HD/$d")" | tee docs/validation/logs/netgen-browser-$d.txt
  docker exec gf180 bash -lc "cd $C/$d && netgen -batch source run.tcl > native.log 2>&1" || true
  cp "$HD/$d/native.log" docs/validation/logs/netgen-native-$d.log
  echo "native $d: $(grep -e '^Circuit 1 contains' "$HD/$d/native.log" | tail -2 | tr "\n" ' ') $(grep -m1 -e 'Circuits match' -e 'do not match' "$HD/$d/native.log")"
done
