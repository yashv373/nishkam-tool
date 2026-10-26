read_lef /foss/designs/nishkam_jobs/rcxnom/tech.lef
read_lef /foss/designs/nishkam_jobs/rcxnom/cells.lef
read_liberty /foss/designs/nishkam_jobs/rcxnom/lib.lib
read_def /foss/designs/nishkam_jobs/rcxnom/in.def
set_extraction_rules_file /foss/designs/nishkam_jobs/rcxnom/rcx.rules
extract_parasitics
write_spef /foss/designs/nishkam_jobs/rcxnom/tiny8.spef
set_pdnsim_net_voltage -net VDD -voltage 5
analyze_power_grid -net VDD
set_pdnsim_net_voltage -net VSS -voltage 0
analyze_power_grid -net VSS
puts "@@DONE"
