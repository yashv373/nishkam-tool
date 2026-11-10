#!/bin/bash
# Formal equivalence of two Verilog files with Yosys, run INSIDE container gf180 (cwd /foss/designs/nishkam_jobs/parity_eq).
#   equiv.sh <A.v> <B.v> <top> <label>      prints  p1=<exit> p2=<exit>   (0 = PROVEN)
# A and B may be RTL or gf180 gate netlists. gf180 cells come from the PDK liberty (tt 5V), so their logic is the real cell function.
# Two independent proofs, each its own yosys run:
#   p1: equiv_make / equiv_simple / equiv_induct / equiv_status -assert
#   (anonymous _NNN_ wires are hidden before equiv_make, otherwise it pairs same-named but unrelated wires of the two netlists)
#   (splitnets: RTL vectors r0[7:0] become bits r0[0].. like the netlist names)
#   p3: bounded check from the all-zero state, BMC cycles (default 20). SEQ=1 skips p2 (tempinduct is slow without state matching)
#   p2: miter + sat -tempinduct -prove-asserts (-verify makes yosys exit non-zero if not proven)
export PATH=/foss/tools/bin:$PATH
A=$1; B=$2; T=$3; L=$4
LIB=/foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/lib/gf180mcu_fd_sc_mcu7t5v0__tt_025C_5v00.lib
HEAD="read_liberty -ignore_miss_func -ignore_miss_dir -ignore_miss_data_latch -ignore_buses $LIB
read_verilog -sv $A
rename $T gold
read_verilog -sv $B
rename $T gate
proc
flatten
async2sync
opt_clean"
printf '%s\n' "$HEAD" "splitnets" "rename -hide w:_*" "opt_clean -purge" "equiv_make gold gate eq" "hierarchy -top eq" "equiv_simple -seq 5" "equiv_induct -seq 5" "equiv_status -assert" > ${L}_1.ys
printf '%s\n' "$HEAD" "miter -equiv -flatten -make_assert -ignore_gold_x gold gate m" "hierarchy -top m" "sat -verify -prove-asserts -tempinduct -set-init-zero -maxsteps 8" > ${L}_2.ys
printf '%s\n' "$HEAD" "miter -equiv -flatten -make_assert -ignore_gold_x gold gate m" "hierarchy -top m" "sat -verify -prove-asserts -set-init-zero -seq ${BMC:-20}" > ${L}_3.ys
yosys -l ${L}_1.log ${L}_1.ys > /dev/null 2>&1; r1=$?
if [ -n "$SEQ" ]; then r2=skip; else timeout 300 yosys -l ${L}_2.log ${L}_2.ys > /dev/null 2>&1; r2=$?; fi
timeout 600 yosys -l ${L}_3.log ${L}_3.ys > /dev/null 2>&1; r3=$?
echo "p1=$r1 p2=$r2 p3=$r3"
