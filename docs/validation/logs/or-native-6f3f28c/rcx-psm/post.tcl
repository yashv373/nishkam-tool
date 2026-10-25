read_lef /w/tech.lef
read_lef /w/cells.lef
read_liberty /w/lib.lib
read_def /w/in.def
set_extraction_rules_file /w/rcx.rules
extract_parasitics
write_spef /w/tiny8.spef
set_pdnsim_net_voltage -net VDD -voltage 5
analyze_power_grid -net VDD
set_pdnsim_net_voltage -net VSS -voltage 0
analyze_power_grid -net VSS
puts "@@DONE"
