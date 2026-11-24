cd /w/
openroad -threads 1 -exit place.tcl > place.log 2>&1; cp tiny8_place.def placed.def
openroad -threads 1 -exit cts.tcl > cts.log 2>&1; cp tiny8_cts.def in.def
openroad -threads 1 -exit route.tcl > route.log 2>&1
