#!/bin/bash
# bash docs/validation/sta-comb.sh : adder2 combinational timing with a virtual clock, browser OpenSTA vs native `sta` 3.1.0 (container gf180), same netlist, liberty and Tcl.
# Run from the repo root with @yowasp/yosys resolvable. Writes under $HOME_DESIGNS/nishkam_comb; logs to docs/validation/logs/sta-comb/.
set -e; export MSYS_NO_PATHCONV=1
H=${HOME_DESIGNS:-/c/Users/Asus/eda/designs}/nishkam_comb; D=/foss/designs/nishkam_comb
rm -rf "$H"; mkdir -p "$H"; node docs/validation/sta-comb.mjs "$(cygpath -m "$H")"
# the browser liberty must be byte-identical to the container's
md5sum "$H/lib.lib"; docker exec gf180 md5sum /foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/lib/gf180mcu_fd_sc_mcu7t5v0__tt_025C_5v00.lib
# native reads the container's own liberty; same Tcl otherwise
sed 's#lib.lib#/foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/lib/gf180mcu_fd_sc_mcu7t5v0__tt_025C_5v00.lib#' "$H/run.tcl" > "$H/run-native.tcl"
docker exec gf180 bash -lc "cd $D && sta -no_init -exit run-native.tcl > native.out 2>&1"
grep -v -e '^OpenSTA' -e '^License' -e '^This is free' -e '^This program' -e 'Copyright' -e '^Warranty' -e 'under the terms' -e 'under certain conditions' -e INFO "$H/native.out" | grep -v '^$' > "$H/n.txt" || true
grep -v '^$' "$H/browser.out" > "$H/b.txt"
L=docs/validation/logs/sta-comb; mkdir -p $L; cp $H/n.txt $L/native.txt; cp $H/b.txt $L/browser.txt; cp $H/run.tcl $L/run.tcl; cp $H/adder2.v $L/adder2.v
if diff -q "$H/n.txt" "$H/b.txt" >/dev/null; then echo "IDENTICAL ($(wc -l <"$H/b.txt") lines)"; else echo DIFFERENT; diff "$H/n.txt" "$H/b.txt" | head -20; fi
grep -E "^(worst slack|wns|tns)|^Total" "$H/b.txt"
