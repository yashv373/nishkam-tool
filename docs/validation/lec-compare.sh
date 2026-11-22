#!/bin/bash
# Native side of section 23. Usage: bash docs/validation/lec-compare.sh <outdir from the build phase>
# Native Yosys 0.64 runs the scripts the page runs (our Yosys-friendly models), the same scripts with the PDK liberty instead of the models, and EQY on RTL vs netlist + liberty.
set -e; export MSYS_NO_PATHCONV=1
LIM=${LIM:-900}; OUT=$(cygpath -m "$1"); C=${CONTAINER:-gf180}; W=/tmp/nishkam_lec
docker exec -u 0 $C bash -c "rm -rf $W; mkdir -p $W; chmod 777 $W"
for d in "$OUT"/*/; do
  t=$(basename "$d"); docker cp "$OUT/$t" $C:$W/ >/dev/null; docker exec -u 0 $C chmod -R 777 $W
  docker exec $C bash -lc "cd $W/$t && for s in '' _lib; do
      timeout $LIM yosys -l equiv\$s.log equiv\$s.ys >/dev/null 2>&1 || true
      timeout $LIM yosys -l miter_ind\$s.log miter_ind\$s.ys >/dev/null 2>&1 || true; rm -f cex.vcd
      timeout $LIM yosys -l miter_bmc\$s.log miter_bmc\$s.ys >/dev/null 2>&1 || true
      [ -f cex.vcd ] && mv cex.vcd cex_x\$s.vcd || true
    done; (timeout $LIM eqy -f $t.eqy > $t.eqy.log 2>&1 || true)" >/dev/null 2>&1
  docker cp $C:$W/$t/. "$OUT/$t/" >/dev/null
done
echo native done
