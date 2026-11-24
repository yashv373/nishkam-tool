read_liberty /w/lib.lib
read_verilog /w/design.v
link_design afifo32
puts "@@SPEF"
read_spef /w/design.spef
report_parasitic_annotation
puts "@@SPEFEND"
create_clock -name wclk -period 10 [get_ports wclk]
set_input_delay 2 -clock wclk [lsearch -all -inline -not -exact [all_inputs] [get_ports wclk]]
set_output_delay 2 -clock wclk [all_outputs]
set_load 0.05 [all_outputs]
set_propagated_clock [all_clocks]
set_clock_uncertainty 0.1 [all_clocks]
create_clock -name rclk -period 14 [get_ports rclk]
set_clock_groups -asynchronous -group {wclk} -group {rclk}
puts "@@TIMING"
puts "@@MAX"
report_checks -path_delay max -format full_clock_expanded -fields {slew cap input_pins} -digits 4 -group_path_count 50
puts "@@MIN"
report_checks -path_delay min -format full_clock_expanded -fields {slew cap input_pins} -digits 4 -group_path_count 50
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
report_power
