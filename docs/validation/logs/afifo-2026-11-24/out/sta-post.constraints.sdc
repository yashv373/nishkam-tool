create_clock -name wclk -period 10 [get_ports wclk]
set_input_delay 2 -clock wclk [lsearch -all -inline -not -exact [all_inputs] [get_ports wclk]]
set_output_delay 2 -clock wclk [all_outputs]
set_load 0.05 [all_outputs]
set_propagated_clock [all_clocks]
set_clock_uncertainty 0.1 [all_clocks]
create_clock -name rclk -period 14 [get_ports rclk]
set_clock_groups -asynchronous -group {wclk} -group {rclk}
