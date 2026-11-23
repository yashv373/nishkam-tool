# run OpenCDC on each case: RTL and yosys netlist. out in /foss/designs/opencdc/out
export PATH=/foss/tools/bin:$PATH; cd /foss/designs/opencdc; B=src/build/opencdc; [ -x $B ] || B=$(find src/build -name opencdc -type f | head -1)
mkdir -p out nl; : > out/summary.tsv
for f in cases/*/*.v; do
  p=$(basename $(dirname $f)); n=$(basename $f .v)
  case $p in cdc-sync2) top=sync2; ck="clk_a clk_b";; cdc-async-fifo) top=async_fifo; ck="wclk rclk";; *) top=pulse_sync; ck="clk_a clk_b";; esac
  if [ $p = cdc-sync2 ]; then w=out/wrap.$n.v; { cat $f; echo "module wrap(input clk_a, input clk_b, input rst_b, input din, output q); reg dr; always @(posedge clk_a) dr <= din; sync2 u(.clk_a(clk_a),.clk_b(clk_b),.rst_b(rst_b),.d(dr),.q(q)); endmodule"; } > $w; f=$w; top=wrap; fi
  sdc=out/$p.sdc; : > $sdc; for c in $ck; do echo "create_clock -name $c -period 10 [get_ports $c]" >> $sdc; done
  $B check $f --top $top --constraints $sdc --format json > out/$p.$n.rtl.json 2> out/$p.$n.rtl.err
  yosys -q -p "read_verilog $f; hierarchy -top $top; proc; flatten; synth -flatten -top $top; dfflegalize -cell \$_DFF_P_ x; abc -g AND,OR,XOR,MUX; opt_clean -purge; write_verilog -noattr -noexpr nl/$p.$n.v" > out/$p.$n.ys.log 2>&1
  $B check nl/$p.$n.v --top $top --input-type netlist --cell-map out/cells.yaml --constraints $sdc --format json > out/$p.$n.nl.json 2> out/$p.$n.nl.err
  r=$(grep -o '"rule_id": *"CDC[0-9]*"\|"rule": *"CDC[0-9]*"' out/$p.$n.rtl.json | grep -o 'CDC[0-9]*' | sort | uniq -c | awk '{printf "%s×%s ",$2,$1}')
  nl=$(grep -o '"rule_id": *"CDC[0-9]*"\|"rule": *"CDC[0-9]*"' out/$p.$n.nl.json | grep -o 'CDC[0-9]*' | sort | uniq -c | awk '{printf "%s×%s ",$2,$1}')
  printf "%s/%s\t%s\t%s\n" $p $n "${r:-none}" "${nl:-none}" >> out/summary.tsv
done
