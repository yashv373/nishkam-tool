#!/bin/bash
# Native OpenROAD (container gf180, same commit 61932e8) on the same Tcl and inputs as the WebAssembly flow; one thread. See pnr-native.mjs.
export MSYS_NO_PATHCONV=1
D=${1:-tiny8}; J=/foss/designs/nishkam_jobs/pnr_native_$D
docker start gf180 > /dev/null
for s in place route; do
  time docker exec -w $J gf180 bash -lc "openroad -threads 1 -no_splash -exit $J/$s.tcl > $J/$s.log 2>&1"
done
