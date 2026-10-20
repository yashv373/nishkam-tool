# Nishkam browser flow vs LibreLane: same RTL, same die, same checks

Run on 2026-10-18. Two small designs were taken from RTL to a finished layout twice: once by the Nishkam Studio flow in the browser (nothing installed), once by LibreLane in a container. Then we compared them.

What "same" means here, in plain words:

- The two flows use different placers and routers (graywolf + qrouter in the browser, OpenROAD + TritonRoute in LibreLane). So the two layouts can never be identical, and we do not claim they are.
- What we CAN prove is that both layouts are the same circuit. We did that with a formal equivalence check in Yosys (below). For both designs, the final netlist of each flow is proven equal to the original RTL.
- Everything else (area, wire length, timing, power, clock tree) is compared with numbers, marked match / close / differs, with the reason.

Note: browser numbers re-measured on 2026-10-18 with the current router (DRC fix: wire-to-via blocking on Metal1-3). Before the fix: DRC 11 (adder2) and 247 (tiny8).

## The two designs

| | adder2 | tiny8 |
|---|---|---|
| What it is | 8-bit adder plus XOR, no clock | tiny 8-bit CPU, 48 flip-flops, one clock |
| RTL | `DESIGNS.adder2` in `web/studio/engines/pd.flow.mjs` | `DESIGNS.tiny8` (the `squeeze-tiny8` problem file) |
| Die used by BOTH flows | 77.28 x 74.48 um (5,756 um2) | 135.52 x 133.28 um (18,062 um2) |
| PDK, cells | gf180mcuD, 7-track 5 V cells | same |
| Clock | none | 24 ns, clock port `clk` |
| CTS buffers | not applicable | clkbuf_8 / clkbuf_4 / clkbuf_2 only |

How the die was chosen: LibreLane needs more room than the browser flow (it adds a buffer on every port, repair buffers and tap cells), so the die has to be one LibreLane accepts. We estimated it with `web/studio/fit.js`, then tried real LibreLane runs. Measured:

| Die | LibreLane result |
|---|---|
| tiny8 130 x 130 | fails: DPL-0036 (detailed placement) |
| tiny8 135.52 x 133.28 | passes, core 90% full |
| tiny8 140 x 140 | passes |
| adder2 74.48 x 68.88 | fails: DPL-0036 |
| adder2 72 x 72 | passes, core 93% full |
| adder2 77.28 x 74.48 | passes, core 79% full |

The browser flow sizes its own die from its cell area plus spare room. To hit a chosen die we only changed the amount of spare room (`HEADROOM` setting in `pd.flow.mjs`); nothing else about the flow changes. The browser produced exactly 77.28 x 74.48 and 135.52 x 133.28 um, and those exact numbers were given to LibreLane as `DIE_AREA`. Both flows pass on these dies.

## How the Nishkam browser flow was built and run

All engines are WebAssembly builds, shipped in `web/vendor/` (sources and licences in `web/vendor/THIRD_PARTY.md`). Versions:

| Step | Engine | Version |
|---|---|---|
| Synthesis | Yosys (YoWASP) | `@yowasp/yosys` 0.68.1207 |
| Placement | graywolf | commit 33fbcaa |
| Clock tree | OpenROAD TritonCTS | commit 61932e8 (same commit as the container's OpenROAD, 26Q2-254-g61932e897) |
| Routing | qrouter | commit c8f1111 (with vlog2Cel, addspacers from qflow 52ecda1) |
| Layout, DRC, extraction | Magic | commit bed8d4f |
| LVS | Netgen | commit 3cb047b (v1.5.324, one use-after-free fix) |
| Timing, power | OpenSTA | commit defec0b (3.1.0), tt 025C 5.00 V corner |
| Cells, tech | gf180mcu open_pdks | 7b70722 |

Steps (the same code the page runs, driven from node so it can be scripted): Yosys synthesis, placement with spare room, clock tree (clocked designs only), route, Magic GDS + DRC + extraction, Netgen LVS, OpenSTA on the extracted parasitics (SPEF), propagated clock, input and output delay 4.8 ns.

```
node web/studio/engines/parity/browser.mjs <design> <outdir>     # HEADROOM=0,4400 for adder2, 0,8970 for tiny8
```

## How LibreLane was installed and run

- Container image `hpretl/iic-osic-tools:chipathon26`, running as container `gf180`. LibreLane 3.0.2 (`pip show librelane`), Yosys 0.64, OpenROAD 26Q2-254-g61932e897, PDK gf180mcuD.
- Nothing was installed by hand: LibreLane comes with the image.
- Command (one job at a time), inside `/foss/designs/nishkam_jobs/parity_<design>_<tag>`:

```
librelane config.json --run-tag run
```

- Config (written by `web/studio/engines/parity/librelane.mjs <design> <W> <H> 50 <outdir> <tag>`; everything not listed is the LibreLane default, for example `FP_TAPCELL_DIST` 20, `PL_ROUTABILITY_DRIVEN` true, `GRT_ADJUSTMENT` 0.3):

```json
{ "meta": {"version": 3, "flow": "Classic"}, "PDK": "gf180mcuD",
  "FP_SIZING": "absolute", "DIE_AREA": [0, 0, 135.52, 133.28],
  "CLOCK_PERIOD": 24, "CLOCK_PORT": "clk",
  "CTS_CLK_BUFFERS": ["gf180mcu_fd_sc_mcu7t5v0__clkbuf_8", "gf180mcu_fd_sc_mcu7t5v0__clkbuf_4", "gf180mcu_fd_sc_mcu7t5v0__clkbuf_2"],
  "CTS_ROOT_BUFFER": "gf180mcu_fd_sc_mcu7t5v0__clkbuf_8",
  "PL_TARGET_DENSITY_PCT": 50, "DESIGN_NAME": "tiny8", "VERILOG_FILES": ["dir::tiny8.v"] }
```

For adder2 `DIE_AREA` is `[0, 0, 77.28, 74.48]` and `CLOCK_PORT` is null. Timing numbers are taken from LibreLane's own `final/metrics.json` at corner `nom_tt_025C_5v00`, the same corner as the browser.

## 1. Functional equivalence (the proof)

Tool: Yosys 0.64 in the container. The gf180 cells are read from the PDK's own liberty file (`gf180mcu_fd_sc_mcu7t5v0__tt_025C_5v00.lib`), so every gate has its real logic function. Script: `web/studio/engines/parity/equiv.sh`, driver `eqall.mjs`. Both ends are flattened, async resets are converted with `async2sync`.

Proof A, `equiv_make / equiv_simple / equiv_induct / equiv_status -assert`: every state bit and every output of one side is paired with the other by name, and Yosys proves by induction that next-state and output logic agree whenever the states agree. For tiny8 this covers all 48 flip-flops and all outputs (48 of 48 points proven). Because both sides start from the same reset values, this is an unbounded proof.

Proof B (adder2 only), `miter` + `sat -tempinduct -prove-asserts`: a miter circuit that is 1 if outputs ever differ; Yosys proves it can never be 1. Proof C, `sat -seq N` from the zero state: bounded check (20 cycles for adder2).

Negative control: one gate (an AND/OR/NAND/NOR) in the LibreLane final netlist was swapped for its dual. All proofs then FAIL, so a pass is not empty.

Exact commands (inside the container, folder `/foss/designs/nishkam_jobs/parity_eq`):

```
bash equiv.sh <A.v> <B.v> <top> <label>
# which runs these yosys scripts (HEAD = read_liberty -ignore_miss_func -ignore_miss_dir -ignore_miss_data_latch -ignore_buses <lib>;
#   read_verilog -sv A; rename top gold; read_verilog -sv B; rename top gate; proc; flatten; async2sync; opt_clean)
#   A: HEAD; splitnets; rename -hide w:_*; opt_clean -purge; equiv_make gold gate eq; hierarchy -top eq;
#      equiv_simple -seq 5; equiv_induct -seq 5; equiv_status -assert
#   B: HEAD; miter -equiv -flatten -make_assert -ignore_gold_x gold gate m; hierarchy -top m;
#      sat -verify -prove-asserts -tempinduct -set-init-zero -maxsteps 8
#   C: same miter; sat -verify -prove-asserts -set-init-zero -seq 20
```

(`rename -hide w:_*` hides the anonymous `_123_` wires: without it Yosys pairs same-named but unrelated wires of the two netlists and wrongly reports "not equal". `splitnets` makes RTL vectors like `r0[7:0]` match the bit names in the netlists.)

Results (PROVEN = Yosys proved it; the full logs are in `parity_eq/` next to the jobs):

| Design | Check | Proof A (induction, unbounded) | Proof B (miter, unbounded) | Proof C (bounded from zero state) |
|---|---|---|---|---|
| adder2 | Browser synthesis netlist = LibreLane synthesis netlist | **PROVEN** | PROVEN | PROVEN |
| adder2 | RTL = LibreLane final netlist (the one LVS checks) | **PROVEN** | PROVEN | PROVEN |
| adder2 | RTL = Nishkam final netlist (the one LVS checks) | **PROVEN** | PROVEN | PROVEN |
| adder2 | RTL = LibreLane synthesis netlist | **PROVEN** | PROVEN | PROVEN |
| adder2 | Negative control: RTL vs LibreLane netlist with one gate swapped (must FAIL) | **FAILS as it should** | fails | fails (counterexample) |
| tiny8 | Browser synthesis netlist = LibreLane synthesis netlist | **PROVEN** | not run | did not finish in 600 s |
| tiny8 | RTL = LibreLane final netlist (the one LVS checks) | **PROVEN** | not run | did not finish in 600 s |
| tiny8 | RTL = Nishkam final netlist (the one LVS checks) | **PROVEN** | not run | did not finish in 600 s |
| tiny8 | RTL = LibreLane synthesis netlist | **PROVEN** | not run | did not finish in 600 s |
| tiny8 | Negative control: RTL vs LibreLane netlist with one gate swapped (must FAIL) | **FAILS as it should** | not run | fails (counterexample) |

Tiny8 proof B was not run (without matched state points the induction does not close quickly) and proof C (6 cycles) did not finish within 600 s on the container; those are not failures, the solver simply did not return. Proof A is the one that carries the claim for tiny8.

Because LVS also passes in both flows (below), the chain is: RTL = final netlist (proof) = drawn layout (LVS) for each flow.

## 2. Signoff on each side

Same die, same corner (tt, 25 C, 5.00 V).

| | adder2 Nishkam | adder2 LibreLane | tiny8 Nishkam | tiny8 LibreLane |
|---|---|---|---|---|
| LVS | match (256/256 devices, 146/146 nets) | 0 errors | match (3098/3098 devices, 1536/1536 nets) | 0 errors |
| DRC | 2 errors (see below) | 0 (TritonRoute 0, Magic 0) | 88 errors (see below) | 0 (TritonRoute 0, Magic 0) |
| Setup WNS / TNS (ns) | no clock | no clock (virtual clock reports 10.4 / 0) | 12.90 / 0 | 9.62 / 0 |
| Hold WNS / TNS (ns) | no clock | 10.5 / 0 | 0.956 / 0 | 0.665 / 0 |
| Power (uW) | not measured (no clock) | 488 | 4,120 | 6,972 |
| Run time | 10 s | 99 s | 56 s | 156 s |

The DRC gap remains (after the router fix it dropped from 11 to 2 and from 247 to 88): qrouter output still has Metal1/2/3 minimum-spacing errors (rules M1.2a, M2.2a, M3.2a), none inside library cells. LibreLane's router is clean. We do NOT claim the browser layout is DRC clean.

## 3. Physical comparison

Meaning of the marks: match = within 2%; close = same behaviour, within 35%; differs = more than 35% apart, or a different outcome. The reason is always given.

| tiny8 | Nishkam | LibreLane | Mark | Reason |
|---|---|---|---|---|
| Std cells | 263 | 488 | differs (+86%) | LibreLane adds port buffers, 56 repair buffers, 84 tap cells and 9 clock buffers |
| Cell area (um2) | 8,610 | 11,211 | close (+30%) | same extra cells; the logic itself is the same synthesis result (proven equal) |
| Area / die | 47.7% | 62.1% (core 90.1%) | differs | different reference area; LibreLane counts the core only |
| Wire length (um) | 13,644 | 15,669 | close (+15%) | different router, extra buffers |
| Vias | 3,088 | 2,546 | close (-18%) | |
| CTS buffers | 5 | 9 | differs | same CTS engine commit, but the flow around it differs (LibreLane counts its 9 clock-class cells; cause not investigated further) |
| Clock skew (ns) | 0.01 | 0.27 | differs | likely because ours is measured by our OpenSTA run on extracted wires of a different placement and LibreLane's is its own post-route number; not investigated further |
| Setup WNS (ns) | 13.00 | 9.62 | close | both meet; LibreLane includes its added buffers and a different parasitic model |
| Hold WNS (ns) | 0.956 | 0.665 | close | both meet |
| Power (uW) | 4,120 | 6,972 | differs (+69%) | extra cells and different switching-activity assumptions; power is not a validated number |

| adder2 | Nishkam | LibreLane | Mark | Reason |
|---|---|---|---|---|
| Std cells | 43 | 119 | differs | 33 port buffers and 19 tap cells are added by LibreLane; the 43 logic cells match the netlist |
| Cell area (um2) | 812 | 2,164 | differs | same reason |
| Wire length (um) | 1,117 | 1,903 | differs (+70%) | tiny design, buffers dominate |
| Vias | 367 | 395 | close (+8%) | |

Layouts, same die, same renderer (KLayout, LibreLane's own render script). Left Nishkam, right LibreLane:

![tiny8](img/tiny8-side-by-side.png)

![adder2](img/adder2-side-by-side.png)

The Nishkam layout leaves unused rows as filler; LibreLane spreads cells over the core and adds power straps, taps and port buffers.

## 4. Stress tests (browser flow)

Runs in this folder: `web/studio/engines/parity/stress.mjs` (node, one process per case). Time is wall clock on the owner's PC.

| Case | Die (um) | Result | Time | Notes |
|---|---|---|---|---|
| tiny8 x5 (determinism, parity die) | 135.5x133.3 | PASS: 5 of 5 runs give identical placement and route hashes (9917d48d / eaa536a0) | 68 to 76 s each | all LVS match |
| tiny8-tinydie-nohead | - | FAIL: clock tree stage stops (no spare room for clock buffers) | 41 s | expected limit |
| tiny8-studio-default | 103.6x101.9 (81.5% full) | PASS: failed nets 0, LVS match, DRC 197 | 68 s | route hash f82a3cb3 |
| adder2-tinydie | 34.2x31.4 (75.8% full) | FAIL: failed nets 1, LVS MISMATCH, DRC 9 | 10 s | route hash 071be0c3 |
| rmult20 | 243.6x243.0 (88.1% full) | FAIL: failed nets 0, LVS MISMATCH, DRC 1272 | 1254 s | run alongside other jobs, an earlier unloaded run took 443 s; route hash b11a5023 |

`adder2-tinydie` is the smallest die the flow can make for the adder (no spare room): one net fails to route and LVS reports a mismatch, so Studio users who shrink the die this far get a visible failure. `rmult20`: LVS MISMATCH with equal device and net counts is a known open issue.

## Not validated

- Layout equality: not claimed and not possible (different placers and routers).
- Browser DRC: 11 to 1,272 errors on every design; the browser flow is not DRC clean.
- Power numbers: they differ by up to 70% and the activity assumptions are not aligned.
- Timing with different constraints: input/output delay and load were not aligned beyond the clock; only one corner.
- Only two small designs, one of them without a clock. rmult20 (2,595 cells) was run in the browser only; LVS reports MISMATCH there (device and net counts equal), not investigated here.
- LibreLane with its default settings beyond the config above; timing-driven placement is off in both.
- The formal proof covers logic function from the same reset state. It does not cover timing, clock-domain or physical correctness, and it trusts Yosys and the liberty function of each cell.
- Safari, other PDKs.
