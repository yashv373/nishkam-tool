define_corners max_ss_125C_4v50
read_liberty -corner max_ss_125C_4v50 /foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/lib/gf180mcu_fd_sc_mcu7t5v0__ss_125C_4v50.lib
read_verilog tiny8.final.v
link_design tiny8
puts "@@SPEF"
read_spef -corner max_ss_125C_4v50 tiny8_max.spef
report_parasitic_annotation
puts "@@SPEFEND"
create_clock -name clk -period 24 [get_ports clk]
set_input_delay 4.8 -clock clk [lsearch -all -inline -not -exact [all_inputs] [get_ports clk]]
set_output_delay 4.8 -clock clk [all_outputs]
set_load 0 [all_outputs]
set_propagated_clock [all_clocks]
set_clock_uncertainty 0.1 [all_clocks]
puts "@@TIMING"
puts "@@MAX"
report_checks -path_delay max -corner max_ss_125C_4v50 -format full_clock_expanded -fields {slew cap input_pins} -digits 4 -group_path_count 50
puts "@@MIN"
report_checks -path_delay min -corner max_ss_125C_4v50 -format full_clock_expanded -fields {slew cap input_pins} -digits 4 -group_path_count 50
puts "@@SUMMARY"
report_wns -digits 4
report_tns -digits 4
report_wns -min -digits 4
report_tns -min -digits 4
report_worst_slack -max -digits 4
report_worst_slack -min -digits 4
puts "@@CHECK"
check_setup -verbose
puts "@@LIMITS"
report_check_types -max_slew -max_capacitance -max_fanout -violators
puts "@@POWER"
report_power -corner max_ss_125C_4v50
