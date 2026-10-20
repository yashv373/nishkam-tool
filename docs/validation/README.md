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
6. Other "same as native" lines in `web/vendor/*/SOURCE.md` (graywolf, Magic, qrouter). See Claims under review.
7. Runner round trip: shreg4 signoff clean 14/14. See Claims under review.
8. The grader proves a design equals the reference. See Claims under review.

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

**Screenshot of the real output** (`img/term-cts.png`, unedited log text):

![cts output](img/term-cts.png)

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

**Note:** the container has Netgen 1.5.318, not 1.5.324 as `SOURCE.md` says. This run compared against 1.5.318; the browser build is 1.5.324 plus one fix. `SOURCE.md` is corrected (#41).

**Not validated:** mismatch cases beyond one broken layout, so native and browser may differ on other mismatch reports. LVS assumes wells are tied to power (no well-tap cells in this flow). Netgen 1.5.324 native was not available.

**Screenshots of the real output** (unedited logs). Browser Netgen, then native Netgen on the same files:

![browser netgen](img/term-lvs-browser.png)

![native netgen](img/term-lvs-native.png)

## 4. qrouter fix: fewer Magic DRC errors

**Claimed:** blocking wires near vias on Metal1-3 cuts DRC error tiles (adder2 18 to 3, mult8 118 to 39, tiny8 197 to 66) and keeps LVS matching.

**Test design:** adder2, mult8, tiny8 through the browser flow, then Magic DRC.

**Our flow:** qrouter commit c8f1111 (unmodified build) and `c8f1111-drc` (one change: call upstream's own `apply_drc_blocks()` on Metal1-3). Details in `web/vendor/qrouter/c8f1111-drc/SOURCE.md`. `node docs/validation/drc-count.mjs <design>` runs one design. To compare, point `qf` in `web/studio/engines/place.worker.js` at the old folder (this run did that, then put it back).

**Traditional flow:** none. This is a before/after on our own browser flow. Native LibreLane gives clean routing on these designs (#19), which is the target we have not reached.

**Result (`logs/drc.txt`):**

| Design | Before | After | Failed nets | LVS |
|---|---|---|---|---|
| adder2 | 18 | 3 | 0 | match |
| mult8 | 118 | 39 | 0 | match |
| tiny8 | 197 | 66 | 0 | match |

`pd.selftest.mjs 8` (sr8) now gives 0 error tiles. The same routed DEFs were also run through native Magic: see "Magic native re-run" below.

**Not validated:** the remaining 3 / 39 / 66 tiles are real errors, so browser routing is not DRC clean. The DRC count is Magic's, not signoff.

**Screenshot of the real output** (`logs/drc.txt`):

![drc output](img/term-drc.png)

## 5. OpenSTA timing and power: summary numbers (native side not re-run)

**What is checked:** the browser OpenSTA (`opensta.selftest.mjs`) gives worst setup slack, worst hold slack and total power that equal numbers stored in the self-test file. Those stored numbers came from native `sta` earlier. The full report text was not compared in this run, and native `sta` was not re-run (#42). See "Claims under review".

**Test design:** shreg4 and an 8-bit counter (cnt8), clock 10 ns, input/output delay 2 ns, load 0.05 pF.

**Our flow:** OpenSTA commit defec0b (3.1.0) built to WebAssembly, the commit bundled in the container's OpenROAD (`web/vendor/opensta/defec0b/SOURCE.md`). Liberty is the unmodified gf180mcu tt 25C 5V file. Run `node web/studio/engines/opensta.selftest.mjs`.

**Traditional flow:** `/foss/tools/openroad/bin/sta` (3.1.0) with the same Tcl. Not re-run today.

**Result (browser, this run; the self-test compares them with the stored native numbers and printed PASS for both):**

| Design | Setup worst slack | Hold worst slack | Total power |
|---|---|---|---|
| shreg4 | 6.7093 ns | 0.5372 ns | 279 uW |
| cnt8 | 6.0215 ns | 1.2837 ns | 1710 uW |

**Not validated:** one liberty corner only. Only these two small designs. Post-route timing was run for tiny8 (setup 12.9621, hold 1.0438 in `pd.cases.selftest.mjs`) but not compared with native.

**Screenshot of the real output** (`logs/opensta.txt`, browser self-test):

![opensta output](img/term-opensta.png)

## Magic native re-run (DRC, extraction, GDS), #42

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

**Screenshot of the real output** (browser lines and the last lines of the native logs):

![magic output](img/term-magic.png)

## OpenSTA native re-run (full report), #42

**How:** `bash docs/validation/sta-compare.sh` runs the browser OpenSTA and native `sta` 3.1.0 (container) on the same netlist, liberty and Tcl, and diffs the complete output: every max and min path report, wns/tns, worst slack and the power report. Logs: `logs/sta-native-*.txt`, `logs/sta-browser-*.txt`.

| Design | Lines compared | Result |
|---|---|---|
| shreg4 | 434 | identical |
| cnt8 | 1172 | identical |

![shreg4 report, first lines](img/sta-shreg4.png)

Only the licence banner differs. This replaces the stored native numbers in section 5 with a native run from today. Images are made by `python docs/validation/make-images.py <magic output folder>`.

**Not validated:** one liberty corner, two small designs, no SPEF run in this comparison.

## graywolf and qrouter

Compared in `qflow-native.md` (#29): graywolf placement files and qrouter inputs identical on adder2; the qrouter routed DEF differs in some wire choices (both route fully). `SOURCE.md` now says so.

## 7. LibreLane vs Nishkam, RTL to GDS (adder2, tiny8)

Same RTL, PDK, clock, CTS buffers and die. Yosys formally proves the final netlists of both flows equal to the RTL and to each other (adder2 three ways; tiny8 by equiv_induct over all 48 flops; a one-gate mutation makes every proof fail). LVS clean on both sides, timing met on both. Layouts differ by design (different placer/router; LibreLane adds port, repair and tap cells). Full write-up, numbers, images and commands: [librelane-parity.md](librelane-parity.md) (#25).

## 8. OpenROAD place and route in the browser (#26)

What this checks, as two separate questions:
- **A. Is OpenROAD built to WebAssembly the same tool as native OpenROAD?** Same commit (61932e8), same Tcl, same input files, one thread: native in the `gf180` container against WebAssembly in Node. Answered by table A.
- **B. Does the Studio flow (a short fixed Tcl recipe) give a layout of similar quality to a full LibreLane run?** Answered by table B. The two flows are NOT the same steps (see "Differences that stay"), so this is a sanity check on quality, not a proof that they are equal.

All numbers below were measured by running the code in Node (`node web/studio/engines/pnr-flow.selftest.mjs`), not in a browser. The click-through of the Studio page in a browser is a separate check (#26) and is not claimed here.

**Designs and setup.** adder2 (no clock) and tiny8 (one clock, 24 ns), the same RTL and the same dies as section 7: adder2 77.28 x 74.48 um, tiny8 135.52 x 133.28 um, target density 50%, gf180mcuD 7-track cells, tt 25 C 5.00 V. One corner only.

**How OUR browser flow was built.** OpenROAD commit 61932e8 (plus OpenSTA defec0b) built to WebAssembly with the patch `tools/openroad-pnr/openroad-61932e8-wasm.patch` (see `web/vendor/openroad-pnr/61932e8/SOURCE.md`, rebuild steps in `tools/openroad-pnr/BUILD.md`). One thread. Other engines as in section 7 (Yosys `@yowasp/yosys` 0.68.1207, Magic bed8d4f, Netgen 3cb047b, OpenSTA defec0b). Steps, exactly as `web/studio/engines/pnr.worker.js` runs them:
1. Floorplan: written as a DEF (die, rows, tracks) and read with `read_def -floorplan_initialize`, because this build has no `initialize_floorplan`. Core margins 12 sites left/right and 4 rows top/bottom, as in the LibreLane DEFs.
2. `tapcell` (distance 20), `pdngen` (Metal4/Metal5 stripes, Metal1 rails), `global_placement -skip_io`, `place_pins`, `global_placement`, `buffer_ports`, `repair_design`, `detailed_placement -max_displacement {500 100}`.
3. Clock tree (clocked designs): TritonCTS, same script as section 1.
4. `global_route -congestion_iterations 50`, `detailed_route -droute_end_iter 64 -or_seed 42`, `filler_placement`.
5. Magic GDS + DRC + extraction, Netgen LVS, OpenSTA on Magic's SPEF.

**What the WebAssembly patch changes (33 files).** The placement, routing and clock-tree algorithms are not edited. The patch:
- leaves out whole parts of OpenROAD that these steps do not need: `ifp` (initialize_floorplan, make_tracks), `mpl`, `rcx` (OpenRCX), `psm` (IR drop), `fin`, `rmp`, `cgt`, `dft`, `ram`, `exa`, `par`, `pad`, `upf`, the web server and the GUI; the distributed router is replaced by a stub;
- removes `cluster_flops` in `gpl` (it needs OR-Tools; the build says so if it is called);
- makes everything single thread (OpenMP stubbed) and deletes the check in TritonRoute that expects 2 threads;
- small build fixes: Tcl 8 type definitions in five `.i` files, 8-byte alignment on four odb classes, Boost.Serialization compiled from source.

Every command the Studio flow calls (`tapcell`, `pdngen`, `global_placement`, `place_pins`, `buffer_ports`, `repair_design`, `detailed_placement`, `global_route`, `detailed_route`, `filler_placement`, TritonCTS) is in the build. The patch is the full list of changes: applied to a clean tree it gives back the built tree byte for byte (BUILD.md).

**How the TRADITIONAL flow was run.** As in section 7: image `hpretl/iic-osic-tools:chipathon26`, LibreLane 3.0.2, OpenROAD 26Q2-254-g61932e897 (the same commit as our build; checked with `openroad -version` in the container on 2026-10-20), `librelane config.json --run-tag run`, config from `web/studio/engines/parity/librelane.mjs`. The runs used are the section 7 runs (`~/eda/designs/nishkam_jobs/parity_tiny8_x` and `parity_adder2_y`); they were not repeated, but their step logs and metrics were read again for the cell and buffer counts below.

### A. WebAssembly vs native OpenROAD (tiny8, same Tcl, same inputs, one thread)

`docs/validation/pnr-native.mjs` prepares the inputs and `docs/validation/pnr-native.sh` runs `openroad -threads 1` in the container. Place starts from the same synthesized netlist and floorplan DEF. Route starts from the same placed + clock-tree DEF (the one the WebAssembly flow made), so the router is compared on identical input.

| tiny8 | WebAssembly | Native, 1 thread | Mark | Reason |
|---|---|---|---|---|
| Placed netlist (after buffer_ports, repair_design) | md5 67a3591f... | md5 67a3591f... | match | identical file |
| Placed components at a different position | | 127 of 305 | differs | not bit-identical |
| HPWL after detailed placement (um) | 8,479.5 | 8,584.3 | match (+1.2%) | |
| TritonRoute violations per iteration | 33 / 8 / 7 / 0 | 50 / 10 / 4 / 0 | match (both end at 0) | different path, same end |
| Wire length (um, router log) | 10,235 | 10,247 | match (+0.1%) | |
| Vias | 1,889 | 1,878 | match (-0.6%) | |
| Time place / route (s) | 6 to 8 / 33 to 37 (Node) | 2.8 / 16.9 | n/a | WebAssembly is about 2 to 3 times slower per thread |

So the WebAssembly build is not bit-identical to native OpenROAD (floating-point or ordering differences move some cells), but the results agree to about 1% and both route to zero violations. We do not claim identical output. The clock-tree step was not re-run natively here (section 1 does that: tiny8 matches native exactly).

### B. Studio flow vs LibreLane (tiny8)

Match = within 2%, close = within 35%, differs = otherwise; the percentage is against the LibreLane value. Wire length and vias come from ONE parser, `docs/validation/def-stats.mjs`, run on the final routed DEF of every flow. Timing comes from ONE tool chain, `docs/validation/pnr-timing-same-tool.mjs` (our Magic extraction + our OpenSTA), run on every flow's final DEF and netlist, LibreLane's included. Extra columns: "Studio OpenROAD on LibreLane's netlist" starts from LibreLane's own synthesized netlist (`NETLIST=... pnr-flow.selftest.mjs`), which removes the synthesis difference; "qrouter" is the older graywolf + qrouter flow (`parity/browser.mjs`, re-run 2026-10-20 with the same numbers as section 7).

| tiny8 | Studio OpenROAD | Studio OpenROAD on LibreLane's netlist | qrouter (old) | LibreLane | Mark (Studio OpenROAD vs LibreLane) |
|---|---|---|---|---|---|
| TritonRoute violations | 0 (33/8/7/0) | 0 (72/13/9/0) | not run | 0 | match |
| Magic DRC | 0 | 0 | 88 | 0 | match |
| LVS, our Netgen at transistor level | match: 3150/3150 devices, 1559/1559 nets | match: 3156/3156, 1544/1544 | match: 3098/3098, 1536/1536 | match (LibreLane's own Netgen run is at cell level: 356 devices, 372 nets, 0 errors; not comparable) | match |
| Cells from synthesis | 236 | 287 | 255 | 287 | differs (-18%): different Yosys scripts |
| Cells after place (port + repair buffers) | 271 | 322 | 255 (none added) | 343 | differs (-21%) |
| Cells at the end (no tap, endcap, filler) | 279 | 330 | 263 | 352 | close (-21%) |
| Cells added before CTS | 35 (33 port buffers `buf_1` + 2 inverters) | 35 | 0 | 56 (54 `dlyb_1` + 2 buffers) | close |
| Buffers added by repair_timing | not run | not run | not run | 0 (setup 0, hold 0) | n/a |
| Clock buffers | 7 | 7 | 5 | 9 | close (-22%) |
| Wire length (um) | 10,236 | 11,138 | 13,644 | 15,670 | close (-34.7%, at the limit) |
| Vias | 1,889 | 2,167 | 3,088 | 2,546 | close (-25.8%) |
| Setup: time the critical path uses = 24 ns - slack (ns) | 12.44 | 12.04 | 11.10 | 14.48 | close (-14%) |
| Setup slack (ns), for reference | 11.56 | 11.96 | 12.90 | 9.52 | not used for the mark |
| Hold slack (ns) | 0.901 | 0.953 | 0.957 | 0.958 | close (-6%) |
| LibreLane's own report (OpenROAD RCX + OpenSTA): setup / hold slack (ns) | | | | 9.62 / 0.665 | hold: differs (ours is +35.5% above it); the gap is the extractor, see below |

What the table says, in plain words:
- The earlier draft said LibreLane "also repairs timing and adds buffers; we do not". That was wrong. In LibreLane `repair_timing` added 0 buffers (setup 0, hold 0, from the step metrics). The 56 buffers came before it: 33 port buffers (`dlyb_1` delay cells) and 23 from `repair_design`. We add 33 port buffers (`buf_1`) and 2 inverters. So the buffers are not the main reason for LibreLane's longer wires.
- The three flows do not start from the same netlist. Yosys gives 236 cells in Studio's OpenROAD flow, 255 in the qrouter flow and 287 in LibreLane (qrouter and LibreLane netlists are proven equal to the RTL in section 7; the OpenROAD flow is covered by the equivalence check below). With LibreLane's own netlist the Studio flow gets 11,138 um instead of 10,236 um, so about 900 um of the gap is the netlist. About 4,500 um (29% of LibreLane's wire) remains and we do not know why. LibreLane's config turns on routability-driven placement and it uses different pin buffers and a different power grid; we did not test which of these matters.
- Timing, like with like: with the SAME extraction and the SAME OpenSTA, LibreLane's layout gives hold 0.958 ns and ours 0.901 ns (-6%, 0.057 ns apart), and the critical path uses 14.48 ns against our 12.44 ns (-14%). LibreLane's own report (OpenRCX, hold 0.665 ns) is lower because that is a different extractor; the same-tool numbers show the layout is not the cause. We do not validate Magic extraction against OpenRCX here.
- Slack as a percentage is a weak measure (it depends on the clock we picked), so the setup mark uses the time the path takes. Hold slack does not depend on the clock, so it is compared directly.

### Logic equivalence of the place-and-route netlist

`pnr-flow.selftest.mjs` now also proves with Yosys (`equiv_make`, `equiv_simple`, `equiv_induct`, cell functions from the liberty, same recipe as section 7) that:
1. the netlist after place + clock tree (with the port, repair and clock buffers) is equivalent to the netlist Yosys produced before place, and
2. it is equivalent to the RTL.

A negative control (one nand/and/or/nor swapped for its dual in the same netlist) must make the proof fail, and it does. Result: tiny8 and adder2 pass all three checks. This closes the gap that LVS alone leaves (LVS only compares the layout with the place-and-route tool's own netlist). It checks this build's netlist edits on these two designs; it is not a general proof.

### adder2

| adder2 (no clock) | Studio OpenROAD | qrouter (old) | LibreLane |
|---|---|---|---|
| TritonRoute violations / Magic DRC | 0 (9 / 0) / 0 | not run / 2 | 0 / 0 |
| LVS, our Netgen | match: 382/382 devices, 209/209 nets | match: 256/256, 146/146 | match (cell level: 82 devices, 96 nets; not comparable) |
| Cells from synthesis | 35 | 43 | 45 |
| Cells at the end (no tap, endcap, filler) | 68 | 43 | 78 |
| Wire length (um) | 1,459 | 1,117 | 1,903 |
| Vias | 315 | 367 | 395 |
| Whole flow time (s) | about 24 (Yosys 2.6, place 6.8, route 11.9, Magic 1.9, Netgen 0.3) | 7.5 | 99 |
| Timing | not compared | not compared | not compared |

Marks (Studio OpenROAD vs LibreLane): wire length -23% close, vias -20% close, cells 68 against 78 close (-13%). adder2 has no clock and Studio's timing step needs a clock port, so no timing number is compared for it.

### Run time

LibreLane's 156 s (tiny8) is the whole container run: synthesis to signoff, including KLayout XOR and DRC, antenna checks, RCX and the IR-drop report. The comparable Studio number is the whole flow in Node: Yosys 5.5 + place 7.0 + CTS 19.2 + route 34.1 + Magic 12.0 + Netgen 0.5 + OpenSTA 4.1 = about 82 s, on the same PC. Step by step, LibreLane (default threads) took 1.8 s for global placement, 1.6 s for detailed placement, 20.2 s for CTS, 1.7 s for global route and 21.8 s for detailed route. The one-thread native run of our Tcl took 2.8 s (place) and 16.9 s (route) (table A). Peak WebAssembly memory: 100 MB placing, 249 MB routing (the build allows 2 GB).

### Differences that stay (so "same steps" is NOT claimed)
- Our recipe has no routability-driven placement and no `repair_timing`; LibreLane's config has routability-driven placement on and ran `repair_timing` (it changed nothing here).
- Different synthesis script (see cell counts), a different buffer cell on the ports (`buf_1` against `dlyb_1`), and our floorplan is written as a DEF with the same numbers.
- LibreLane checks several corners; we run one (tt).
- LibreLane's own timing uses OpenRCX; ours uses Magic. Only the "same tool" rows are like with like.

**NOT validated.**
- Bit-identical results to native OpenROAD (they are not; table A).
- Why LibreLane's wire is 29% longer than ours on the same netlist.
- Magic extraction against OpenRCX; setup or hold at other corners (ss, ff). Only tt 25 C 5.00 V was run.
- Large or hard designs. Both designs are tiny (adder2 209 nets, tiny8 1,559 nets), at 50% density and with a relaxed 24 ns clock (setup slack above 9 ns). Congestion, tight timing, and the memory limit of a browser (the build allows 2 GB; we saw 249 MB) are not tested on anything bigger.
- The Studio page in a browser (Properties switch, stage buttons, Chrome, Firefox, Safari) and browser run times. The numbers above come from Node. The build was also run in Chrome on an 8-bit shift register (`web/studio/engines/pnr.browser.html`); that run is not reported here.
- Power. Side-by-side screenshots (none yet). adder2 timing. The clock-tree step run natively on this exact run.

### In the browser (Studio)

Run on 2026-10-20 in Chrome 155 on Windows 11, Studio opened from a local server (`studio.html?mock=1`), example tiny8, clock 24 ns, die 250 x 250 um, density 50%, In-browser place and route = OpenROAD (TritonRoute), "Run All". One run, no repeats. Total 96 s.

| Stage | Result shown in the page | Time |
|---|---|---|
| Placement | 696 instances (with tap cells) | 6.3 s |
| Clock tree | 7 clock buffers, 48 sinks, latency 1.01 ns, skew 0 ns | 20.0 s |
| Routing | TritonRoute violations 42, 3, 3, 0 over 4 iterations; wire 11776 um, 1848 vias | 33.0 s |
| Timing (STA, after routing) | setup worst slack 12.79 ns, hold 0.99 ns, Fmax 89.19 MHz | 4.2 s |
| Magic DRC | 0 error tiles | part of signoff |
| Netgen LVS | match, 3150 devices and 1559 nets on both sides | part of signoff |
| Signoff timing (with Magic wire delays) | setup 11.45 ns, hold 0.92 ns, Fmax 79.65 MHz | 3.9 s |

No browser console errors were seen after the run started (console was only read from that point, so errors during page load were not checked). Switching the select to graywolf + qrouter and running Placement still works (placement passed). Screenshots: `img/pnr-browser-layout-routed.png`, `img/pnr-browser-layout-placed-signoff-log.png`, `img/pnr-browser-timing.png`, `img/pnr-browser-graywolf-fallback.png`.

What this does not show: that these numbers match the native run (see A and B above), or that the result is stable across browsers (only Chrome was tried; Safari and Firefox not).

## Claims under review

These statements are in the repo but we could not back them with evidence in this run. They are still in place. Each has an issue.

- **Resolved:** the Netgen version (compared with native 1.5.318; the WASM build is 1.5.324 + the fix), the native re-runs for Magic, Netgen and OpenSTA (sections above, full OpenSTA report identical), and the grader wording (k-induction first; "proven" only when induction succeeds; else "first 40 cycles").
- **#44:** "Runner round trip verified, shreg4 signoff clean 14/14" (CLAUDE.md). No log is stored and the runner is dormant.

## How to repeat

Run from a folder with `@yowasp/yosys` in `node_modules` for the flow tests:
`node web/studio/engines/cts.selftest.mjs`, `lvs.selftest.mjs`, `opensta.selftest.mjs`, `pd.cases.selftest.mjs`, `pd.selftest.mjs 8`, `selftest.node.mjs`, `node web/grader.test.mjs`, `node docs/validation/ctsdiff.mjs`.

Section 8 (OpenROAD place and route): `node web/studio/engines/pnr-flow.selftest.mjs tiny8` and `... adder2` (set `OUT=<folder>` to keep DEFs, logs and netlists; set `NETLIST=<file>` to start from another flow's netlist). The same tools on every flow: `node docs/validation/def-stats.mjs <final.def> ...` and `node docs/validation/pnr-timing-same-tool.mjs <top> <final.def> <final netlist.v>`. WebAssembly against native: `node docs/validation/pnr-native.mjs <OUT folder> tiny8`, then `bash docs/validation/pnr-native.sh tiny8` (needs the `gf180` container, Git Bash). The LibreLane side is the section 7 run (`web/studio/engines/parity/librelane.mjs`). Native side-by-side (needs the `gf180` container, Git Bash): `bash docs/validation/sta-compare.sh`, `magic-compare.sh`, `netgen-compare.sh`.

The screenshots in `img/term-*.png` are made from the stored logs by `python docs/validation/make-terminal-images.py`. The text in them is not edited.
