# Validation report

Every time we say a part of the flow "matches" the traditional tool, the proof is here: the test design, how our browser version was built, how the traditional tool was run, the numbers, and what we did not check. Test designs only check the tools. They do not show a design is good.

Logs are in `docs/validation/logs/`, pictures in `docs/validation/img/`. Runs were done between 2026-10-18 and 2026-10-20; each section says which.

## Summary: what is and is not validated

Two place-and-route flows exist in Studio:
- **OpenROAD (TritonRoute)**: the main flow. Section 8.
- **graywolf + qrouter**: the older option, still selectable. It is not DRC clean (Magic still reports errors). Sections 3, 6 and 7.

| Stage | Browser engine (WebAssembly) | Compared with | Result | Not validated |
|---|---|---|---|---|
| Clock tree (section 1) | OpenROAD TritonCTS 61932e8 | native OpenROAD, same commit | identical output DEF on tiny8 (553 of 553 cells) | other designs, multi-clock |
| LVS (section 2) | Netgen 3cb047b (v1.5.324) | native Netgen 1.5.318 | same verdict and counts on 3 designs | many kinds of mismatch (one broken layout only) |
| Magic DRC, extraction, GDS (section 5) | Magic bed8d4f | native Magic 8.3.636 | same DRC count and rule texts, same SPICE, GDS XOR area 0 | DRC tile positions |
| Timing and power (section 4) | OpenSTA defec0b (3.1.0) | native `sta` 3.1.0 | full report text identical on 2 designs | wire parasitics (SPEF), other corners |
| OpenROAD place and route (section 8) | OpenROAD 61932e8 | native OpenROAD, same commit, 1 thread | same netlist; results agree to about 1%; not bit-identical; both end at 0 violations | large or hard designs |
| OpenROAD flow vs LibreLane (section 8B) | Studio recipe | LibreLane 3.0.2 | similar quality, not the same steps; numbers given as percentages | why LibreLane's wire is 29% longer |
| graywolf + qrouter (section 6) | graywolf 33fbcaa, qrouter c8f1111 | same sources built natively | placement files identical; routed DEF differs in wire choices | clocked designs |
| Formal equivalence (section 7, 8) | Yosys | RTL | netlists proven equal to the RTL (tiny8, adder2) | not a general proof |
| RTL grader | Yosys miter | none | not covered by this report (section 9) | everything |

**Scope.** Validated: single-clock designs on gf180mcuD (7-track cells), up to 48 flip-flops, 1,559 nets and 3,150 transistors, 50% density, one corner (tt, 25 C, 5.00 V), in Chrome.

**Not validated:** more than one clock, other corners (ss, ff), signoff-grade extraction (OpenRCX), designs above about 1,600 nets, congestion, antenna and IR-drop checks, Firefox and Safari.

### Terms
- **Studio**: the browser IDE (`web/studio.html`). It runs every tool in this report in WebAssembly.
- **Old flow**: graywolf (placement) + qrouter (routing). **OpenROAD flow**: OpenROAD placement, clock tree and TritonRoute.
- **Runner**: a program on the user's PC that runs real LibreLane for Studio. It is not used anywhere in this report.
- **Grader**: the practice page's checker for RTL answers.
- **DRC error tile**: Magic reports each violation as one or more rectangles ("tiles"). One rule broken in one place can be several tiles, so tile counts are not rule counts. We report tile counts, and compare the rule texts separately (section 5).
- **`$SUB`**: the name Magic gives the substrate net in extracted SPICE. Only this name differs between browser and native.

### Test host
AMD Ryzen 9 6900HS (8 cores, 16 threads), 15.2 GB RAM, Windows 11 Home (10.0.26200). Docker 29.6.2 on WSL2 with 16 threads and 10 GB RAM + 8 GB swap. Node v26.7.0. Chrome 155. WebAssembly builds use Emscripten 3.1.74. Times in this report come from this PC, often with other programs running.

### Tool versions: native (container) and browser
Native: image `hpretl/iic-osic-tools:chipathon26`, container `gf180`, PDK gf180mcuD, read from inside the container.

| Tool | Native (container) | Browser build | What we changed |
|---|---|---|---|
| OpenROAD | 26Q2-254-g61932e897 | commit 61932e8 | 33-file patch (section 8) |
| OpenSTA | `sta` 3.1.0 | commit defec0b (3.1.0) | none |
| Netgen | 1.5.318 | 3cb047b (1.5.324) | one use-after-free fix in `netcmp.c` |
| Magic | 8.3.636 | bed8d4f (version number not recorded in `SOURCE.md`) | relinked with two flags (stack size, function pointer casts) |
| Yosys | 0.64 | `@yowasp/yosys` 0.68.1207 | none |
| LibreLane | 3.0.2 (native only) | not in browser | none |
| graywolf | built from commit 33fbcaa with gcc | 33fbcaa | `wasm.patch` (old C code fixes, `system()` emulated); same patch used natively |
| qrouter | built from commit c8f1111 with gcc | c8f1111 and `c8f1111-drc` | `c8f1111-drc` adds one call to upstream's `apply_drc_blocks()` |

The browser and native versions differ for Yosys, Netgen and Magic. Where that could matter it is said in the section. Each browser build has a `web/vendor/<tool>/<version>/SOURCE.md`.

### Benchmark designs
| Design | Function | Cells (Yosys) | Clock | Die used | Sections |
|---|---|---|---|---|---|
| adder2 | 8-bit adder + XOR, no clock | 43 (old flow) / 35 (OpenROAD flow) / 45 (LibreLane) | none | 77.28 x 74.48 um (parity, 8); auto-sized in 3, 5 | 2, 3, 5, 6, 7, 8 |
| adder | same logic as adder2, different RTL names | 43 | none | auto | 2 |
| tiny8 | small 8-bit CPU, 48 flip-flops (`squeeze-tiny8` problem) | 236 / 255 / 287 (see 8B) | 24 ns | 135.52 x 133.28 um (7, 8A, 8B); 250 x 250 um (8 browser run); auto 103.6 x 101.9 um (2, 3, 5) | 1 to 8 |
| mult8 | 8x8 multiplier | not recorded | none | auto | 2, 3 |
| shreg4, sr8 | 4-bit and 8-bit shift registers (`sr8` made by `pd.selftest.mjs 8`, the number is the width) | not recorded | 10 ns (shreg4) | auto | 4, 5 |
| cnt8 | 8-bit counter | not recorded | 10 ns | auto | 4 |
| twoclk | two clocks, two flops, reset | not recorded | two clocks | auto | 2 |
| pins40 | 40 inputs, 2 outputs (pin placement test) | not recorded | none | auto | 2 |

RTL for all of them is in `web/studio/engines/pd.flow.mjs` (`DESIGNS`); tiny8 is also the `squeeze-tiny8` problem file. "Auto" means the flow chose the die from the cell area.

## 1. Clock tree (TritonCTS) matches native OpenROAD on tiny8

**Claimed:** the browser clock tree gives the same result as native OpenROAD.

**Test design:** tiny8 (48 flops), the placed DEF LibreLane wrote (`web/studio/demo/34-openroad-detailedplacement/tiny8.def`, 343 cells before CTS) and the SDC LibreLane used (`web/studio/engines/cts.tiny8.sdc`).

**Our flow:** OpenROAD commit 61932e8 built to WebAssembly (`web/vendor/openroad-cts/61932e8/SOURCE.md`). Same commit as the container's OpenROAD. Run it with `node web/studio/engines/cts.selftest.mjs`.

**Traditional flow:** native OpenROAD 26Q2-254-g61932e897 in the container, TritonCTS run from `cts_golden.tcl` on the same placed DEF. Its output DEF is kept at `web/studio/demo/35-openroad-cts/tiny8.def`.

**Result:**

| | Native | Browser |
|---|---|---|
| Clock buffers | 9 (clkbuf_8) | 9 |
| Sinks | 48 | 48 |
| Latency | 0.67 ns | 0.67 ns |
| Skew | 0 ns | 0 ns |
| Components in output DEF | 553 | 553 |
| Same cell, position and orientation | 553 of 553 (baseline) | 553 of 553 |

The self-test prints `cts selftest ok`. `node docs/validation/ctsdiff.mjs` does the DEF comparison (log: `logs/ctsdiff.txt`).

**Why section 8 shows 7 buffers, not 9:** this section runs the clock tree on LibreLane's placed DEF (343 cells, from LibreLane's netlist). Section 8 runs it on Studio's own placed DEF (271 cells, from Studio's netlist). Different input, so a different tree. Same code.

| Native OpenROAD | Browser TritonCTS |
|---|---|
| ![native](img/cts-native.png) | ![browser](img/cts-browser.png) |

Red squares are clock buffers, blue are flops, grey are other cells. The pictures are the same because the DEFs are the same.

**Not validated:** only tiny8 and the single-clock case. Wires are not compared (routing happens later). Only clkbuf_8/4/2 are allowed.

Log excerpt (rendered from `logs/cts.txt`, see the note at the end):

![cts log excerpt](img/term-cts.png)

## 2. Netgen LVS matches native Netgen

**Claimed:** the browser Netgen says match or mismatch the same way as native Netgen, and the old browser flow gives LVS match on the test designs.

**Test design:** adder2, mult8, tiny8 through the old flow (Yosys, graywolf, qrouter, Magic extract), at the flow's automatic die size. Also adder, twoclk and pins40 in `pd.cases.selftest.mjs`.

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

The tiny8 counts here (3100 / 1537) are from the automatic die (103.6 x 101.9 um). Section 7 and 8B use the larger die 135.52 x 133.28 um and get 3098 / 1536 with the old flow. Different die, different run; both are match.

Other `pd.cases.selftest.mjs` results (all PASS, 0 failed nets, LVS true): twoclk 56/32, adder 256/146, pins40 20/20. `lvs.selftest.mjs`: sr8 matches (224/224 devices, 109/109 nets) and a deliberately broken layout is caught (216 vs 224 devices).

**Flatten check:** `run.tcl` uses `catch {netgen::flatten class {<cell> <file index>}}`, and `catch` hides errors, so we checked that it works. Native Netgen 1.5.318 on adder2 prints 18 "Flattening instances of ..." lines (both files) and compares 256 devices / 146 nets; with the flatten lines removed it prints none and compares 43 devices / 61 nets (still "match uniquely"). So the syntax is right. Logs: `logs/netgen-native-adder2-flatten.log`, `-noflatten.log`.

**Version note:** native Netgen is 1.5.318; the browser build is 1.5.324 plus one fix. Netgen 1.5.324 native was not available.

**Not validated:** mismatch cases beyond one broken layout (a swapped net, an open net and a short are not tested; see section 9), so native and browser may differ on other mismatch reports. This section's flow has no well-tap cells and LVS assumes wells are tied to power. The OpenROAD flow (section 8) adds tap cells and its LVS (3150 devices / 1559 nets) includes them, but that run has no native Netgen comparison.

Log excerpts (rendered from the stored logs). Browser Netgen, then native Netgen on the same files:

![browser netgen](img/term-lvs-browser.png)

![native netgen](img/term-lvs-native.png)

## 3. qrouter fix: fewer Magic DRC errors (old flow)

**Claimed:** blocking wires near vias on Metal1-3 cuts DRC error tiles (adder2 18 to 3, mult8 118 to 39, tiny8 197 to 66) and keeps LVS matching.

**Test design:** adder2, mult8, tiny8 through the old flow at the automatic die, then Magic DRC.

**Our flow:** qrouter commit c8f1111 (unmodified build) and `c8f1111-drc` (one change: call upstream's own `apply_drc_blocks()` on Metal1-3). Details in `web/vendor/qrouter/c8f1111-drc/SOURCE.md`. `node docs/validation/drc-count.mjs <design>` runs one design. To compare with the unmodified build, point `qf` in `web/studio/engines/place.worker.js` at the old qrouter folder, run, then put it back.

**Traditional flow:** none. This is a before/after on our own browser flow. Native LibreLane gives clean routing on these designs, which is the target we have not reached.

**Result (`logs/drc.txt`):**

| Design | Before | After | Failed nets | LVS |
|---|---|---|---|---|
| adder2 | 18 | 3 | 0 | match |
| mult8 | 118 | 39 | 0 | match |
| tiny8 | 197 | 66 | 0 | match |

`pd.selftest.mjs 8` (sr8) now gives 0 error tiles. The same routed DEFs were also run through native Magic (section 5).

**Why other sections show different DRC numbers for the same designs.** The numbers above are at the flow's automatic die. Section 7 uses a forced, larger die (adder2 77.28 x 74.48 um, tiny8 135.52 x 133.28 um) and the old flow gives 2 (adder2) and 88 (tiny8) there. The die is the only input that changed (tiny8: the automatic die is 103.6 x 101.9 um per `parity/stress.mjs`, whose "studio-default" case also gave the 197 before the fix). Each number is right for its own run.

**Not validated:** the remaining tiles are real errors, so the old flow is not DRC clean. The DRC count is Magic's, not signoff. The number of distinct rules broken was not recorded.

Log excerpt (rendered from `logs/drc.txt`):

![drc log excerpt](img/term-drc.png)

## 4. OpenSTA timing and power match native OpenSTA

**What is checked:** the browser OpenSTA and native `sta` 3.1.0 read the same netlist, liberty and Tcl, and the complete output text is compared: every max and min path report, wns/tns, worst slack and the power report. `bash docs/validation/sta-compare.sh` (native side needs the container). Logs: `logs/sta-native-*.txt`, `logs/sta-browser-*.txt`.

**Test design:** shreg4 and an 8-bit counter (cnt8), clock 10 ns, input/output delay 2 ns, load 0.05 pF.

**Our flow:** OpenSTA commit defec0b (3.1.0) built to WebAssembly, the commit bundled in the container's OpenROAD (`web/vendor/opensta/defec0b/SOURCE.md`). Liberty is the unmodified gf180mcu tt 25C 5V file. Also `node web/studio/engines/opensta.selftest.mjs`.

**Traditional flow:** `/foss/tools/openroad/bin/sta` (3.1.0) in the container, run by the same script (2026-10-18).

| Design | Lines compared | Result | Setup worst slack | Hold worst slack | Total power |
|---|---|---|---|---|---|
| shreg4 | 434 | identical | 6.7093 ns | 0.5372 ns | 279 uW |
| cnt8 | 1172 | identical | 6.0215 ns | 1.2837 ns | 1710 uW |

Only the licence banner differs.

![shreg4 report, first lines](img/sta-shreg4.png)

**Not validated:** one liberty corner, two small designs. No wire-parasitic (SPEF) file was used in this comparison, so the SPEF reader and RC delay calculation are not compared with native. Post-route timing on tiny8 (section 8) uses SPEF but only the OpenSTA build is used there.

Log excerpt (rendered from `logs/opensta.txt`):

![opensta log excerpt](img/term-opensta.png)

## 5. Magic: DRC, extraction and GDS match native Magic

**Claimed:** browser Magic gives the same DRC count, extraction and GDS as native Magic.

**How:** `bash docs/validation/magic-compare.sh` runs the old browser flow, then browser Magic, then native Magic 8.3.636 in the container on the same routed DEF and the same PDK files (same command list as `magic.worker.js`). It compares the DRC total, the DRC rule texts, the extracted SPICE (apart from the `$SUB` name) and the GDS (KLayout 0.30.8 XOR, `gds-xor.py`). Logs: `logs/magic-native-*.txt`, `logs/magic-browser-*.txt`. Run 2026-10-18.

| Design | DRC tiles native / browser | Rule texts | SPICE | GDS XOR area |
|---|---|---|---|---|
| sr8 | 0 / 0 | same | same | 0 (25 layers) |
| adder2 | 3 / 3 | same | same | 0 (25 layers) |
| tiny8 | 66 / 66 | same | same | 0 (25 layers) |

| adder2 | tiny8 |
|---|---|
| ![adder2](img/layout-adder2.png) | ![tiny8](img/layout-tiny8.png) |

Left half of each picture is native Magic's GDS, right half is the browser's, both drawn by KLayout (`render-gds.py`). They match because the GDS geometry is the same.

**Not validated:** the DRC tile positions were not compared, only count and rule texts (the GDS match covers the layout itself). Same Magic tech file on both sides. Browser Magic is a different version from the container's. Only old-flow layouts were used here.

Log excerpt (rendered from the stored logs: browser lines and the last lines of the native logs):

![magic log excerpt](img/term-magic.png)

## 6. graywolf and qrouter against the same sources built natively (adder2)

**Question:** are the WebAssembly builds of graywolf, qflow's helpers and qrouter the same as the same sources built natively?

**Setup:** adder2, run in Node (`web/studio/engines/parity/browser.mjs adder2`), every tool call recorded. Each native tool got the same arguments and input files. Native tools were built in a throwaway container from the same image (`docker run --rm`, gcc and cmake from the image) at the same commits (graywolf 33fbcaa, qrouter c8f1111, qflow 52ecda1), with the same patches as our WebAssembly build. Details in `qflow-native.md`.

**Result (sha256 of the whole file; "same" means byte for byte):**

| Step | File | Result |
|---|---|---|
| qrouter -i | add.info | same |
| vlog2Cel | add.cel | same |
| graywolf chain (syntax, Mincut, TimberWolfMC, TimberWolfSC) | add.pl1, add.pl2, add.pin | same |
| addspacers | add_filled.def, add.obsx | same |
| qrouter (route) | add_route.def | **differs** |

The routed DEF differs in 223 lines, all inside the wires of some nets (header, components and pins are identical). Native: 438 wire segments, 417 vias; browser: 443 and 425. Both report "No failed routes". Magic DRC and Netgen LVS on both routed DEFs: 3 DRC tiles and LVS match each. A native build with `-ffp-contract=off` gave the same output as the normal native build, so fused multiply-add is not the cause. A 32-bit native build was not possible in the image. The cause is not known; word size is the remaining guess.

**Not validated:** only adder2, no clocked design, graywolf intermediate files not compared one by one.

## 7. LibreLane against the old browser flow, RTL to GDS (adder2, tiny8)

Run 2026-10-18 (browser numbers re-measured 2026-10-20 with the same result). Same RTL, PDK, clock, clock-buffer choice and die. Layouts differ by design: different placer and router, and LibreLane adds port, repair and tap cells. What can be proven is that both layouts are the same circuit.

**Dies.** adder2 77.28 x 74.48 um, tiny8 135.52 x 133.28 um. LibreLane needs more room than the old flow, so these are the smallest tried that LibreLane passed (tiny8 130 x 130 and adder2 74.48 x 68.88 failed with DPL-0036). The old flow was made to produce exactly these dies by changing only its spare-room setting, then the numbers were given to LibreLane as `DIE_AREA`.

**How LibreLane was run.** Image `hpretl/iic-osic-tools:chipathon26`, container `gf180`, LibreLane 3.0.2, in `/foss/designs/nishkam_jobs/parity_<design>_<tag>`: `librelane config.json --run-tag run`. Config written by `node web/studio/engines/parity/librelane.mjs <design> <W> <H> 50 <outdir> <tag>`; everything else is LibreLane's default (tap distance 20, routability-driven placement on):

```json
{ "meta": {"version": 3, "flow": "Classic"}, "PDK": "gf180mcuD",
  "FP_SIZING": "absolute", "DIE_AREA": [0, 0, 135.52, 133.28],
  "CLOCK_PERIOD": 24, "CLOCK_PORT": "clk",
  "CTS_CLK_BUFFERS": ["gf180mcu_fd_sc_mcu7t5v0__clkbuf_8", "gf180mcu_fd_sc_mcu7t5v0__clkbuf_4", "gf180mcu_fd_sc_mcu7t5v0__clkbuf_2"],
  "CTS_ROOT_BUFFER": "gf180mcu_fd_sc_mcu7t5v0__clkbuf_8",
  "PL_TARGET_DENSITY_PCT": 50, "DESIGN_NAME": "tiny8", "VERILOG_FILES": ["dir::tiny8.v"] }
```

For adder2, `DIE_AREA` is `[0, 0, 77.28, 74.48]` and `CLOCK_PORT` is null. LibreLane timing is its own `final/metrics.json` at corner `nom_tt_025C_5v00`. The old flow ran with `node web/studio/engines/parity/browser.mjs <design> <outdir>`.

**Formal equivalence.** Yosys 0.64 in the container, cell functions from the PDK liberty. Script `web/studio/engines/parity/equiv.sh`. Proof A: `equiv_make / equiv_simple / equiv_induct / equiv_status -assert` pairs every flop and output by name and proves by induction that they agree (tiny8: 48 of 48 points). Proof B (adder2 only): a miter circuit proved never to differ. Proof C: bounded `sat -seq` from the zero state.

| Design | Check | Proof A (unbounded) | Proof B (unbounded) | Proof C (bounded) |
|---|---|---|---|---|
| adder2 | old-flow synthesis netlist = LibreLane synthesis netlist | proven | proven | proven |
| adder2 | RTL = LibreLane final netlist | proven | proven | proven |
| adder2 | RTL = old-flow final netlist | proven | proven | proven |
| adder2 | RTL = LibreLane synthesis netlist | proven | proven | proven |
| adder2 | negative control (one gate swapped) | fails as it should | fails | fails |
| tiny8 | old-flow synthesis netlist = LibreLane synthesis netlist | proven | not run | not finished in 600 s |
| tiny8 | RTL = LibreLane final netlist | proven | not run | not finished in 600 s |
| tiny8 | RTL = old-flow final netlist | proven | not run | not finished in 600 s |
| tiny8 | RTL = LibreLane synthesis netlist | proven | not run | not finished in 600 s |
| tiny8 | negative control (one gate swapped) | fails as it should | not run | fails |

For tiny8, proof A carries the claim; B was not run and C did not return (not a failure). Full logs are in `parity_eq/` next to the LibreLane jobs on the test PC (not copied into this repo). With LVS passing on both sides, the chain is: RTL = final netlist (proof) = drawn layout (LVS).

**Signoff, same die, tt 25 C 5.00 V:**

| | adder2 old flow | adder2 LibreLane | tiny8 old flow | tiny8 LibreLane |
|---|---|---|---|---|
| LVS | match (256/256 devices, 146/146 nets) | 0 errors | match (3098/3098, 1536/1536) | 0 errors |
| Magic DRC tiles | 2 | 0 | 88 | 0 |
| Setup WNS / TNS (ns) | no clock | no clock | 12.90 / 0 | 9.62 / 0 |
| Hold WNS / TNS (ns) | no clock | 10.5 / 0 | 0.956 / 0 | 0.665 / 0 |
| Power (uW) | not measured | 488 | 4,120 | 6,972 |
| Run time (s) | 10 | 99 | 56 | 156 |

The old flow's remaining errors are Metal1/2/3 minimum-spacing rules (M1.2a, M2.2a, M3.2a), none inside library cells. Power is not a validated number: the switching-activity assumptions were not aligned. LibreLane's setup and hold differ from ours partly because LibreLane uses a different parasitic extractor (section 8B).

**Physical comparison, tiny8** (old flow against LibreLane; the percentage is against the LibreLane value):

| tiny8 | Old flow | LibreLane | Delta |
|---|---|---|---|
| Std cells | 263 | 488 | -46% |
| Cell area (um2) | 8,610 | 11,211 | -23% |
| Wire length (um) | 13,644 | 15,669 | -12.9% |
| Vias | 3,088 | 2,546 | +21.3% |
| Clock buffers | 5 | 9 | -44% |
| Clock skew (ns) | 0.01 | 0.27 | not comparable: ours from our OpenSTA, LibreLane's from its own report |

| adder2 | Old flow | LibreLane | Delta |
|---|---|---|---|
| Std cells | 43 | 119 | -64% |
| Cell area (um2) | 812 | 2,164 | -62% |
| Wire length (um) | 1,117 | 1,903 | -41% |
| Vias | 367 | 395 | -7% |

LibreLane's extra cells are port buffers, repair buffers and tap cells (tiny8: 56 repair buffers, 84 tap cells, 9 clock buffers).

Layouts, same die, same renderer (KLayout). Left old flow, right LibreLane:

![tiny8 side by side](img/tiny8-side-by-side.png)

![adder2 side by side](img/adder2-side-by-side.png)

**Stress runs of the old flow** (`web/studio/engines/parity/stress.mjs`, wall time on the test PC):

| Case | Die (um) | Result | Time |
|---|---|---|---|
| tiny8 x5 (parity die) | 135.5 x 133.3 | 5 of 5 give identical placement and route hashes; all LVS match | 68 to 76 s |
| tiny8, smallest die, no spare room | - | fails: clock tree stage stops (no room for clock buffers) | 41 s |
| tiny8, Studio default die | 103.6 x 101.9 (81.5% full) | passes: 0 failed nets, LVS match, 197 DRC tiles (before the qrouter fix) | 68 s |
| adder2, smallest die | 34.2 x 31.4 | fails: 1 failed net, LVS mismatch | 10 s |
| rmult20 (2,595 cells) | 243.6 x 243.0 | fails: LVS mismatch with equal device and net counts (open issue), 1272 DRC tiles | 1254 s (with other jobs running) |

**Not validated:** layout equality (not possible, different tools); old-flow DRC cleanliness (11 to 1,272 tiles on these designs); power; timing with different constraints; the formal proof covers logic function from the same reset state, not timing, clock-domain or physical correctness, and it trusts Yosys and each cell's liberty function. Only two small designs.

## 8. OpenROAD place and route in the browser

Two separate questions:
- **A. Is OpenROAD built to WebAssembly the same tool as native OpenROAD?** Same commit (61932e8), same Tcl, same input files, one thread: native in the container against WebAssembly in Node.
- **B. Does the Studio flow (a short fixed Tcl recipe) give a layout of similar quality to a full LibreLane run?** The two flows are not the same steps (see "Differences that stay"), so this is a sanity check on quality, not a proof of equality.

Run 2026-10-20 (A and B in Node with `node web/studio/engines/pnr-flow.selftest.mjs`; browser run in Chrome, below).

**Designs and setup.** adder2 (no clock) and tiny8 (one clock, 24 ns), same RTL and dies as section 7: adder2 77.28 x 74.48 um, tiny8 135.52 x 133.28 um (the browser run below uses 250 x 250 um, and was repeated in Node at that die), target density 50%, gf180mcuD 7-track cells, tt 25 C 5.00 V. One corner.

**How OUR browser flow was built.** OpenROAD commit 61932e8 (plus OpenSTA defec0b) built to WebAssembly with the patch `tools/openroad-pnr/openroad-61932e8-wasm.patch` (`web/vendor/openroad-pnr/61932e8/SOURCE.md`, rebuild steps in `tools/openroad-pnr/BUILD.md`). One thread. Other engines as in the version table. Steps, exactly as `web/studio/engines/pnr.worker.js` runs them:
1. Floorplan: written as a DEF (die, rows, tracks) and read with `read_def -floorplan_initialize`, because this build has no `initialize_floorplan`. Core margins 12 sites left/right and 4 rows top/bottom, as in the LibreLane DEFs.
2. `tapcell` (distance 20), `pdngen` (Metal4/Metal5 stripes, Metal1 rails), `global_placement -skip_io`, `place_pins`, `global_placement`, `buffer_ports`, `repair_design`, `detailed_placement -max_displacement {500 100}`.
3. Clock tree (clocked designs): TritonCTS, same script as section 1, but run on Studio's own placed DEF.
4. `global_route -congestion_iterations 50`, `detailed_route -droute_end_iter 64 -or_seed 42`, `filler_placement`.
5. Magic GDS + DRC + extraction, Netgen LVS, OpenSTA on Magic's SPEF.

**What the WebAssembly patch changes (33 files).** Placement, routing and clock-tree algorithms are not edited. The patch removes parts of OpenROAD these steps do not call, makes everything single thread, and fixes build problems. The effect of each removed module:

| Removed | What it does | In the browser flow instead | Effect on results |
|---|---|---|---|
| `ifp` | floorplan commands (`initialize_floorplan`, `make_tracks`) | floorplan written as a DEF | none on the layout; the DEF carries the same numbers |
| `rcx` (OpenRCX) | wire parasitic extraction | Magic extraction + OpenSTA | timing differs from LibreLane's own report (hold +35.5%, see 8B); not validated against OpenRCX |
| `psm` | IR-drop analysis | none | no IR-drop check in the browser flow |
| `mpl`, `par`, `ram`, `rmp`, `cgt`, `dft`, `exa`, `fin`, `pad`, `upf` | macro placement, partitioning, RAM generator, resynthesis, clock gating, scan, examples, fill, pads, power intent | not used | none for these designs; no macros, scan or pads |
| web server, GUI, distributed router | interface only | none | none |
| `cluster_flops` in `gpl` | needs OR-Tools | not available (error if called) | none unless called |

Other changes: OpenMP stubbed, the check in TritonRoute that expects 2 threads deleted, Tcl 8 type definitions in five `.i` files, 8-byte alignment on four odb classes, Boost.Serialization compiled from source. Every command the Studio flow calls is in the build. Applied to a clean tree, the patch gives back the built tree byte for byte (BUILD.md).

**How the TRADITIONAL flow was run.** As in section 7: LibreLane 3.0.2, OpenROAD 26Q2-254-g61932e897 (the same commit as our build; confirmed with `openroad -version` in the container on 2026-10-20), `librelane config.json --run-tag run`, config from `web/studio/engines/parity/librelane.mjs`. The runs are the section 7 runs; they were not repeated, but their step logs and metrics were read again for the counts below.

### A. WebAssembly against native OpenROAD (tiny8, same Tcl, same inputs, one thread)

`docs/validation/pnr-native.mjs` prepares the inputs and `docs/validation/pnr-native.sh` runs `openroad -threads 1` in the container. Place starts from the same synthesized netlist and floorplan DEF. Route starts from the same placed + clock-tree DEF (the one the WebAssembly flow made), so the router is compared on identical input.

| tiny8 | WebAssembly (Node) | Native, 1 thread | Delta |
|---|---|---|---|
| Placed netlist (after buffer_ports, repair_design) | md5 67a3591f... | md5 67a3591f... | identical file |
| Placed components at a different position | 0 of 305 (baseline) | 127 of 305 (41.6%) | not bit-identical |
| HPWL after detailed placement (um) | 8,479.5 | 8,584.3 | +1.2% |
| TritonRoute violations per iteration | 33 / 8 / 7 / 0 | 50 / 10 / 4 / 0 | different path, both end at 0 |
| Wire length (um, router log) | 10,235 | 10,247 | +0.1% |
| Vias | 1,889 | 1,878 | -0.6% |
| Time place / route (s) | 6 to 8 / 33 to 37 | 2.8 / 16.9 | WebAssembly is about 2 to 3 times slower per thread |

The WebAssembly build is not bit-identical to native OpenROAD, but the results agree to about 1% and both route to zero violations. We do not claim identical output. Which command first diverges and by how many microns cells move was not measured (section 9). The clock tree was not re-run natively on this exact run (section 1 does that).

### B. Studio flow against LibreLane (tiny8)

Each column's difference is the percentage against the LibreLane value. No marks are given. Wire length and vias come from ONE parser, `docs/validation/def-stats.mjs`, run on the final routed DEF of every flow. Timing comes from ONE tool chain, `docs/validation/pnr-timing-same-tool.mjs` (our Magic extraction + our OpenSTA), run on every flow's final DEF and netlist, LibreLane's included. "Studio OpenROAD on LibreLane's netlist" starts from LibreLane's own synthesized netlist (`NETLIST=... pnr-flow.selftest.mjs`), which removes the synthesis difference. "Old flow" is graywolf + qrouter (`parity/browser.mjs`, re-run 2026-10-20 with the same numbers as section 7).

| tiny8 | Studio OpenROAD | Delta vs LibreLane | Studio OpenROAD on LibreLane's netlist | Delta vs LibreLane | Old flow | LibreLane |
|---|---|---|---|---|---|---|
| TritonRoute violations | 0 (33/8/7/0) | same | 0 (72/13/9/0) | same | not run | 0 |
| Magic DRC tiles | 0 | same | 0 | same | 88 | 0 |
| LVS, our Netgen (transistor level) | match 3150/3150 devices, 1559/1559 nets | - | match 3156/3156, 1544/1544 | - | match 3098/3098, 1536/1536 | LibreLane's own Netgen is at cell level (356 devices, 372 nets, 0 errors); not comparable |
| Cells from synthesis | 236 | -17.8% | 287 | 0% | 255 | 287 |
| Cells after place (port + repair buffers) | 271 | -21.0% | 322 | -6.1% | 255 | 343 |
| Cells at the end (no tap, endcap, filler) | 279 | -20.7% | 330 | -6.3% | 263 | 352 |
| Cells added before CTS | 35 (33 port `buf_1` + 2 inverters) | -37.5% | 35 | -37.5% | 0 | 56 (54 `dlyb_1` + 2 buffers) |
| Buffers added by repair_timing | not run | - | not run | - | not run | 0 |
| Clock buffers | 7 | -22.2% | 7 | -22.2% | 5 | 9 |
| Wire length (um) | 10,236 | -34.7% | 11,138 | -28.9% | 13,644 | 15,670 |
| Vias | 1,889 | -25.8% | 2,167 | -14.9% | 3,088 | 2,546 |
| Setup: time the critical path uses = 24 ns - slack (ns) | 12.44 | -14.1% | 12.04 | -16.9% | 11.10 | 14.48 |
| Setup slack (ns), for reference | 11.56 | +21.4% | 11.96 | +25.6% | 12.90 | 9.52 |
| Hold slack (ns) | 0.901 | -6.0% | 0.953 | -0.5% | 0.957 | 0.958 |

All columns except the last: same extraction (Magic) and same OpenSTA. LibreLane's own report, which uses OpenRCX and OpenSTA, gives setup 9.62 ns and hold 0.665 ns. Against that number our hold slack (0.901 ns) is +35.5% higher; the gap is the extractor, not the layout (see the last bullet).

Parasitic extractor, as a 2-row table (LibreLane's final layout, same tt corner):

| Extractor | Hold slack (ns) | Setup slack (ns) |
|---|---|---|
| Magic + our OpenSTA (same-tool chain) | 0.958 | 9.52 |
| OpenRCX + OpenSTA (LibreLane's own report) | 0.665 | 9.62 |

What the table says, in plain words:
- In LibreLane, `repair_timing` added 0 buffers (setup 0, hold 0, from the step metrics). The 56 cells added before CTS were 33 port buffers (`dlyb_1` delay cells) and 23 from `repair_design`. We add 33 port buffers (`buf_1`) and 2 inverters. So the buffers are not the main reason for LibreLane's longer wires.
- The flows do not start from the same netlist. Yosys gives 236 cells in the Studio OpenROAD flow, 255 in the old flow and 287 in LibreLane. The old-flow and LibreLane netlists are proven equal to the RTL in section 7; the OpenROAD flow's is covered by the equivalence check below. The synthesis difference comes from different Yosys scripts and versions (0.68.1207 against 0.64); which of the two matters was not tested. With LibreLane's netlist the Studio flow gets 11,138 um instead of 10,236 um, so about 900 um of the gap is the netlist. About 4,500 um (29% of LibreLane's wire) remains and we do not know why. LibreLane turns on routability-driven placement and uses different pin buffers and a different power grid; we did not test which matters.
- Timing, like with like: with the same extraction and the same OpenSTA, LibreLane's layout gives hold 0.958 ns and ours 0.901 ns (-6%), and the critical path uses 14.48 ns against our 12.44 ns (-14%). Slack as a percentage is a weak measure (it depends on the clock we picked), so setup is compared as the time the path takes; hold does not depend on the clock.
- Magic extraction was not validated against OpenRCX.

### Logic equivalence of the place-and-route netlist

`pnr-flow.selftest.mjs` also proves with Yosys (`equiv_make`, `equiv_simple`, `equiv_induct`, cell functions from the liberty, same recipe as section 7) that (1) the netlist after place + clock tree (with port, repair and clock buffers) is equivalent to the netlist Yosys made before place, and (2) it is equivalent to the RTL. A negative control (one gate swapped for its dual) makes the proof fail, as it must. tiny8 and adder2 pass all three. This closes the gap that LVS alone leaves (LVS only compares the layout with the place-and-route tool's own netlist). It checks this build's netlist edits on these two designs; it is not a general proof.

### adder2

| adder2 (no clock) | Studio OpenROAD | Delta vs LibreLane | Old flow | LibreLane |
|---|---|---|---|---|
| TritonRoute violations / Magic DRC tiles | 0 (9 / 0) / 0 | same | not run / 2 | 0 / 0 |
| LVS, our Netgen | match 382/382 devices, 209/209 nets | - | match 256/256, 146/146 | cell level (82 devices, 96 nets); not comparable |
| Cells from synthesis | 35 | -22% | 43 | 45 |
| Cells at the end (no tap, endcap, filler) | 68 | -13% | 43 | 78 |
| Wire length (um) | 1,459 | -23% | 1,117 | 1,903 |
| Vias | 315 | -20% | 367 | 395 |
| Whole flow time (s) | about 24 (Yosys 2.6, place 6.8, route 11.9, Magic 1.9, Netgen 0.3) | - | 7.5 | 99 |
| Timing | not compared | - | not compared | not compared |

adder2 has no clock and Studio's timing step needs a clock port, so no timing number is compared for it (section 9).

### Run time

LibreLane's 156 s (tiny8) is the whole container run: synthesis to signoff, including KLayout XOR and DRC, antenna checks, RCX and the IR-drop report. The comparable Studio number is the whole flow in Node: Yosys 5.5 + place 7.0 + CTS 19.2 + route 34.1 + Magic 12.0 + Netgen 0.5 + OpenSTA 4.1 = about 82 s, on the same PC (the 250 x 250 um rerun below took 107 s with other programs running). Step by step, LibreLane (default threads) took 1.8 s for global placement, 1.6 s for detailed placement, 20.2 s for CTS, 1.7 s for global route and 21.8 s for detailed route. The one-thread native run of our Tcl took 2.8 s (place) and 16.9 s (route) (table A). Peak WebAssembly memory: 100 MB placing, 249 MB routing (299 MB at 250 x 250 um); the build allows 2 GB.

### Differences that stay (so "same steps" is NOT claimed)
- Our recipe has no routability-driven placement and no `repair_timing`; LibreLane's config has routability-driven placement on and ran `repair_timing` (it changed nothing here).
- Different synthesis script and Yosys version, a different buffer cell on the ports (`buf_1` against `dlyb_1`).
- LibreLane checks several corners; we run one (tt).
- LibreLane's own timing uses OpenRCX; ours uses Magic. Only the same-tool rows are like with like.

### In the browser (Studio), and the same die in Node

Browser run, 2026-10-20, Chrome 155 on Windows 11, Studio opened from a local server (`studio.html?mock=1`), example tiny8, clock 24 ns, **die 250 x 250 um**, density 50%, "In-browser place and route = OpenROAD (TritonRoute)", "Run All". One run. Total 96 s. The Node column is the same flow at the same die (`node web/studio/engines/pnr-flow.selftest.mjs tiny8 250 250`, run 2026-10-20, log `logs/pnr-node-tiny8-250.txt`).

| tiny8, 250 x 250 um | Chrome (Studio page) | Node (same code) |
|---|---|---|
| Placement instances (with tap cells) | 696 | 696 |
| Clock buffers / sinks / latency / skew | 7 / 48 / 1.01 ns / 0 ns | 7 / 48 / 1.01 ns / 0 ns |
| TritonRoute violations per iteration | 42, 3, 3, 0 | 42, 3, 3, 0 |
| Wire length (um) / vias | 11,776 / 1,848 | 11,776 / 1,848 |
| Magic DRC tiles | 0 | 0 |
| Netgen LVS | match, 3150 devices, 1559 nets | match, 3150 devices, 1559 nets |
| Signoff setup / hold slack (ns) | 11.45 / 0.92 | 11.445 / 0.9211 |
| Time place / CTS / route (s) | 6.3 / 20.0 / 33.0 | 9.4 / 26.9 / 38.1 (PC busier) |

So the browser page and Node give the same layout at this die. Native OpenROAD was not run at 250 x 250 um; the browser-to-native link is table A at the 135.52 x 133.28 um die, so "browser = Node = native" is shown in two steps, not one table. Other browser rows: Timing (STA after routing) setup 12.79 ns, hold 0.99 ns, Fmax 89.19 MHz; signoff timing with Magic wire delays setup 11.45 ns, hold 0.92 ns, Fmax 79.65 MHz.

No browser console errors were seen after the run started (console was read only from then on; load-time errors were not checked). Switching the select to graywolf + qrouter and running Placement still works. Only Chrome was tried.

![routed layout in Studio](img/pnr-browser-layout-routed.png)

![placed layout and signoff log in Studio](img/pnr-browser-layout-placed-signoff-log.png)

![timing view in Studio](img/pnr-browser-timing.png)

![graywolf + qrouter fallback in Studio](img/pnr-browser-graywolf-fallback.png)

**NOT validated in section 8.**
- Bit-identical results to native OpenROAD (they are not; table A).
- Why LibreLane's wire is 29% longer than ours on the same netlist.
- Magic extraction against OpenRCX; other corners (ss, ff).
- Large or hard designs. Both designs are tiny, at 50% density with a relaxed 24 ns clock (setup slack above 9 ns). Congestion, tight timing and the browser memory limit are not tested on anything bigger.
- Firefox and Safari. Power. adder2 timing. A side-by-side native layout picture. The clock tree natively on this exact run.

## 9. Known limits and next checks

Things we know are open. None is claimed as validated.

1. **Cell-position difference in table A (127 of 305 cells).** Not yet traced: which command first diverges (`global_placement` or `detailed_placement`), the cause (for example 32-bit against 64-bit arithmetic or ordering), and the mean and maximum cell move in microns. Next: dump the placement after each command in both builds and compare.
2. **SPEF timing.** Section 4 compares OpenSTA without wire parasitics. Next: feed tiny8's Magic SPEF to both browser and native `sta` and diff the reports.
3. **Combinational timing.** adder2 has no clock, so no timing is compared. Next: add a virtual clock or `set_max_delay` to `pnr-timing-same-tool.mjs`.
4. **LVS negative controls.** Only one broken layout (a missing device) is tested. Next: add equal-device-count cases (two swapped nets, an open net, a power-to-ground short) and compare browser and native diagnostics.
5. **Side-by-side layout picture** of WebAssembly against native OpenROAD for table A, and a browser run at the 135.52 x 133.28 um die, so the page, Node and native can share one die.
6. **Reproducibility.** `drc-count.mjs` needs a hand edit to compare the two qrouter builds (section 3); it should take the qrouter folder as an argument. The LibreLane runs in sections 7 and 8 are on the test PC only.
7. **RTL grader.** The practice grader (Yosys miter, k-induction first, "proven" only when induction succeeds, else "first 40 cycles") has no section here. `node web/grader.test.mjs` (log `logs/grader.test.txt`) covers the CDC checks only. Until an RTL section with test cases exists, the grader is not covered by this report.
8. **Runner.** The statement "runner round trip verified (shreg4 signoff clean 14/14)" has no stored log. The runner is not part of this report.
9. **Missing counts.** Synthesis cell counts for mult8, shreg4, sr8, cnt8, twoclk and pins40 were not recorded, so the benchmark table says so.

## 10. How to repeat

Needs Node, a folder with `@yowasp/yosys` in `node_modules` (run commands from the repo root), Docker, and Git Bash on Windows.

Start the traditional side (the container with the same image; `~/eda/designs` is shared as `/foss/designs`):

```bash
docker pull hpretl/iic-osic-tools:chipathon26
docker run -d --name gf180 -v "$HOME/eda/designs:/foss/designs" hpretl/iic-osic-tools:chipathon26 --wait
export MSYS_NO_PATHCONV=1      # Git Bash on Windows: stops path mangling in docker exec
docker exec gf180 bash -lc "openroad -version; sta -version; netgen -batch quit; yosys -V; pip show librelane | head -2"
```

Browser-side tests, from the repo root:

```bash
node web/studio/engines/cts.selftest.mjs
node web/studio/engines/lvs.selftest.mjs
node web/studio/engines/opensta.selftest.mjs
node web/studio/engines/pd.cases.selftest.mjs
node web/studio/engines/pd.selftest.mjs 8        # 8 = shift-register width (sr8)
node web/studio/engines/selftest.node.mjs
node web/grader.test.mjs
node docs/validation/ctsdiff.mjs
```

Native side by side (each script copies its files to `$HOME/eda/designs/nishkam_validation` and writes logs here):

```bash
bash docs/validation/sta-compare.sh
bash docs/validation/magic-compare.sh
bash docs/validation/netgen-compare.sh
```

OpenROAD place and route (section 8):

```bash
OUT=$PWD/out node web/studio/engines/pnr-flow.selftest.mjs tiny8              # 135.52 x 133.28 um die
OUT=$PWD/out node web/studio/engines/pnr-flow.selftest.mjs tiny8 250 250      # the browser-run die
node web/studio/engines/pnr-flow.selftest.mjs adder2
NETLIST=<file> node web/studio/engines/pnr-flow.selftest.mjs tiny8            # start from another flow's netlist
node docs/validation/pnr-native.mjs $PWD/out tiny8                            # WebAssembly against native
bash docs/validation/pnr-native.sh tiny8
node docs/validation/def-stats.mjs <final.def> ...
node docs/validation/pnr-timing-same-tool.mjs <top> <final.def> <final netlist.v>
```

LibreLane baseline (sections 7 and 8; one job at a time):

```bash
node web/studio/engines/parity/librelane.mjs tiny8 135.52 133.28 50 $HOME/eda/designs/nishkam_jobs/parity_tiny8_x x
docker exec -w /foss/designs/nishkam_jobs/parity_tiny8_x gf180 bash -lc "librelane config.json --run-tag run"
```

Old flow and formal checks: `node web/studio/engines/parity/browser.mjs <design> <outdir>` (set `HEADROOM=0,8970` for tiny8, `0,4400` for adder2 to get the section 7 dies); proofs with `web/studio/engines/parity/equiv.sh` inside the container.

**Note on the log images.** The `img/term-*.png` pictures are log text drawn into an image by `python docs/validation/make-terminal-images.py` from the stored files in `logs/`. They are not screenshots of a terminal; the text is not edited. The `img/pnr-browser-*.png` pictures are real browser screenshots.
