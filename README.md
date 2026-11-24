<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/wordmark-dark.svg">
    <img src="assets/wordmark-light.svg" alt="nishkam" width="320">
  </picture>
</p>

# nishkam-tool

Open-source chip-design tools built to run in a web browser (WebAssembly), with our patches, build recipes and tests that compare them with the native builds.

These builds power [Nishkam Studio](https://nishkam.world), where you can take a design from RTL to layout with nothing to install.

## What is here

- `web/vendor/`: the browser builds, patches, build notes (`SOURCE.md`) and licences, one folder per tool and version.
- `web/studio/engines/`: the worker code that loads each tool, and the self-tests.
- `docs/validation/`: the validation report, logs, pictures and comparison scripts.
- `assets/`: the Nishkam wordmark used above.

Not everything the site serves is in this repository. See "Not in this repository" below.

## Tools

Every tool keeps its own licence. The `LICENSE` file in each folder is the one that counts. The full list is in [web/vendor/THIRD_PARTY.md](web/vendor/THIRD_PARTY.md).

| Tool | Upstream version | Licence | What we changed | Build notes |
|---|---|---|---|---|
| OpenROAD (clock tree, TritonCTS) | `61932e8` | BSD-3-Clause; contains OpenSTA, so the binary is GPL-3.0 | `openroad-wasm.patch`, `main_wasm.cc`, `grt_stub.cc`; single thread | [SOURCE.md](web/vendor/openroad-cts/61932e8/SOURCE.md) |
| OpenSTA (timing, power) | `defec0b` (3.1.0) | GPL-3.0 | none to the source; own entry point `main_wasm.cc` | [SOURCE.md](web/vendor/opensta/defec0b/SOURCE.md) |
| Netgen (LVS) | `3cb047b` (1.5.324) | GPL (the folder holds GPL version 1) | one fix, `netcmp-uaf.patch` (a read after free); own entry point | [SOURCE.md](web/vendor/netgen/3cb047b/SOURCE.md) |
| Magic (DRC, extraction, GDS) | `bed8d4f` | Berkeley notice in the folder's `LICENSE` | none to the source; two link flags | [SOURCE.md](web/vendor/magic/bed8d4f/SOURCE.md) |
| graywolf (placement) | `33fbcaa` | GPL-2.0-or-later with Yale conditions | `wasm.patch` | [SOURCE.md](web/vendor/graywolf/33fbcaa/SOURCE.md) |
| qrouter, vlog2Cel, addspacers | qrouter `c8f1111`, qflow `52ecda1` | GPL-2.0 | `c8f1111-drc` adds `drc-blocks.patch` (one change in qrouter `main.c`) | [SOURCE.md](web/vendor/qrouter/c8f1111-drc/SOURCE.md) |
| Icarus Verilog (simulation) | built by the VeriSim project, commit `a275a9a`; Icarus version not recorded | GPL-2.0 | none; used as copied | [SOURCE.md](web/vendor/icarus/SOURCE.md) |
| netlistsvg, elkjs (schematics) | VeriSim commit `a275a9a` | MIT; EPL-2.0 | none; used as copied | [SOURCE.md](web/vendor/netlistsvg/SOURCE.md) |
| gf180mcuD files (cells, tech files) | open_pdks `7b70722` | Apache-2.0 | trimmed copies | [SOURCE.md](web/vendor/gf180mcu/pd-7b70722/SOURCE.md) |

Yosys (`@yowasp/yosys` 0.68.1207) and Verilator (`verilator-wasm` 1.0.0) are not copied here. `npm install` fetches them.

### Not in this repository

The site also serves these. Here you find only the licence and `SOURCE.md` (kwasm, Surfer, Tiny Tapeout Explorer) or nothing (newer OpenROAD builds):

- kwasm 0.3.1 (KLayout, GPL-3.0), Surfer (EUPL-1.2), Tiny Tapeout Explorer `59a43fb` (Apache-2.0).
- The OpenROAD place-and-route builds at `6f3f28c`, which Studio uses by default, are not copied here yet. The release below holds `nishkam-openroad-6f3f28c-wasm-build.tar.gz`.

## Source for the GPL, LGPL and EUPL tools

For each such binary we serve, the source we built from is in the GitHub release [source-2026-10-20](https://github.com/yashv373/nishkam-tool/releases/tag/source-2026-10-20). It holds:

- `nishkam-<tool>-wasm-build.tar.gz`: our patches, entry points, licences and build recipe.
- The unmodified upstream archives for the commits named above.
- `SHA256SUMS.txt`. Check a download with `sha256sum -c SHA256SUMS.txt`.

If a file is missing, open an issue and we will fix it. We hold no build recipe for Icarus, kwasm and Surfer, because we use other people's prebuilt files.

## How to use

You need Node.js 20 or newer. No Docker is needed.

```
git clone https://github.com/yashv373/nishkam-tool
cd nishkam-tool
npm install
npm test
```

`npm test` runs these in order. You can run each alone.

| Command | What it checks | Time |
|---|---|---|
| `node web/studio/engines/selftest.node.mjs` | Yosys, Verilator, Icarus, netlistsvg, OpenSTA name mapping | ~1 min |
| `node web/studio/engines/lvs.selftest.mjs` | place, route, Magic extract, Netgen LVS on an 8-flop shift register; a broken layout must be caught | ~1 min |
| `node web/studio/engines/cts.selftest.mjs` | clock tree on tiny8 | ~30 s |
| `node web/studio/engines/opensta.selftest.mjs` | slack and power on two small designs | ~15 s |
| `node web/studio/engines/pd.selftest.mjs 8` | 8 flops: place, clock tree, route, GDS, DRC, extract | ~1 min |
| `node web/studio/engines/pd.cases.selftest.mjs adder` | one more case (others: `twoclk`, `pins40`, `tiny8`, `mult8`) | ~1 min |
| `node docs/validation/ctsdiff.mjs` | browser clock tree against the native result | seconds |

The times were measured on one Windows 11 machine with Node 26. The comparisons against native tools (`docs/validation/*-compare.sh`) need the `hpretl/iic-osic-tools:chipathon26` Docker image and Git Bash.

## How to rebuild

All our builds use the Docker image `emscripten/emsdk:3.1.74`.

```
docker run --rm -it -v "$PWD/work:/work" emscripten/emsdk:3.1.74 bash
```

Inside it, clone the upstream commit from the table, apply the patch if there is one, and follow the folder's recipe:

| Tool | Recipe |
|---|---|
| graywolf | [`build.sh`](web/vendor/graywolf/33fbcaa/build.sh) after `patch -p1 < wasm.patch` |
| qrouter, vlog2Cel, addspacers | [`build.sh`](web/vendor/qrouter/c8f1111/build.sh); the DRC variant is [`c8f1111-drc`](web/vendor/qrouter/c8f1111-drc/build.sh) |
| Netgen | `git apply netcmp-uaf.patch`, build Tcl 8.6.14, then the flags in its SOURCE.md |
| Magic | `npm/build.sh --variant=notcl --release`, then relink as in its SOURCE.md |
| OpenSTA | cmake steps and link line in its SOURCE.md |
| OpenROAD clock tree | `git apply openroad-wasm.patch`, then its SOURCE.md |

We have not shown that a rebuild gives a byte-identical binary. The validation checks the files we ship.

## What is validated

The full report is [docs/validation/README.md](docs/validation/README.md). For each part it gives the test design, how our browser build and the native tool were each run, the numbers, and what was not checked. The native side is the `hpretl/iic-osic-tools:chipathon26` image (OpenROAD 26Q1-1024-gdcf36133a in LibreLane, OpenSTA 3.1.0, Netgen 1.5.318, Magic 8.3.636, Yosys 0.64, LibreLane 3.0.2). The runs were done on the author's machine. The logs are stored.

| Part | Compared with | Result | Report section |
|---|---|---|---|
| Clock tree, OpenROAD `61932e8` | native OpenROAD, same commit | tiny8: 553 of 553 cells identical | section 1 |
| Netgen LVS | native Netgen 1.5.318 | same verdict and counts on 3 designs | section 2 |
| Magic DRC, extraction, GDS | native Magic 8.3.636 | same DRC count and rules, same SPICE, GDS XOR area 0 | section 5 |
| OpenSTA timing and power | native `sta` 3.1.0 | full report text identical on 2 designs | section 4 |
| Multi-corner STA | native `sta` 3.1.0 | identical text on all 9 corners (tiny8) | section 15 |
| graywolf, qrouter | same sources built natively | placement files identical; routed wires differ in places | section 6 |
| qrouter DRC change | before and after, our own flow | fewer DRC tiles; not a native comparison; not DRC clean | section 3 |
| OpenROAD place and route | native OpenROAD, 1 thread | same netlist, both reach 0 violations; not bit-identical | section 8 |
| Verilator simulation | native Verilator 5.046 | VCD byte-identical on tiny8 | section 17 |
| ngspice 46 (analog) | native ngspice 46 | same printed numbers on 13 decks | sections 18, 18B |
| Gate-level simulation, early | native Icarus + PDK models | all signals identical on 3 designs | section 23 |
| Equivalence check, early | native Yosys 0.64, EQY | same verdicts on 4 cases | section 24 |
| Scan and ATPG, early | native Quaigh, Difetto | faults and coverage match on 6 designs | section 27 |
| sky130A and ihp-sg13g2 flows | native LibreLane 3.0.2, KLayout DRC | small designs only; read the sections | sections 28, 29 |

All section numbers are in [docs/validation/README.md](docs/validation/README.md).

### What is NOT validated

From the report's summary:

- Browsers other than Chrome (Studio) and Edge. Firefox and Safari are not checked.
- More than one clock, except STA and place and route in section 25. Clock tree, simulation and equivalence on multi-clock designs are not checked.
- Designs above about 1,600 nets for DRC, LVS and extraction.
- Extraction against a signoff extractor or silicon. OpenRCX was compared on tiny8 only.
- Digital ss/ff corners outside STA, and analog fs/sf corners.
- Congestion, antenna checks, and IR drop beyond tiny8.
- Python tests in Studio (section 22).
- Anything outside the listed small designs, the corners and the PDKs named. A match here does not show a match elsewhere.

The routing from the older graywolf and qrouter flow is not DRC clean. Read each section's limits before you rely on a number.

## Report a problem

Open an issue at <https://github.com/yashv373/nishkam-tool/issues>. Say which tool, which design, and what you expected.

The files in `docs/validation/` are copied here from the main Nishkam project. Do not edit them in this repository.

## Licences

The code we wrote in this repository is under the [MIT licence](LICENSE). Each tool under `web/vendor/` keeps its own licence (see the table and its folder). We changed the third-party tools only as the table says.

## Credits

This work stands on other people's: the Yosys authors and the [YoWASP](https://yowasp.org) project; the Verilator authors and the verilator-wasm port; Stephen Williams (Icarus Verilog) and the VeriSim port; Neil Turley (netlistsvg) and the KIELER group (elkjs); James Cherry and Parallax Software (OpenSTA); the OpenROAD project; Tim Edwards (Magic, Netgen, qrouter, qflow, graywolf) and the Yale TimberWolf authors; the Surfer team; the KLayout and kwasm authors; Alexander Mordvintsev (Tiny Tapeout Explorer); Google and GlobalFoundries (gf180mcu PDK); the open_pdks and IIC-OSIC-TOOLS maintainers; the LibreLane team; Emscripten.
