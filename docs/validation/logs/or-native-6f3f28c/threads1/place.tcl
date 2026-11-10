set_thread_count 1
read_lef /w/tech.lef
read_lef /w/cells.lef
read_liberty /w/lib.lib
read_verilog /w/tiny8.v
link_design tiny8
set f [open /w/drc_exclude.cells]
set_dont_use [string trim [read $f]]; close $f
read_def -floorplan_initialize /w/fp.def
puts "@@STEP tap cells"
tapcell -halo_width_x 10 -halo_width_y 10 -distance 20 -tapcell_master gf180mcu_fd_sc_mcu7t5v0__filltie -endcap_master gf180mcu_fd_sc_mcu7t5v0__endcap
puts "@@STEP power grid"
add_global_connection -net VDD -inst_pattern .* -pin_pattern VDD -power
add_global_connection -net VDD -inst_pattern .* -pin_pattern VNW -power
add_global_connection -net VSS -inst_pattern .* -pin_pattern VSS -ground
global_connect
set_voltage_domain -name CORE -power VDD -ground VSS
define_pdn_grid -name stdcell_grid -starts_with POWER -voltage_domain CORE -pins "Metal4 Metal5"
add_pdn_stripe -grid stdcell_grid -layer Metal4 -width 1.6 -pitch 153.6 -offset 16.32 -spacing 1.7 -starts_with POWER -extend_to_core_ring
add_pdn_stripe -grid stdcell_grid -layer Metal5 -width 1.6 -pitch 153.18 -offset 16.65 -spacing 1.7 -starts_with POWER -extend_to_core_ring
add_pdn_connect -grid stdcell_grid -layers "Metal4 Metal5"
add_pdn_stripe -grid stdcell_grid -layer Metal1 -width 0.6 -followpins
add_pdn_connect -grid stdcell_grid -layers "Metal1 Metal4"
define_pdn_grid -macro -default -name macro -starts_with POWER -halo "10 10"
add_pdn_connect -grid macro -layers "Metal4 Metal5"
pdngen
set layers [list]
foreach l [[ord::get_db_tech] getLayers] { if {[$l getType] == "ROUTING"} { lappend layers [$l getName] } }
set_wire_rc -clock -layers $layers
set_wire_rc -signal -layers $layers
puts "@@STEP global placement"
global_placement -skip_io -density 0.5 -pad_right 0 -pad_left 0 -init_wirelength_coef 0.25
puts "@@STEP pin placement"
set_pin_thick_multiplier -hor_multiplier 2 -ver_multiplier 2
place_pins -hor_layers Metal3 -ver_layers Metal2
global_placement -density 0.5 -pad_right 0 -pad_left 0 -init_wirelength_coef 0.25
puts "@@STEP buffers"
buffer_ports
estimate_parasitics -placement
repair_design
puts "@@STEP detailed placement"
detailed_placement -max_displacement {500 100}
optimize_mirroring
check_placement -verbose
puts "@@REPORT"
set n 0; foreach i [[ord::get_db_block] getInsts] { incr n }
puts "INSTANCES $n"
write_def /w/tiny8_place.def
write_verilog -remove_cells {gf180mcu_fd_sc_mcu7t5v0__filltie gf180mcu_fd_sc_mcu7t5v0__endcap} /w/tiny8_place.v
puts "@@DONE"
