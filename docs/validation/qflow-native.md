# Browser placement and routing vs. native upstream tools (adder2)

Issue #29. Question: are the WebAssembly builds of graywolf, qflow's helpers and qrouter in Studio the same as the same sources built natively?

## Setup
- Design: `adder2` from `DESIGNS` in `web/studio/engines/pd.flow.mjs` (8-bit adder plus XOR, 43 cells, gf180mcuD 7-track 5 V).
- The browser flow was run under Node (`web/studio/engines/parity/browser.mjs adder2`). Every tool call was recorded: arguments, input files, output files.
- Each native tool got the same arguments and input files, except that the graywolf chain was run natively end to end from the native vlog2Cel output (not from recorded intermediates), so it checks the whole placement chain.

## How ours was built
- graywolf commit 33fbcaa (`web/vendor/graywolf/33fbcaa/`): Emscripten 3.1.74, `build.sh`, with `wasm.patch`.
- qrouter commit c8f1111 plus the one-line `apply_drc_blocks` change in `main.c` (`web/vendor/qrouter/c8f1111-drc/SOURCE.md`).
- vlog2Cel and addspacers: qflow commit 52ecda1 (`web/vendor/qrouter/c8f1111/`), unmodified.

## How native was built
- Image `hpretl/iic-osic-tools:chipathon26` run as a new throwaway container (`docker run --rm`, `--skip bash`), gcc and cmake from the image. The owner's `gf180` container was not touched.
- Sources cloned from GitHub at the same commits (qrouter c8f1111, qflow 52ecda1, graywolf 33fbcaa).
- qrouter: same file list, flags and stubs as our `build.sh`, with `gcc -O2`, plus the same one-line main.c patch: `{ int L; for (L = 0; L <= 2; L++) apply_drc_blocks(L, 0.0, -0.095); }` before `read_def(NULL);`.
- vlog2Cel, addspacers: gcc with the same flags as `build.sh`.
- graywolf: upstream CMake, with `wasm.patch` applied (it fixes old K&R code for modern compilers; the WASM-only `system()` part is skipped on gcc), `-Dcfree=free`, `-Wl,--allow-multiple-definition`, `make -j1`.

## Results (sha256 of whole file; "same" means byte-for-byte)
| Step | File | Result |
|---|---|---|
| qrouter -i | add.info | same (fa347f53...) |
| vlog2Cel | add.cel | same (e9ea1f3e...) |
| syntax, Mincut, TimberWolfMC, TimberWolfSC (graywolf, native chain) | add.pl1 | same (6bf7122a...) |
| | add.pl2 | same (f8d55ad3...) |
| | add.pin | same (7802b52e...) |
| addspacers | add_filled.def | same (51fc4a6b...) |
| addspacers | add.obsx | same (both empty) |
| qrouter (route) | add_route.def | **differs** (native db6a445a..., browser 09089fc2...) |

Routed DEF: both runs report "No failed routes". 223 diff lines, all inside the routed wires of some nets (the header, components and pins are identical). Native: 438 wire segments and 417 vias; browser: 443 and 425. So the router makes different but equally complete choices for some nets.

Probable reason (not proven): qrouter's route order or tie-breaking differs between a 32-bit WebAssembly build and a 64-bit x86 build (pointer-sized values, qsort tie order, floating-point rounding). The input, the commit and the patch are the same. Not tested: a 32-bit native build, which would show whether word size is the cause.

## Not validated
- Only adder2. No clocked design (so Clock Tree and its repair step were not run), no larger design.
- The routed DEF is not byte-identical; no check that the native and browser routes are equally good (DRC, LVS, wirelength) beyond the counts above.
- Intermediates of graywolf were not compared one by one (only the final .pl1/.pl2/.pin).
- Other browser steps (Magic, Netgen, OpenSTA, CTS) are outside this check.

## Follow-up: why the routes differ, and are both good
- 32-bit native build (`gcc -m32`): not possible in the image (no 32-bit libc headers). Not tested.
- Native build with `-ffp-contract=off` (no fused multiply-add): output identical to the normal native build (db6a445a...), so FMA is not the cause. Still differs from the browser.
- Magic DRC + Netgen LVS (our Node workers) on both routed DEFs, same input otherwise: browser 3 DRC errors, LVS match; native 3 DRC errors, LVS match. Both routes are equally good on these checks.
- Cause of the route difference stays unknown (word size is the remaining guess).
