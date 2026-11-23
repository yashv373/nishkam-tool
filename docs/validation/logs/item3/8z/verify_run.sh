#!/bin/bash
set -euo pipefail
NAT=/foss/designs/nishkam_jobs/item3_8z_nat
BRW=/foss/designs/nishkam_jobs/item3_8z_brw_on
OUT=/foss/designs/nishkam_jobs/item3_8z_verify
mkdir -p "$OUT"

echo "=== 0. Verify identical synthesized netlist sha256 ==="
sha256sum "$NAT/tiny8.v" "$BRW/tiny8.synth.v"

echo "=== 1. Native 6f3f28c 7ns REPAIR=1 OpenROAD log summary ==="
echo "--- cts.log (repair summary) ---"
grep -E 'REPAIR_|Inserted|Resized|Swapped|CLKBUF|skew|latency|RSZ-' "$NAT/cts.log" | tail -30 || true
echo "--- route.log ---"
grep -E 'Total wire length|Total number of vias|Number of violations|Extract .* nets|Worstcase voltage|Average IR drop|Worstcase IR drop|Total power|RCX-0|PSM-0|Error|ERROR' "$NAT/route.log" | tail -30 || true

echo "=== 2. Netlist diff, cell position match (place & CTS), cell area, and SPEF stats ==="
echo "Netlist line diff (native tiny8_cts.v vs browser tiny8.final.v):"
diff -u "$NAT/tiny8_cts.v" "$BRW/tiny8.final.v" | wc -l
python3 - << 'PY'
import re

def parse_def_insts(p):
    d = {}
    in_c = False
    for line in open(p):
        s = line.strip()
        if s.startswith("COMPONENTS"): in_c = True; continue
        if s.startswith("END COMPONENTS"): break
        if in_c and s.startswith("- "):
            m = re.search(r'-\s+(\S+)\s+(\S+)\s+.*\+\s+(?:PLACED|FIXED)\s+\(\s*(-?\d+)\s+(-?\d+)\s*\)\s+(\S+)', s)
            if m:
                d[m.group(1)] = (m.group(2), int(m.group(3)), int(m.group(4)), m.group(5))
    return d

for tag, np, bp in [
    ("place", "/foss/designs/nishkam_jobs/item3_8z_nat/tiny8_place.def", "/foss/designs/nishkam_jobs/item3_8z_brw_on/tiny8.place.def"),
    ("cts",   "/foss/designs/nishkam_jobs/item3_8z_nat/tiny8_cts.def",   "/foss/designs/nishkam_jobs/item3_8z_brw_on/tiny8.final.def"),
]:
    a, b = parse_def_insts(np), parse_def_insts(bp)
    same = sum(1 for k, v in a.items() if b.get(k) == v)
    logic_a = sum(1 for k, v in a.items() if not re.search(r'__(fill|endcap)', v[0]))
    logic_b = sum(1 for k, v in b.items() if not re.search(r'__(fill|endcap)', v[0]))
    print(f"DEF {tag}: nat={len(a)} (logic={logic_a}) brw={len(b)} (logic={logic_b}) exact_same_pos={same}")

def spef_stats(p):
    nets = 0; cap = 0.0
    for l in open(p):
        if l.startswith("*D_NET "):
            nets += 1
            cap += float(l.split()[2])
    return nets, cap

print("SPEF nat:", spef_stats("/foss/designs/nishkam_jobs/item3_8z_nat/tiny8.spef"))
print("SPEF brw:", spef_stats("/foss/designs/nishkam_jobs/item3_8z_brw_on/tiny8.spef"))
PY

echo "=== 3. Native sta 3.1.0 on native 7ns route AND browser 7ns route ==="
L="$NAT/lib.lib"
SDC="$BRW/tiny8.sta-post.constraints.sdc"
cat "$SDC"
cat > "$OUT/sta_run.tcl" << 'EOF'
read_liberty $::env(LIB)
read_verilog $::env(V)
link_design tiny8
read_spef $::env(SPEF)
report_parasitic_annotation
source $::env(SDC)
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
report_power
EOF

LIB="$L" V="$NAT/tiny8_cts.v" SPEF="$NAT/tiny8.spef" SDC="$SDC" sta -exit -no_init "$OUT/sta_run.tcl" > "$OUT/sta_nat_on_natroute.log" 2>&1
LIB="$L" V="$BRW/tiny8.final.v" SPEF="$BRW/tiny8.spef" SDC="$SDC" sta -exit -no_init "$OUT/sta_run.tcl" > "$OUT/sta_nat_on_brwroute.log" 2>&1

echo "--- Native sta 3.1.0 on NATIVE 7ns route ---"
grep -E 'worst slack|wns |tns |^Total ' "$OUT/sta_nat_on_natroute.log"
echo "--- Native sta 3.1.0 on BROWSER 7ns route ---"
grep -E 'worst slack|wns |tns |^Total ' "$OUT/sta_nat_on_brwroute.log"
echo "--- Browser OpenSTA summary (repair ON) ---"
cat "$BRW/tiny8.pnr.json" | grep -E 'setupWs|holdWs|wirelengthUm|vias|worstV|avgV|powerW|lvsDevices|lvsNets|magicDrc' || true

echo "=== 4. Native Magic 8.3.636 DRC + SPICE extraction on native 7ns route ==="
cat > "$OUT/magic_run.tcl" << EOF
tech load /foss/pdks/gf180mcuD/libs.tech/magic/gf180mcuD.tech
scalegrid 1 10
snap lambda
drc off
gds readonly true
gds read /foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/gds/gf180mcu_fd_sc_mcu7t5v0.gds
lef read $NAT/tech.lef
lef read $NAT/cells.lef
def read $NAT/tiny8_route.def
select top cell
drc euclidean on
drc style drc(full)
drc on
drc check
drc catchup
drc count total
echo end-of-drc
drc listall why
extract do local
extract no capacitance
extract no coupling
extract no resistance
extract no adjust
extract all
ext2spice lvs
ext2spice -o $OUT/tiny8_nat.spice tiny8
quit -noprompt
EOF
(cd "$OUT" && magic -dnull -noconsole -rcfile /foss/pdks/gf180mcuD/libs.tech/magic/gf180mcuD.magicrc "$OUT/magic_run.tcl") > "$OUT/magic_nat.log" 2>&1
grep -E 'Magic |Total DRC errors|end-of-drc|No errors|exttospice' "$OUT/magic_nat.log" | tail -10

echo "=== 5. Native Netgen 1.5.318 LVS on native 7ns route ==="
python3 - << 'PY'
import re
lay = open("/foss/designs/nishkam_jobs/item3_8z_verify/tiny8_nat.spice").read()
phys = re.compile(r'\s+gf180mcu_fd_sc_mcu7t5v0__(?:fill_\d+|filltie|endcap|fillcap_\d+)\s*$', re.I)
lay = "\n".join(l for l in lay.splitlines() if not re.match(r'^XS?FILL', l) and not phys.search(l))
for src, dst in [("VNW","VDD"), ("VPW","VSS"), ("VDD","VDD"), ("VSS","VSS")]:
    lay = re.sub(rf'[^\s]*/{src}(?=\s|$)', dst, lay)
lay = re.sub(r'(?:\$SUB|sub!|VSUBS)(?=\s|$)', 'VSS', lay)
def fix_top(m):
    line = m.group(0)
    toks = set(line.split())
    add = [p for p in ("VDD","VSS") if p not in toks]
    return line + (" " + " ".join(add) if add else "")
lay = re.sub(r'^(\.subckt\s+(?!gf180mcu_)\S+.*)$', fix_top, lay, flags=re.M)
open("/foss/designs/nishkam_jobs/item3_8z_verify/lay.spice", "w").write(lay)

v = open("/foss/designs/nishkam_jobs/item3_8z_nat/tiny8_cts.v").read()
if not re.search(r'\bVDD\b', (re.search(r'module\s+\S+\s*\([^)]*\)', v) or [""])[0] if re.search(r'module\s+\S+\s*\([^)]*\)', v) else ""):
    v = re.sub(r'(module\s+\S+?\s*\()', r'\1VDD, VSS, ', v, count=1)
    v = re.sub(r'(module[^;]*;)', r'\1\n  inout VDD; inout VSS;', v, count=1)
v = re.sub(r'(\bgf180mcu_\w+\s+\S+\s*\([^;]*?)\)\s*;', lambda m: m.group(0) if re.search(r'\.VDD\s*\(', m.group(1)) else m.group(1) + ', .VDD(VDD), .VSS(VSS), .VNW(VDD), .VPW(VSS));', v)
open("/foss/designs/nishkam_jobs/item3_8z_verify/pg.v", "w").write(v)
cells = sorted(set(re.findall(r'\bgf180mcu_\w+(?=\s+\S+\s*\()', v)))
lines = [
    "netgen::readnet spice /foss/designs/nishkam_jobs/item3_8z_verify/lay.spice 1",
    "netgen::readnet spice /foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/spice/gf180mcu_fd_sc_mcu7t5v0.spice 2",
    "netgen::readnet verilog /foss/designs/nishkam_jobs/item3_8z_verify/pg.v 2",
]
for c in cells:
    lines.append(f"catch {{netgen::flatten class {{{c} 1}}}}")
    lines.append(f"catch {{netgen::flatten class {{{c} 2}}}}")
lines.append("netgen::lvs {tiny8 1} {tiny8 2} /foss/pdks/gf180mcuD/libs.tech/netgen/gf180mcuD_setup.tcl /foss/designs/nishkam_jobs/item3_8z_verify/lvs.out.txt")
lines.append("quit")
open("/foss/designs/nishkam_jobs/item3_8z_verify/netgen_run.tcl", "w").write("\n".join(lines) + "\n")
PY
netgen -batch source "$OUT/netgen_run.tcl" > "$OUT/netgen_stdout.log" 2>&1
grep -E 'Netgen |Circuit 1 contains|Final result|match' "$OUT/netgen_stdout.log" "$OUT/lvs.out.txt" | tail -15

echo "=== 6. Native Yosys 0.64 equivalence (post-PnR native tiny8_cts.v vs synth netlist, vs RTL, + negative control) ==="
yosys -V
cp /foss/designs/nishkam_jobs/parity_tiny8ref/tiny8.v "$OUT/rtl.v"
python3 - << 'PY'
import re
v = open("/foss/designs/nishkam_jobs/item3_8z_nat/tiny8_cts.v").read()
v_nopwr = re.sub(r',\s*VDD,\s*VSS\)', ')', v)
v_nopwr = re.sub(r'^\s*inout V(DD|SS);\n', '', v_nopwr, flags=re.M)
open("/foss/designs/nishkam_jobs/item3_8z_verify/gate.v", "w").write(v_nopwr)
swap = {"nand2": "nor2", "nor2": "nand2", "and2": "or2", "or2": "and2"}
mut = re.sub(r'gf180mcu_fd_sc_mcu7t5v0__(nand2|and2|or2|nor2)_(\d)', lambda m: f"gf180mcu_fd_sc_mcu7t5v0__{swap[m.group(1)]}_{m.group(2)}", v_nopwr, count=1)
open("/foss/designs/nishkam_jobs/item3_8z_verify/mut.v", "w").write(mut)
PY

run_eq() {
  local label="$1" a="$2" b="$3"
  cat > "$OUT/eq_${label}.ys" << EOF
read_liberty -ignore_miss_func -ignore_miss_dir -ignore_miss_data_latch -ignore_buses $L
read_verilog -sv $a
rename tiny8 gold
read_verilog -sv $b
rename tiny8 gate
proc
rename -hide t:gf180mcu*
flatten
async2sync
opt_clean
splitnets
rename -hide w:_* w:net* w:clknet_*
opt_clean -purge
equiv_make gold gate eq
hierarchy -top eq
equiv_simple -seq 5
equiv_induct -seq 5
equiv_status -assert
EOF
  if yosys -q -s "$OUT/eq_${label}.ys" > "$OUT/eq_${label}.log" 2>&1; then
    echo "YOSYS_EQ $label: PASS"
  else
    echo "YOSYS_EQ $label: FAIL (exit $?)"
  fi
}

run_eq synth_vs_cts "$NAT/tiny8.v" "$OUT/gate.v"
run_eq rtl_vs_cts   "$OUT/rtl.v"   "$OUT/gate.v"
run_eq neg_control  "$NAT/tiny8.v" "$OUT/mut.v"
