set_thread_count 1
read_lef /w/tech.lef
read_lef /w/cells.lef
read_liberty /w/lib.lib
read_def /w/in.def
set layers [list]
foreach l [[ord::get_db_tech] getLayers] { if {[$l getType] == "ROUTING"} { lappend layers [$l getName] } }
set_wire_rc -clock -layers $layers
set_wire_rc -signal -layers $layers
set_routing_layers -signal Metal2-Metal4 -clock Metal2-Metal4
puts "@@STEP global route"
global_route -congestion_iterations 50
puts "@@STEP detailed route"
detailed_route -droute_end_iter 64 -or_seed 42 -verbose 1 -output_drc /w/out.drc
puts "@@STEP fill cells"
filler_placement {gf180mcu_fd_sc_mcu7t5v0__fill_64 gf180mcu_fd_sc_mcu7t5v0__fill_32 gf180mcu_fd_sc_mcu7t5v0__fill_16 gf180mcu_fd_sc_mcu7t5v0__fill_8 gf180mcu_fd_sc_mcu7t5v0__fill_4 gf180mcu_fd_sc_mcu7t5v0__fill_2 gf180mcu_fd_sc_mcu7t5v0__fill_1}
write_def /w/tiny8_route.def
puts "@@STEP parasitics (OpenRCX)"
set_extraction_rules_file /w/rcx.rules
extract_parasitics
write_spef /w/tiny8.spef
puts "@@STEP IR drop (PDNSim)"
set_pdnsim_net_voltage -net VDD -voltage 5
analyze_power_grid -net VDD
set_pdnsim_net_voltage -net VSS -voltage 0
analyze_power_grid -net VSS
puts "@@REPORT"
puts "@@DONE"
