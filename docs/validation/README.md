# Validation report

Every time we say a part of the flow "matches" the traditional tool, the proof is here: the test design, how our browser version was built, how the traditional tool was run, the numbers, and what we did not check. Test designs only check the tools. They do not show a design is good.

Run date: 2026-10-18. Logs from these runs are in `docs/validation/logs/`. Pictures are in `docs/validation/img/`.

**Traditional setup (all sections).** Docker image `hpretl/iic-osic-tools:chipathon26`, container `gf180`, PDK gf180mcuD. Tool versions read from inside the container:

| Tool | Version |
|---|---|
| OpenROAD | 26Q2-254-g61932e897 |
| OpenSTA (`sta`) | 3.1.0 |
| Netgen | 1.5.318 |
| Magic | 8.3.636 |
| Yosys | 0.64 |
| LibreLane | v3.0.2 |

## Claims found

1. Clock tree in the browser matches native OpenROAD on tiny8.
2. Netgen LVS in the browser matches native Netgen.
3. LVS matches on adder, tiny8, mult8 and the two-clock designs.
4. The qrouter fix cuts Magic DRC errors (adder2 18 to 3, mult8 118 to 39, tiny8 197 to 66).
5. In-browser OpenSTA timing and power match native OpenSTA.
6. Other "same as native" lines in `web/vendor/*/SOURCE.md` (graywolf, Magic, qrouter). See Limits.

## 1. Clock tree (TritonCTS) matches native OpenROAD on tiny8

**Claimed:** the browser clock tree gives the same result as native OpenROAD.

**Test design:** tiny8 (48 flops), the placed DEF LibreLane wrote (`web/studio/demo/34-openroad-detailedplacement/tiny8.def`) and the SDC LibreLane used (`web/studio/engines/cts.tiny8.sdc`).

**Our flow:** OpenROAD commit 61932e8 built to WebAssembly (`web/vendor/openroad-cts/61932e8/SOURCE.md`: modules, patches, build steps). Same commit as the container's OpenROAD. Run it with `node web/studio/engines/cts.selftest.mjs`.

**Traditional flow:** native OpenROAD 26Q2-254-g61932e897 in the container, TritonCTS run from `cts_golden.tcl` on the same placed DEF. Its output DEF is kept at `web/studio/demo/35-openroad-cts/tiny8.def`.

**Result:**

| | Native | Browser |
|---|---|---|
| Clock buffers | 9 (clkbuf_8) | 9 |
| Sinks | 48 | 48 |
| Latency | 0.67 ns | 0.67 ns |
| Skew | 0 ns | 0 ns |
| Components in output DEF | 553 | 553 |
| Same cell, position and orientation | | 553 of 553 |

The self-test prints `cts selftest ok`. `node docs/validation/ctsdiff.mjs` does the DEF comparison (log: `logs/ctsdiff.txt`).

| Native OpenROAD | Browser TritonCTS |
|---|---|
| ![native](img/cts-native.png) | ![browser](img/cts-browser.png) |

Red squares are clock buffers, blue are flops, grey are other cells. The pictures are the same because the DEFs are the same.

**Not validated:** only tiny8 and the single-clock case. Wires are not compared (routing happens later). Only clkbuf_8/4/2 are allowed.

## 2 and 3. Netgen LVS matches native Netgen

**Claimed:** the browser Netgen says match or mismatch the same way as native Netgen, and the browser flow gives LVS match on the test designs.

**Test design:** adder2, mult8, tiny8 through the browser flow (Yosys, graywolf, qrouter, Magic extract). Also adder, twoclk and pins40 in `pd.cases.selftest.mjs`.

**Our flow:** Netgen commit 3cb047b (v1.5.324) with Tcl 8.6.14 built to WebAssembly, with one fix for a use-after-free in `netcmp.c` (`web/vendor/netgen/3cb047b/SOURCE.md`). Run `node web/studio/engines/lvs.selftest.mjs` and `node web/studio/engines/pd.cases.selftest.mjs`.

**Traditional flow:** `node docs/validation/lvs-dump.mjs <design> <folder>` writes the exact files the browser Netgen compared (`lay.spice`, `cells.spice`, `pg.v`, `setup.tcl`, `run.tcl`). Then in the container, in that folder (set `MSYS_NO_PATHCONV=1` in Git Bash):
`docker exec gf180 bash -lc "cd /foss/designs/nishkam_val/<design> && netgen -batch source run.tcl"`.
Logs: `logs/netgen-native-*.log`. One command re-runs both sides: `bash docs/validation/netgen-compare.sh` (re-run 2026-10-18, same numbers).

**Result (same inputs):**

| Design | Browser devices / nets | Native devices / nets | Both say |
|---|---|---|---|
| adder2 | 256 / 146 | 256 / 146 | match uniquely |
| mult8 | 2321 / 1180 | 2321 / 1180 | match uniquely |
| tiny8 | 3100 / 1537 | 3100 / 1537 | match uniquely |

Other `pd.cases.selftest.mjs` results (all PASS, 0 failed nets, LVS true): twoclk 56/32, adder 256/146, pins40 20/20. `lvs.selftest.mjs`: sr8 matches (224/224 devices, 109/109 nets) and a deliberately broken layout is caught (216 vs 224 devices).

**Flatten check:** `run.tcl` uses `catch {netgen::flatten class {<cell> <file index>}}`, and `catch` hides errors, so we checked that it works. Native Netgen 1.5.318 on adder2 prints 18 "Flattening instances of ..." lines (both files) and compares 256 devices / 146 nets; with the flatten lines removed it prints none and compares 43 devices / 61 nets (still "match uniquely"). So the syntax is right. Logs: `logs/netgen-native-adder2-flatten.log`, `-noflatten.log`.

**Note:** the container has Netgen 1.5.318, not 1.5.324 as `SOURCE.md` says. This run compared against 1.5.318; the browser build is 1.5.324 plus one fix. `SOURCE.md` states this.

**Not validated:** mismatch cases beyond one broken layout, so native and browser may differ on other mismatch reports. LVS assumes wells are tied to power (no well-tap cells in this flow). Netgen 1.5.324 native was not available.

## 4. qrouter fix: fewer Magic DRC errors

**Claimed:** blocking wires near vias on Metal1-3 cuts DRC error tiles (adder2 18 to 3, mult8 118 to 39, tiny8 197 to 66) and keeps LVS matching.

**Test design:** adder2, mult8, tiny8 through the browser flow, then Magic DRC.

**Our flow:** qrouter commit c8f1111 (unmodified build) and `c8f1111-drc` (one change: call upstream's own `apply_drc_blocks()` on Metal1-3). Details in `web/vendor/qrouter/c8f1111-drc/SOURCE.md`. `node docs/validation/drc-count.mjs <design>` runs one design. To compare, point `qf` in `web/studio/engines/place.worker.js` at the old folder (this run did that, then put it back).

**Traditional flow:** none. This is a before/after on our own browser flow. Native LibreLane gives clean routing on these designs, which is the target we have not reached.

**Result (`logs/drc.txt`):**

| Design | Before | After | Failed nets | LVS |
|---|---|---|---|---|
| adder2 | 18 | 3 | 0 | match |
| mult8 | 118 | 39 | 0 | match |
| tiny8 | 197 | 66 | 0 | match |

`pd.selftest.mjs 8` (sr8) now gives 0 error tiles. The same routed DEFs were also run through native Magic: see "Magic native re-run" below.

**Not validated:** the remaining 3 / 39 / 66 tiles are real errors, so browser routing is not DRC clean. The DRC count is Magic's, not signoff.

## 5. OpenSTA timing and power: summary numbers (native side not re-run)

**What is checked:** the browser OpenSTA (`opensta.selftest.mjs`) gives worst setup slack, worst hold slack and total power that equal numbers stored in the self-test file. Those stored numbers came from native `sta` earlier. The full report text is compared with a native re-run in the OpenSTA native re-run section below.

**Test design:** shreg4 and an 8-bit counter (cnt8), clock 10 ns, input/output delay 2 ns, load 0.05 pF.

**Our flow:** OpenSTA commit defec0b (3.1.0) built to WebAssembly, the commit bundled in the container's OpenROAD (`web/vendor/opensta/defec0b/SOURCE.md`). Liberty is the unmodified gf180mcu tt 25C 5V file. Run `node web/studio/engines/opensta.selftest.mjs`.

**Traditional flow:** `/foss/tools/openroad/bin/sta` (3.1.0) with the same Tcl. Not re-run today.

**Result (browser, this run; the self-test compares them with the stored native numbers and printed PASS for both):**

| Design | Setup worst slack | Hold worst slack | Total power |
|---|---|---|---|
| shreg4 | 6.7093 ns | 0.5372 ns | 279 uW |
| cnt8 | 6.0215 ns | 1.2837 ns | 1710 uW |

**Not validated:** one liberty corner only. Only these two small designs. Post-route timing was run for tiny8 (setup 12.9621, hold 1.0438 in `pd.cases.selftest.mjs`) but not compared with native.

## Magic native re-run (DRC, extraction, GDS)

**Claimed:** browser Magic gives the same DRC count, extraction and GDS as native Magic.

**How:** `bash docs/validation/magic-compare.sh` runs the browser flow, then browser Magic, then native Magic 8.3.636 in the container on the same routed DEF and the same PDK files (same command list as `magic.worker.js`). It compares the DRC total, the DRC rule texts, the extracted SPICE (the `$SUB` name aside) and the GDS (KLayout XOR, `gds-xor.py`). Logs: `logs/magic-native-*.txt`, `logs/magic-browser-*.txt`.

| Design | DRC tiles native / browser | Rule texts | SPICE | GDS XOR area |
|---|---|---|---|---|
| sr8 | 0 / 0 | same | same | 0 (25 layers) |
| adder2 | 3 / 3 | same | same | 0 (25 layers) |
| tiny8 | 66 / 66 | same | same | 0 (25 layers) |

The old "35 tiles on sr8" in `SOURCE.md` was from before the qrouter fix; it is now 0 on both sides.

| adder2 | tiny8 |
|---|---|
| ![adder2](img/layout-adder2.png) | ![tiny8](img/layout-tiny8.png) |

Left half of each picture is native Magic's GDS, right half is the browser's, both drawn by KLayout (`render-gds.py`). They match because the GDS geometry is the same.

**Not validated:** the DRC tile positions were not compared, only count and rule texts (the GDS match covers the layout itself). Same Magic tech file on both sides. Browser Magic is a different version from the container's.

## OpenSTA native re-run (full report)

**How:** `bash docs/validation/sta-compare.sh` runs the browser OpenSTA and native `sta` 3.1.0 (container) on the same netlist, liberty and Tcl, and diffs the complete output: every max and min path report, wns/tns, worst slack and the power report. Logs: `logs/sta-native-*.txt`, `logs/sta-browser-*.txt`.

| Design | Lines compared | Result |
|---|---|---|
| shreg4 | 434 | identical |
| cnt8 | 1172 | identical |

![shreg4 report, first lines](img/sta-shreg4.png)

Only the licence banner differs. This replaces the stored native numbers in section 5 with a native run from today. Images are made by `python docs/validation/make-images.py <magic output folder>`.

**Not validated:** one liberty corner, two small designs, no SPEF run in this comparison.

## graywolf and qrouter

Compared in `qflow-native.md`: graywolf placement files and qrouter inputs identical on adder2; the qrouter routed DEF differs in some wire choices (both route fully).

## Limits

- Netgen: the container has 1.5.318 and the browser build is 1.5.324 plus one fix. Native 1.5.324 was not compared.
- The local runner round trip (shreg4, signoff clean 14/14) has no stored log.
- Test designs are small. Passing them shows the tools work, not that a design is good.

## How to repeat

Run from a folder with `@yowasp/yosys` in `node_modules` for the flow tests:
`node web/studio/engines/cts.selftest.mjs`, `lvs.selftest.mjs`, `opensta.selftest.mjs`, `pd.cases.selftest.mjs`, `pd.selftest.mjs 8`, `selftest.node.mjs`, `node docs/validation/ctsdiff.mjs`. Native side-by-side (needs the `gf180` container, Git Bash): `bash docs/validation/sta-compare.sh`, `magic-compare.sh`, `netgen-compare.sh`.
