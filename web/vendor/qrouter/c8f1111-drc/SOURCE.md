# qrouter, vlog2Cel, addspacers as WebAssembly

- qrouter: https://github.com/RTimothyEdwards/qrouter commit c8f1111 (GPL-2.0, see LICENSE). Non-Tcl `main.c` entry. `stubs/tk.h` + `stubs/compar.h` stand in
  for headers the router does not really need without Tk. Source is unmodified in c8f1111/; c8f1111-drc/ adds the one main.c change described at the end of this file.
- vlog2Cel and addspacers: https://github.com/RTimothyEdwards/qflow commit 52ecda1 (`src/`, GPL-2.0), unmodified.
- Built by `build.sh` (here) with emscripten/emsdk:3.1.74. Sizes: qrouter 188 KB, vlog2Cel 89 KB, addspacers 102 KB.
- Output check: routed DEF of the 8-flop shift register matches the native build apart from trailing spaces.

## c8f1111-drc (2026-10-18): wire-to-via blocking on Metal1-3
Same upstream commit c8f1111, plus one browser-fit change in the non-Tcl `main.c`: call upstream's own `apply_drc_blocks()` (the Tcl build calls it from `read_lef`; the non-Tcl build never does), only for layers 0-2 (Metal1-3), with via_except 0.0 and route_except -0.095, so a wire is kept off the track next to a via where the gf180 via pad would be too close (0.23 um vs 0.28 um needed at 0.56 um pitch). Patch to main.c, before `read_def(NULL);`:

    { int L; for (L = 0; L <= 2; L++) apply_drc_blocks(L, 0.0, -0.095); }

(apply_drc_blocks loops i < Num_layers and skips i != layer, so a layer index above the process's layer count is a no-op, not an out-of-bounds access.)

Built in emscripten/emsdk:3.1.74 with build.sh plus `-DDRC_VIA=0.0 -DDRC_ROUTE=-0.095 -DDRC_LAYERS_LO=0 -DDRC_LAYERS_HI=2`. Only qrouter.js/.wasm differ from c8f1111/.
Measured (browser flow, Magic DRC tiles / LVS): adder2 18 -> 3, mult8 118 -> 39, tiny8 197 -> 66; LVS matches on all three, 0 failed nets. Blocking both via and route on all layers removed more errors but made 23-71 nets fail, so it was rejected.
