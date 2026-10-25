set_thread_count 1
read_lef /w/tech.lef
read_lef /w/cells.lef
read_liberty /w/lib.lib
read_def /w/placed.def
read_sdc /w/constraints.sdc
set f [open /w/drc_exclude.cells]
set_dont_use [string trim [read $f]]; close $f
set layers [list]
foreach l [[ord::get_db_tech] getLayers] { if {[$l getType] == "ROUTING"} { lappend layers [$l getName] } }
set_wire_rc -clock -layers $layers
set_wire_rc -signal -layers $layers
estimate_parasitics -placement
repair_clock_inverters
configure_cts_characterization
clock_tree_synthesis -buf_list {gf180mcu_fd_sc_mcu7t5v0__clkbuf_8 gf180mcu_fd_sc_mcu7t5v0__clkbuf_4 gf180mcu_fd_sc_mcu7t5v0__clkbuf_2} -root_buf gf180mcu_fd_sc_mcu7t5v0__clkbuf_8 -sink_clustering_enable -apply_ndr half
set_propagated_clock [all_clocks]
estimate_parasitics -placement
repair_clock_nets -max_wire_length 0
estimate_parasitics -placement
remove_fillers
detailed_placement -max_displacement {500 100}
optimize_mirroring
check_placement -verbose
estimate_parasitics -placement
puts "@@STEP timing repair"
set_layer_rc -layer Metal2 -resistance 3.85861E-04 -capacitance 1.35357E-04
set_layer_rc -layer Metal3 -resistance 2.06673E-04 -capacitance 1.46141E-04
set_layer_rc -layer Metal4 -resistance 1.68609E-04 -capacitance 1.50688E-04
set_layer_rc -layer Metal5 -resistance 7.92778E-05 -capacitance 1.55595E-04
set_wire_rc -signal -layer Metal2
set_wire_rc -clock -layer Metal4
estimate_parasitics -placement
puts "REPAIR_BEFORE setup [sta::worst_slack -max] hold [sta::worst_slack -min] tns [sta::total_negative_slack -max]"
repair_timing -setup -verbose
repair_timing -hold -verbose
detailed_placement
check_placement -verbose
estimate_parasitics -placement
puts "REPAIR_AFTER setup [sta::worst_slack -max] hold [sta::worst_slack -min] tns [sta::total_negative_slack -max]"
puts "@@REPORT"
report_cts
report_clock_skew
report_clock_latency
set n 0; foreach i [[ord::get_db_block] getInsts] { if {[string match *clkbuf* [[$i getMaster] getName]]} {incr n} }
puts "CLKBUF_COUNT $n"
write_def /w/tiny8_cts.def
write_verilog -remove_cells {gf180mcu_fd_sc_mcu7t5v0__filltie gf180mcu_fd_sc_mcu7t5v0__endcap} /w/tiny8_cts.v
puts "@@DONE"
