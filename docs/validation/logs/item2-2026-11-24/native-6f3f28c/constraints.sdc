create_clock -name clk -period 24 [get_ports clk]
set_input_delay 4.800000000000001 -clock clk [lsearch -all -inline -not -exact [all_inputs] [get_ports clk]]
set_output_delay 4.800000000000001 -clock clk [all_outputs]
set_load 0.05 [all_outputs]
