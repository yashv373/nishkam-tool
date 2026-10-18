# Magic VLSI, headless WebAssembly build

- Upstream: https://github.com/RTimothyEdwards/magic commit bed8d4f, `npm/build.sh --variant=notcl --release` (emscripten/emsdk:3.1.74), source unmodified.
- Relinked with `TOP_EXTRA_LIBS_WASM="-sEMULATE_FUNCTION_POINTER_CASTS=1 -sSTACK_SIZE=10485760"` (`emmake make mains` in the build dir):
  without the first, `def read` traps with a call_indirect signature mismatch (dbwBBoxFunc); without the second, DRC overflows the 64 KB default stack.
- Size: magic.wasm 2.36 MB, magic.js 87 KB. Uses the gf180mcuD.tech file from web/vendor/gf180mcu/pd-7b70722/ (loaded at run time).
- Check: Re-run 2026-10-18 with `docs/validation/magic-compare.sh` against native Magic 8.3.636 (iic-osic-tools container) on the same routed DEF and PDK files: sr8 (GDS 36 KB) 0 DRC tiles, adder2 3, tiny8 66, same count, same rule texts and same extracted SPICE as native; the GDS has XOR area 0 on all 25 layers. (Older note: 35 tiles on sr8 was before the qrouter DRC fix.)
