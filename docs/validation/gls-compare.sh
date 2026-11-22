#!/bin/bash
# Native side of section 22. Usage: bash docs/validation/gls-compare.sh <outdir with the build phase files>
# Native Icarus 14.0 in the container, PDK's own gf180mcu_fd_sc_mcu7t5v0 models, -DFUNCTIONAL (no specify blocks, zero delay), no power pins.
set -e; export MSYS_NO_PATHCONV=1
OUT=$(cygpath -m "$1"); C=${CONTAINER:-gf180}; W=/tmp/nishkam_gls
P=/foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/verilog
docker exec -u 0 $C bash -c "rm -rf $W; mkdir -p $W; chmod 777 $W"
for t in shreg4 counter counter-bug tiny8; do
  docker cp "$OUT/$t" $C:$W/ >/dev/null; docker exec -u 0 $C chmod -R 777 $W
  docker exec $C bash -lc "cd $W/$t && iverilog -g2012 -DFUNCTIONAL -o rtl.vvp \$(cat top).v tb.v && vvp -n rtl.vvp >/dev/null && mv d.vcd native-rtl.vcd \
    && iverilog -g2012 -DFUNCTIONAL -o gate.vvp tb.v netlist.v $P/primitives.v $P/gf180mcu_fd_sc_mcu7t5v0.v && vvp -n gate.vvp >/dev/null && mv d.vcd native-gate.vcd"
  docker cp $C:$W/$t/native-rtl.vcd "$OUT/$t/" >/dev/null; docker cp $C:$W/$t/native-gate.vcd "$OUT/$t/" >/dev/null
done
echo native done
