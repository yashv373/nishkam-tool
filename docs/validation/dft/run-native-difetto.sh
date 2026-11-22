#!/usr/bin/env bash
# Run native Difetto's DFT flow (Yosys 0.62 + difetto.so scan_replace & sdff_cut + nl2bench 0.13.0 + Quaigh 0.0.6)
# on gf180mcu_fd_sc_mcu7t5v0 (tt 25C 5.00V), matching Difetto's ScanReplace -> Cut -> WriteBench -> QuaighATPG -> QuaighSim.
# Usage inside nixos/nix:latest with difetto-nix-store mounted at /nix:
#   bash /work/run-native-difetto.sh /work/designs /work/native-difetto /tech/gf180mcu_fd_sc_mcu7t5v0_mapping.json /lib/gf180mcu_fd_sc_mcu7t5v0__tt_025C_5v00.lib.gz
set -euo pipefail

DESIGNS_DIR="${1:?designs dir}"
OUT_DIR="${2:?out dir}"
MAP_JSON="${3:?difetto mapping json}"
LIB_GZ="${4:?gf180 lib.gz}"

YOSYS=/nix/store/91x36w74dgvx6fipmkk9a58sd5zzml0c-yosys-with-plugins-0.62/bin/yosys
NL2BENCH=/nix/store/rk1piw2xa9z22pfdk3zfqkvjy71m9y3j-python3.13-nl2bench/bin/nl2bench
QUAIGH=/nix/store/qg7ixjaii9p61qzasc8pn670gxkrv9pm-quaigh-0.0.6/bin/quaigh

mkdir -p "$OUT_DIR"
TMP=$(mktemp -d /tmp/difetto_val.XXXXXX)
trap 'rm -rf "$TMP"' EXIT

gzip -dc "$LIB_GZ" > "$TMP/gf180.lib"
cp "$MAP_JSON" "$TMP/mapping.json"

{
  echo "yosys: $("$YOSYS" -V)"
  echo "nl2bench: $("$NL2BENCH" --version 2>&1 || true)"
  echo "quaigh: $("$QUAIGH" --version)"
  echo "difetto_plugin: /nix/store/0m2v9sim809hmqbx89y2cv92qzh7191p-yosys-difetto-0.1.0/share/yosys/plugins/difetto.so"
  uname -a
} | tee "$OUT_DIR/versions.txt"

python3 - "$DESIGNS_DIR" "$OUT_DIR" "$TMP" "$YOSYS" "$NL2BENCH" "$QUAIGH" <<'PY'
import json, os, re, shutil, statistics, subprocess, sys, time

designs_dir, out_dir, tmp, yosys, nl2bench, quaigh = sys.argv[1:7]
lib = os.path.join(tmp, "gf180.lib")
mapping = os.path.join(tmp, "mapping.json")

CASES = [
    {"key": "c17",     "file": "c17.v",     "top": "c17",     "clk": None},
    {"key": "counter", "file": "counter.v", "top": "counter", "clk": "clk"},
    {"key": "acc",     "file": "acc.v",     "top": "acc",     "clk": "clk"},
    {"key": "s27",     "file": "s27.v",     "top": "s27",     "clk": "CK"},
    {"key": "s298",    "file": "s298.v",    "top": "s298",    "clk": "CK"},
    {"key": "s344",    "file": "s344.v",    "top": "s344",    "clk": "CK"},
]

def parse_cov(out):
    ms = re.findall(r"\((\d+(?:\.\d+)?)% coverage\)", out)
    return float(ms[-1]) if ms else None

def parse_faults(out):
    ms = re.findall(r"detecting (\d+)/(\d+) faults", out)
    return {"detected": int(ms[-1][0]), "total": int(ms[-1][1])} if ms else None

def count_patterns(path):
    with open(path, "r", encoding="utf8") as f:
        return len(re.findall(r"^(\d+):\s*([01]+)\s*$", f.read(), re.M))

results = []
for c in CASES:
    key, top, clk = c["key"], c["top"], c["clk"]
    vsrc = os.path.join(tmp, c["file"])
    shutil.copyfile(os.path.join(designs_dir, c["file"]), vsrc)

    scan_v = os.path.join(tmp, f"{key}.scan.v")
    cut_v = os.path.join(tmp, f"{key}.cut.v")
    bench = os.path.join(tmp, f"{key}.bench")
    tv = os.path.join(tmp, f"{key}.tv")
    au = os.path.join(tmp, f"{key}.au")

    # Step 1: Yosys synth to gf180mcu_fd_sc_mcu7t5v0 + Difetto scan_replace + sdff_cut
    ys_lines = [
        "plugin -i difetto",
        f"read_liberty -lib {lib}",
        f"read_verilog -sv {vsrc}",
        f"synth -flatten -top {top}",
        f"dfflibmap -liberty {lib}",
        f"abc -liberty {lib}",
        "opt_clean -purge",
        f"select {top}",
        f"scan_replace -json_mapping {mapping}",
        "select -clear",
        f"stat -liberty {lib}",
        f"write_verilog {scan_v}",
    ]
    if clk:
        ys_lines += [
            f"select {top}",
            f"sdff_cut -json_mapping {mapping} -test_mode tm -clock {clk} -exclude_io {clk}",
            "select -clear",
            "hierarchy",
            "flatten",
            "opt_clean -purge",
        ]
    ys_lines += [f"write_verilog {cut_v}"]
    ys_file = os.path.join(tmp, f"{key}.ys")
    with open(ys_file, "w") as f:
        f.write("\n".join(ys_lines) + "\n")

    t_flow0 = time.perf_counter()
    p_ys = subprocess.run([yosys, "-s", ys_file], capture_output=True, text=True)
    t_ys = (time.perf_counter() - t_flow0) * 1000.0
    with open(os.path.join(out_dir, f"{key}.yosys.log"), "w", encoding="utf8") as f:
        f.write(p_ys.stdout + "\n" + p_ys.stderr)
    if p_ys.returncode != 0:
        print(f"FAIL yosys {key}: rc={p_ys.returncode}")
        results.append({"key": key, "ok": False, "stage": "yosys"})
        continue

    # Count scan flops (gf180mcu_fd_sc_mcu7t5v0__sdff*) from scan_v
    scan_text = open(scan_v, "r", encoding="utf8").read()
    scan_flops = len(re.findall(r"\bgf180mcu_fd_sc_mcu7t5v0__sdff\w*\b", scan_text))
    non_scan_flops = len(re.findall(r"\bgf180mcu_fd_sc_mcu7t5v0__dff\w*\b", scan_text))

    # Step 2: nl2bench (Difetto WriteBench)
    t_nl0 = time.perf_counter()
    p_nl = subprocess.run([nl2bench, "--output", bench, "--msb-first", "--lib-file", lib, cut_v], capture_output=True, text=True)
    t_nl = (time.perf_counter() - t_nl0) * 1000.0
    if p_nl.returncode != 0:
        print(f"FAIL nl2bench {key}: {p_nl.stdout} {p_nl.stderr}")
        results.append({"key": key, "ok": False, "stage": "nl2bench", "err": p_nl.stderr[:300]})
        continue

    # Step 3: Quaigh ATPG + Sim (3 runs for median)
    atpg_ms, sim_ms = [], []
    last_out = ""
    for _ in range(3):
        t0 = time.perf_counter()
        p_a = subprocess.run([quaigh, "atpg", "--output", tv, bench], capture_output=True, text=True, check=True)
        atpg_ms.append((time.perf_counter() - t0) * 1000.0)
        last_out = p_a.stdout + "\n" + p_a.stderr
        t1 = time.perf_counter()
        subprocess.run([quaigh, "sim", "--output", au, "--input", tv, bench], capture_output=True, text=True, check=True)
        sim_ms.append((time.perf_counter() - t1) * 1000.0)

    total_ms = t_ys + t_nl + statistics.median(atpg_ms) + statistics.median(sim_ms)
    shutil.copyfile(bench, os.path.join(out_dir, f"{key}.bench"))
    shutil.copyfile(tv, os.path.join(out_dir, f"{key}.tv"))
    shutil.copyfile(au, os.path.join(out_dir, f"{key}.au"))

    bench_lines = open(bench, "r", encoding="utf8").read().splitlines()
    faults = parse_faults(last_out)
    row = {
        "key": key,
        "ok": True,
        "scanFlops": scan_flops,
        "nonScanFlops": non_scan_flops,
        "chainLength": scan_flops,
        "benchInputs": sum(1 for l in bench_lines if l.startswith("INPUT(")),
        "benchOutputs": sum(1 for l in bench_lines if l.startswith("OUTPUT(")),
        "benchGates": sum(1 for l in bench_lines if "=" in l),
        "faultsDetected": faults["detected"] if faults else None,
        "faultsTotal": faults["total"] if faults else None,
        "coverage": parse_cov(last_out),
        "patterns": count_patterns(tv),
        "yosysMs": round(t_ys, 1),
        "nl2benchMs": round(t_nl, 1),
        "atpgMs": round(statistics.median(atpg_ms), 2),
        "simMs": round(statistics.median(sim_ms), 2),
        "totalMs": round(total_ms, 1),
    }
    results.append(row)
    print(f"{key}: scanFlops={scan_flops} (nonScan={non_scan_flops}) cov={row['coverage']}% "
          f"faults={row['faultsDetected']}/{row['faultsTotal']} patterns={row['patterns']} "
          f"gates={row['benchGates']} yosysMs={row['yosysMs']} nl2bMs={row['nl2benchMs']} atpgMs={row['atpgMs']}")

with open(os.path.join(out_dir, "summary.json"), "w", encoding="utf8") as f:
    json.dump(results, f, indent=2)
    f.write("\n")
PY
