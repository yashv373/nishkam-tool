create_clock -name wclk -period 10 [get_ports wclk]
create_clock -name rclk -period 14 [get_ports rclk]
set data_in [all_inputs]
foreach p {wclk rclk} { set data_in [lsearch -all -inline -not -exact $data_in [get_ports $p]] }
set_input_delay 2 -clock wclk $data_in
set_output_delay 2 -clock wclk [all_outputs]
set_load 0.05 [all_outputs]
set_clock_groups -asynchronous -group {wclk} -group {rclk}
