#!/usr/bin/env bash
# Compare native Quaigh 0.0.6 (x86_64) against Studio's Quaigh 0.0.6 WASM on the exact same .bench files.
# Runs inside Docker (nixos/nix:latest with difetto-nix-store or any container with `quaigh` on PATH).
# Usage: bash /work/run-native-quaigh.sh /work/browser /work/native-quaigh <quaigh-bin>
set -euo pipefail
IN_DIR="${1:?browser dir}"
OUT_DIR="${2:?out dir}"
QUAIGH="${3:-quaigh}"
mkdir -p "$OUT_DIR"

echo "quaigh_version=$("$QUAIGH" --version)" | tee "$OUT_DIR/version.txt"
uname -a >> "$OUT_DIR/version.txt"

CASES=(c17_bench c17 counter acc s27 s298 s344)

python3 - "$IN_DIR" "$OUT_DIR" "$QUAIGH" "${CASES[@]}" <<'PY'
import json, os, re, shutil, statistics, subprocess, sys, tempfile, time

in_dir, out_dir, quaigh = sys.argv[1], sys.argv[2], sys.argv[3]
cases = sys.argv[4:]
tmp_dir = tempfile.mkdtemp(prefix="quaigh_val_")

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
for key in cases:
    bench_src = os.path.join(in_dir, f"{key}.bench")
    if not os.path.exists(bench_src):
        continue
    # Copy to container-local /tmp so timing measures native CPU, not Windows bind-mount I/O
    bench = os.path.join(tmp_dir, f"{key}.bench")
    shutil.copyfile(bench_src, bench)
    tv_tmp = os.path.join(tmp_dir, f"{key}.native.tv")
    au_tmp = os.path.join(tmp_dir, f"{key}.native.au")
    tv_native = os.path.join(out_dir, f"{key}.native.tv")
    au_native = os.path.join(out_dir, f"{key}.native.au")
    tv_wasm = os.path.join(in_dir, f"{key}.wasm.tv")
    au_wasm = os.path.join(in_dir, f"{key}.wasm.au")
    au_cross = os.path.join(out_dir, f"{key}.cross_native_sim_of_wasm_tv.au")

    atpg_ms, sim_ms = [], []
    last_out = ""
    for _ in range(3):
        t0 = time.perf_counter()
        p = subprocess.run([quaigh, "atpg", "--output", tv_tmp, bench], capture_output=True, text=True, check=True)
        atpg_ms.append((time.perf_counter() - t0) * 1000.0)
        last_out = p.stdout + "\n" + p.stderr
        t1 = time.perf_counter()
        subprocess.run([quaigh, "sim", "--output", au_tmp, "--input", tv_tmp, bench], capture_output=True, text=True, check=True)
        sim_ms.append((time.perf_counter() - t1) * 1000.0)
    shutil.copyfile(tv_tmp, tv_native)
    shutil.copyfile(au_tmp, au_native)

    # Cross-check: native quaigh sim on WASM's .tv must produce byte-identical .au to WASM quaigh sim
    cross_exact = None
    if os.path.exists(tv_wasm) and os.path.exists(au_wasm):
        tv_wasm_tmp = os.path.join(tmp_dir, f"{key}.wasm.tv")
        au_cross_tmp = os.path.join(tmp_dir, f"{key}.cross.au")
        shutil.copyfile(tv_wasm, tv_wasm_tmp)
        subprocess.run([quaigh, "sim", "--output", au_cross_tmp, "--input", tv_wasm_tmp, bench], capture_output=True, text=True, check=True)
        shutil.copyfile(au_cross_tmp, au_cross)
        with open(au_wasm, "rb") as f1, open(au_cross_tmp, "rb") as f2:
            cross_exact = (f1.read() == f2.read())

    # Raw .tv comparison (expected to differ due to 32-bit vs 64-bit SmallRng random fill)
    tv_identical = None
    if os.path.exists(tv_wasm):
        with open(tv_wasm, "rb") as f1, open(tv_native, "rb") as f2:
            tv_identical = (f1.read() == f2.read())

    faults = parse_faults(last_out)
    row = {
        "key": key,
        "faultsDetected": faults["detected"] if faults else None,
        "faultsTotal": faults["total"] if faults else None,
        "coverage": parse_cov(last_out),
        "patterns": count_patterns(tv_native),
        "atpgMs": round(statistics.median(atpg_ms), 2),
        "simMs": round(statistics.median(sim_ms), 2),
        "atpgRunsMs": [round(x, 2) for x in atpg_ms],
        "simRunsMs": [round(x, 2) for x in sim_ms],
        "crossSimWasmTvExactAuMatch": cross_exact,
        "rawTvByteIdentical": tv_identical,
    }
    results.append(row)
    print(f"{key}: cov={row['coverage']}% faults={row['faultsDetected']}/{row['faultsTotal']} "
          f"patterns={row['patterns']} atpgMs={row['atpgMs']} simMs={row['simMs']} "
          f"crossAuMatch={row['crossSimWasmTvExactAuMatch']} tvSame={row['rawTvByteIdentical']}")

with open(os.path.join(out_dir, "summary.json"), "w", encoding="utf8") as f:
    json.dump(results, f, indent=2)
    f.write("\n")
PY
