#!/bin/bash
# Native side of section 24. Usage: bash docs/validation/pnr-more.sh <outdir from pnr-more.mjs run>
# 1) OpenROAD 6f3f28c (image or-native-61:6f3f28c, one thread) on the browser's own place / cts / route Tcl and the same synthesized netlist.
# 2) native sta 3.1.0 (container) on the reports' Tcl: pre-route on the synthesized netlist, post-route on the BROWSER's CTS netlist + SPEF (same inputs, so only the timer differs).
set -e; export MSYS_NO_PATHCONV=1
OUT=$(cygpath -m "$1"); C=${CONTAINER:-gf180}
# step 1, native OpenROAD, same order as the browser flow: place, cts, route
docker run --rm --entrypoint bash -v "$OUT:/w" or-native-61:6f3f28c -c 'cd /w
top=$(ls *.synth.v | sed s/.synth.v//)
( time /build/bin/openroad -threads 1 -exit place.tcl ) > n-place.log 2>&1; cp ${top}_place.def placed.def
( time /build/bin/openroad -threads 1 -exit cts.tcl ) > n-cts.log 2>&1; cp ${top}_cts.def in.def
( time /build/bin/openroad -threads 1 -exit route.tcl ) > n-route.log 2>&1; ls'
# step 2, native sta
W=/tmp/nishkam_sta; docker exec -u 0 $C bash -c "rm -rf $W; mkdir -p $W; chmod 777 $W"
for k in pre post; do
  docker exec -u 0 $C bash -c "mkdir -p $W/$k; chmod 777 $W/$k"
  docker cp "$OUT/lib.lib" $C:$W/$k/lib.lib >/dev/null
  if [ $k = pre ]; then docker cp "$OUT/synth.v" $C:$W/$k/design.v >/dev/null; else docker cp "$OUT/cts.v" $C:$W/$k/design.v >/dev/null; docker cp "$OUT/route.spef" $C:$W/$k/design.spef >/dev/null; fi
  docker cp "$OUT/sta-$k.run.tcl" $C:$W/$k/run.tcl >/dev/null
  docker exec -u 0 $C chmod -R 777 $W
  docker exec $C bash -lc "cd $W/$k && sed -i 's|/w/|$W/$k/|g' run.tcl && sta -no_init -exit run.tcl > native.out 2>&1" >/dev/null 2>&1 || true
  docker cp $C:$W/$k/native.out "$OUT/sta-$k.native.out" >/dev/null
done
echo native done
