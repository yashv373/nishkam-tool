read_liberty lib.lib
read_verilog adder2.v
link_design add
create_clock -name vclk -period 10
set_input_delay 2 -clock vclk [all_inputs]
set_output_delay 2 -clock vclk [all_outputs]
set_load 0.05 [all_outputs]
puts "@@CHECK"
check_setup -verbose
puts "@@MAX"
report_checks -path_delay max -format full_clock_expanded -fields {slew cap input_pins} -digits 4 -group_path_count 50
puts "@@MIN"
report_checks -path_delay min -format full_clock_expanded -fields {slew cap input_pins} -digits 4 -group_path_count 50
puts "@@SUMMARY"
report_wns -digits 4
report_tns -digits 4
report_worst_slack -max -digits 4
report_worst_slack -min -digits 4
puts "@@POWER"
report_power
