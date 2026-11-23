# OpenCDC vs Nishkam CDC grader (issue #113 phase 1)
OpenCDC 4101730f63ccd687354ad6316566c9e77b5f1f80; native Release -j8, BUILD_TESTING=ON, no changes needed; ctest 576/576 pass.
WASM skipped (scope cut).
Re-run: node scripts/ours.mjs (from Keller repo dir); docker exec gf180 bash /foss/designs/opencdc/scripts/run.sh; python scripts/table.py > RESULTS.md
Setup (v2): sync2 input d is driven via a clk_a register in a wrapper (OpenCDC cannot give an input port a clock domain: no set_input_delay or port-to-clock in SDC/YAML). Only error+warning findings count (info = verified-safe audit trail).
Setup: SDC create_clock per clock port; netlist = yosys synth + dfflegalize to $_DFF_P_ + abc + write_verilog -noexpr, cells.yaml maps $_DFF_P_.
OpenCDC "none" = no findings. agree = (ours pass) == (OpenCDC RTL none).

case | ours | OpenCDC RTL | OpenCDC netlist | agree
--|--|--|--|--
cdc-sync2/reference_2_flops|pass|none|CDC001x1|yes
cdc-sync2/3_flops|pass|none|CDC001x1|yes
cdc-sync2/1_flop|struct|CDC001x1|CDC001x1|yes
cdc-sync2/logic_between_the_flops|struct|CDC001x1|CDC001x1|yes
cdc-sync2/d_also_used_elsewhere|struct|CDC001x1|CDC001x1|yes
cdc-sync2/q_d_bypass_with_kept_dummy_chain_83_P26|struct|none|CDC001x1|no
cdc-sync2/inverted_output_wrong_value|cex|none|CDC001x1|no
cdc-async-fifo/reference_Gray_pointers|pass|CDC001x2 CDC002x2 CDC013x4|CDC001x4 CDC002x4|no
cdc-async-fifo/Gray_flags_one_cycle_later|pass|CDC001x2 CDC002x2 CDC013x6|CDC001x4 CDC002x4|no
cdc-async-fifo/binary_pointers_2_flop_sync_per_bit|cex|CDC001x2 CDC002x2 CDC013x4|CDC001x2 CDC002x2|yes
cdc-async-fifo/pointers_cross_with_one_flop|struct|CDC001x2 CDC002x2 CDC013x4|CDC001x4 CDC002x4|yes
cdc-pulse-sync/reference_toggle_2_flops_edge|pass|none|CDC001x1|yes
cdc-pulse-sync/1_flop|struct|none|CDC001x1|no

agree 8/13

Notes: with the wrapper, OpenCDC separates the sync2 variants it can see (1_flop error; 2/3 flops info) but not logic-between/bypass/inverted-output. FIFO Gray references still get CDC001/002/007 errors (wide Gray syncs: known gap); pulse toggle reference is info only. No constraint option removes the FIFO flags.
