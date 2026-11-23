#!/bin/bash
# Reproducible trace for Section 26: why tiny8 repair_design inserts 24 buffers
# (1 resized -> clkbuf_1, + wire50 clkbuf_4) in Studio OpenROAD 6f3f28c WASM
# vs 23 buffers (0 resized, dlyb_1/buf_2/buf_4) in native LibreLane 3.0.2.
#
# Prerequisites:
#   - Docker container `gf180` (hpretl/iic-osic-tools:chipathon26)
#   - Native LibreLane reference run at /foss/designs/nishkam_jobs/parity_tiny8ref
#   - Post-#213 browser run at /foss/designs/nishkam_jobs/sec26_post213_tiny8
#     (from: START_DEF=.../21-openroad-generatepdn/tiny8.def
#            SDC=.../28-openroad-globalplacement/tiny8.sdc
#            PNRC=1 OUT=.../sec26_post213_tiny8
#            node web/studio/engines/librelane-flow.selftest.mjs tiny8)
#   - Native OpenROAD 6f3f28c binary at /tmp/nb/openroad (or image or-native-61:6f3f28c)
set -euo pipefail

OUT=${OUT:-/tmp/sec26_buf24_repro}
mkdir -p "$OUT"

NDIR=/foss/designs/nishkam_jobs/parity_tiny8ref/runs/run
BDIR=/foss/designs/nishkam_jobs/sec26_post213_tiny8
L=/foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/lib
TLEF=/foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/techlef/gf180mcu_fd_sc_mcu7t5v0__nom.tlef
LEF=/foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/lef/gf180mcu_fd_sc_mcu7t5v0.lef
RCX_RULES=/foss/pdks/gf180mcuD/libs.tech/librelane/rules.openrcx.gf180mcuD.nom
BASE_SDC=/usr/local/lib/python3.12/dist-packages/librelane/scripts/base.sdc

EXCL_BASE="gf180mcu_fd_sc_mcu7t5v0__mux2_1 gf180mcu_fd_sc_mcu7t5v0__oai33_2"
EXCL_PIN="$EXCL_BASE gf180mcu_fd_sc_mcu7t5v0__buf_1 gf180mcu_fd_sc_mcu7t5v0__dlya_1 gf180mcu_fd_sc_mcu7t5v0__dlya_2 gf180mcu_fd_sc_mcu7t5v0__dlya_4 gf180mcu_fd_sc_mcu7t5v0__dlyc_1 gf180mcu_fd_sc_mcu7t5v0__dlyc_2 gf180mcu_fd_sc_mcu7t5v0__dlyc_4 gf180mcu_fd_sc_mcu7t5v0__dlyd_1 gf180mcu_fd_sc_mcu7t5v0__dlyd_2 gf180mcu_fd_sc_mcu7t5v0__dlyd_4 gf180mcu_fd_sc_mcu7t5v0__dlyb_2 gf180mcu_fd_sc_mcu7t5v0__dlyb_4"

echo "=== OpenROAD binaries ==="
echo -n "openroad-librelane (used by /foss/tools/bin/librelane): "
/foss/tools/openroad-librelane/bin/openroad -version
echo -n "openroad (/foss/tools/openroad/bin/openroad):           "
/foss/tools/openroad/bin/openroad -version
if [ -x /tmp/nb/openroad ]; then
  echo -n "openroad-6f3f28c (/tmp/nb/openroad):                    "
  /tmp/nb/openroad -version
fi

cat > "$OUT/run_case.tcl" << 'EOF'
read_lef $::env(TLEF)
read_lef $::env(LEF)
set corners {
  max_ff_n40C_5v50 ff_n40C_5v50
  max_tt_025C_5v00 tt_025C_5v00
  nom_ff_n40C_5v50 ff_n40C_5v50
  nom_tt_025C_5v00 tt_025C_5v00
  min_ss_125C_4v50 ss_125C_4v50
  min_ff_n40C_5v50 ff_n40C_5v50
  min_tt_025C_5v00 tt_025C_5v00
  max_ss_125C_4v50 ss_125C_4v50
  nom_ss_125C_4v50 ss_125C_4v50
}
set cnames {}
foreach {c f} $corners { lappend cnames $c }
define_corners {*}$cnames
foreach {c f} $corners { read_liberty -corner $c "$::env(LIBDIR)/gf180mcu_fd_sc_mcu7t5v0__$f.lib" }
read_def $::env(IN_DEF)
read_sdc $::env(IN_SDC)
unset_propagated_clock [all_clocks]
set_dont_use $::env(EXCL)
set_routing_layers -signal Metal2-Metal5 -clock Metal2-Metal5
set_wire_rc -clock -layers {Metal2 Metal3 Metal4 Metal5}
set_wire_rc -signal -layers {Metal2 Metal3 Metal4 Metal5}
estimate_parasitics -placement
buffer_ports -inputs
buffer_ports -outputs
if { [info exists ::env(RSZ_DBG)] && $::env(RSZ_DBG) == 1 } {
  set_debug_level RSZ repair_net 3
}
repair_design -verbose -max_wire_length 0 -slew_margin 20 -cap_margin 20
write_verilog $::env(OUT_V)
set hist [dict create]
foreach inst [[ord::get_db_block] getInsts] {
  set n [$inst getName]
  if {[regexp {^(input|output|fanout|wire|max_cap|rebuffer|clone|hold)} $n]} {
    dict incr hist [[$inst getMaster] getName]
  }
}
puts "@@HIST [lsort -stride 2 $hist]"
EOF

REF_DEF="$NDIR/28-openroad-globalplacement/tiny8.def"
REF_SDC="$NDIR/28-openroad-globalplacement/tiny8.sdc"
BRW_DEF="$BDIR/ll/gpl.def"

run_case() {
  local lbl="$1" bin="$2" def="$3" excl="$4" dbg="${5:-0}"
  echo "--- $lbl ---"
  TLEF="$TLEF" LEF="$LEF" LIBDIR="$L" IN_DEF="$def" IN_SDC="$REF_SDC" EXCL="$excl" OUT_V="$OUT/${lbl}.v" RSZ_DBG="$dbg" \
    "$bin" -threads 1 -exit -no_splash "$OUT/run_case.tcl" > "$OUT/${lbl}.log" 2>&1
  grep -E 'RSZ-0027|RSZ-0028|RSZ-0034|RSZ-0035|RSZ-0038|RSZ-0039|@@HIST' "$OUT/${lbl}.log"
}

run_case ll_or__ref__nopin  /foss/tools/openroad-librelane/bin/openroad "$REF_DEF" "$EXCL_BASE" 1
run_case ll_or__ref__pin    /foss/tools/openroad-librelane/bin/openroad "$REF_DEF" "$EXCL_PIN"
run_case ll_or__brw__nopin  /foss/tools/openroad-librelane/bin/openroad "$BRW_DEF" "$EXCL_BASE"
run_case ll_or__brw__pin    /foss/tools/openroad-librelane/bin/openroad "$BRW_DEF" "$EXCL_PIN"
run_case or619__ref__nopin  /foss/tools/openroad/bin/openroad           "$REF_DEF" "$EXCL_BASE" 1
run_case or619__ref__pin    /foss/tools/openroad/bin/openroad           "$REF_DEF" "$EXCL_PIN"
run_case or619__brw__nopin  /foss/tools/openroad/bin/openroad           "$BRW_DEF" "$EXCL_BASE"
run_case or619__brw__pin    /foss/tools/openroad/bin/openroad           "$BRW_DEF" "$EXCL_PIN"
if [ -x /tmp/nb/openroad ]; then
  run_case or6f3__ref__nopin /tmp/nb/openroad "$REF_DEF" "$EXCL_BASE"
  run_case or6f3__ref__pin   /tmp/nb/openroad "$REF_DEF" "$EXCL_PIN"
  run_case or6f3__brw__nopin /tmp/nb/openroad "$BRW_DEF" "$EXCL_BASE"
  run_case or6f3__brw__pin   /tmp/nb/openroad "$BRW_DEF" "$EXCL_PIN" 1
fi

echo "=== Exact LibreLane OpenRCX (-lef_res) + nom_tt_025C_5v00 STA (sta 3.1.0) ==="
export CLOCK_PORT=clk CLOCK_PERIOD=24 IO_DELAY_CONSTRAINT=20 OUTPUT_CAP_LOAD=72.91
export CLOCK_UNCERTAINTY_CONSTRAINT=0.25 CLOCK_TRANSITION_CONSTRAINT=0.15 TIME_DERATING_CONSTRAINT=5
export MAX_FANOUT_CONSTRAINT=10 MAX_TRANSITION_CONSTRAINT=3 MAX_CAPACITANCE_CONSTRAINT=0.2
export SYNTH_DRIVING_CELL="gf180mcu_fd_sc_mcu7t5v0__inv_1/ZN"
export SYNTH_CLK_DRIVING_CELL="gf180mcu_fd_sc_mcu7t5v0__inv_4/ZN"

cat > "$OUT/rcx.tcl" << 'EOF'
read_lef $::env(TLEF)
read_lef $::env(LEF)
read_liberty "$::env(LIBDIR)/gf180mcu_fd_sc_mcu7t5v0__tt_025C_5v00.lib"
read_def $::env(IN_DEF)
read_sdc $::env(IN_SDC)
define_process_corner -ext_model_index 0 CURRENT_CORNER
extract_parasitics -ext_model_file $::env(RCX_RULES) -lef_res
write_spef $::env(OUT_SPEF)
EOF

cat > "$OUT/sta.tcl" << 'EOF'
read_liberty "$::env(LIBDIR)/gf180mcu_fd_sc_mcu7t5v0__tt_025C_5v00.lib"
read_verilog $::env(IN_V)
link_design tiny8
read_sdc $::env(IN_SDC)
read_spef $::env(IN_SPEF)
set_propagated_clock [all_clocks]
puts "@@STA310 $::env(LABEL) setup=[format %.4f [sta::worst_slack -max]] hold=[format %.4f [sta::worst_slack -min]]"
EOF

for spec in "browser_post213:$BDIR/tiny8_route.def:$BDIR/ll/drt.v" \
            "native_ref_52:$NDIR/52-openroad-fillinsertion/tiny8.def:$NDIR/52-openroad-fillinsertion/tiny8.nl.v"; do
  IFS=: read -r lbl def netv <<< "$spec"
  TLEF="$TLEF" LEF="$LEF" LIBDIR="$L" IN_DEF="$def" IN_SDC="$BASE_SDC" RCX_RULES="$RCX_RULES" OUT_SPEF="$OUT/${lbl}.spef" \
    /foss/tools/openroad-librelane/bin/openroad -threads 1 -exit -no_splash "$OUT/rcx.tcl" > "$OUT/rcx_${lbl}.log" 2>&1
  LIBDIR="$L" IN_V="$netv" IN_SDC="$BASE_SDC" IN_SPEF="$OUT/${lbl}.spef" LABEL="$lbl" \
    sta -exit -no_init "$OUT/sta.tcl" 2>&1 | grep '@@STA310'
done
