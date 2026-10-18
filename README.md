# nishkam-tool

Open-source chip-design tools compiled to WebAssembly, as used by [nishkam.world](https://nishkam.world) (free chip-design practice in the browser, RTL to layout).

This repository does two things:

1. **Source for the GPL, LGPL and EUPL binaries.** For every such binary served by nishkam.world, the complete corresponding source (pinned upstream source, our patches, build scripts) is published as assets of the GitHub Release [source-2026-10-20](https://github.com/yashv373/nishkam-tool/releases/tag/source-2026-10-20), free to download, with `SHA256SUMS.txt`. Each `nishkam-<tool>-wasm-build.tar.gz` holds our patches, entry points, licences and the build recipe for that tool; the upstream sources are the unmodified archives next to it.

### Corresponding source

All builds use `emscripten/emsdk:3.1.74` unless the folder says otherwise. "Build" points to the recipe in the folder.

| Binary | Licence of the binary | Upstream commit | Our changes | Build | Statically linked libraries |
|---|---|---|---|---|---|
| `openroad.wasm` | GPL-3.0 (combined work) | OpenROAD `61932e8` | `openroad-wasm.patch`, `main_wasm.cc`, `grt_stub.cc` | `openroad-cts/61932e8/SOURCE.md` | OpenSTA `defec0b` (GPL-3.0), abseil 20240722.0, spdlog 1.14.1 (bundled fmt), LEMON `31d79d6`, Boost 1.83 headers and iostreams, zlib (emscripten port), CUDD `d47718f`, Tcl 8.6.14 |
| `sta.wasm` | GPL-3.0 | OpenSTA `defec0b` | none to the source; `main_wasm.cc` replaces the application entry point | `opensta/defec0b/SOURCE.md` | CUDD `d47718f`, Tcl 8.6.14, zlib (emscripten port) |
| `netgen.wasm` | GPL-2.0 | Netgen `3cb047b` | `netcmp-uaf.patch`, own `main.c` (in SOURCE.md) | `netgen/3cb047b/SOURCE.md` | Tcl 8.6.14 (core-8-6-14) |
| `magic.wasm` | GPL-2.0 | Magic `bed8d4f` | none to the source; two link flags | `magic/bed8d4f/SOURCE.md` | no Tcl (variant `notcl`); others as built by upstream `npm/build.sh`, not listed separately |
| graywolf (5 modules) | GPL-2.0-or-later with Yale conditions | graywolf `33fbcaa` | `wasm.patch` | `graywolf/33fbcaa/build.sh` | none beyond libc |
| qrouter, vlog2Cel, addspacers | GPL-2.0 | qrouter `c8f1111`, qflow `52ecda1` | `drc-blocks.patch` (`-drc` build only), `stubs/` | `qrouter/*/build.sh` | none beyond libc |
| Icarus (ivlpp, ivl, vvp) | GPL-2.0 | prebuilt by verisim `a275a9a`; iverilog version not recorded | none known | not in this repo | not recorded |
| kwasm | GPL-3.0 | wheel kwasm 0.3.1 (hash in its SOURCE.md) | none | not in this repo | not recorded |
| Surfer | EUPL-1.2 | main `1cdbaa9` | one `sed` line, in SOURCE.md | not in this repo | not recorded |

**Known gaps.** We do not hold the build recipe for the Icarus, kwasm and Surfer binaries, because we use other people's prebuilt files; the archives above hold the repositories they come from. The recipes for the other rows have not been re-run from scratch for this release.

### Source archives (release `source-2026-10-20`)

Check a download with `sha256sum -c SHA256SUMS.txt`. Upstream archives are unmodified GitHub/GitLab downloads of the commit named.

| Binary | Our build files | Upstream source |
|---|---|---|
| `openroad.wasm` (place and route, and the CTS-only build) | `nishkam-openroad-wasm-build.tar.gz` (`pnr/`: patch, `BUILD.md`, scripts; `cts/`: the earlier CTS-only patch) | `OpenROAD-61932e8.tar.gz`, `OpenSTA-defec0b.tar.gz`; static libraries: `abseil-cpp-20240722.0`, `spdlog-v1.14.1`, `lemon-graph-31d79d6`, `cudd-d47718f`, `tcl-core-8-6-14`, `boost-iostreams-1.83.0`, `boost-serialization-1.83.0` (Boost headers 1.83 come from the emscripten port) |
| `sta.wasm` | `nishkam-opensta-wasm-build.tar.gz` | `OpenSTA-defec0b.tar.gz`, `cudd-d47718f`, `tcl-core-8-6-14` |
| `netgen.wasm` | `nishkam-netgen-wasm-build.tar.gz` | `netgen-3cb047b.tar.gz`, `tcl-core-8-6-14` |
| `magic.wasm` | `nishkam-magic-wasm-build.tar.gz` | `magic-bed8d4f.tar.gz` |
| graywolf | `nishkam-graywolf-wasm-build.tar.gz` | `graywolf-33fbcaa.tar.gz` |
| qrouter, vlog2Cel, addspacers | `nishkam-qrouter-wasm-build.tar.gz` | `qrouter-c8f1111.tar.gz`, `qflow-52ecda1.tar.gz` |
| Icarus (prebuilt by others) | `nishkam-icarus-wasm-build.tar.gz` | `verisim-a275a9a.tar.gz` (the repository we copied the files from; it holds the built files, and the iverilog version is not recorded) |
| kwasm (prebuilt by others) | `nishkam-kwasm-wasm-build.tar.gz` | `kwasm-0.3.1-py3-none-any.whl` (the PyPI wheel; no source distribution exists) |
| Surfer (prebuilt by others) | `nishkam-surfer-wasm-build.tar.gz` | `surfer-1cdbaa9.tar.gz` (repository at the commit named in its notes) |


## Run it

Needs Node.js 20 or newer (tested on Node 26 on Windows 11). No Docker is needed for these.

```
git clone https://github.com/yashv373/nishkam-tool
cd nishkam-tool
npm install
npm test
```

`npm install` fetches `@yowasp/yosys` and `verilator-wasm`; every other tool is already in `web/vendor/`. `npm test` runs the commands in this table in order. Each can also be run alone.

| Command | What it checks | Time |
|---|---|---|
| `node web/studio/engines/selftest.node.mjs` | Yosys, Verilator, Icarus, netlistsvg, OpenSTA name mapping | ~1 min |
| `node web/studio/engines/lvs.selftest.mjs` | place, route, Magic extract, Netgen LVS on an 8-flop shift register; a broken layout must be caught | ~1 min |
| `node web/studio/engines/cts.selftest.mjs` | OpenROAD clock tree on tiny8 | ~30 s |
| `node web/studio/engines/opensta.selftest.mjs` | OpenSTA slack and power on two small designs | ~15 s |
| `node web/studio/engines/pd.selftest.mjs 8` | full flow on 8 flops (place, CTS, route, GDS, DRC, extract) | ~1 min |
| `node web/studio/engines/pd.cases.selftest.mjs adder` | flow on one case (others: `twoclk`, `pins40`, `tiny8`, `mult8`) | ~1 min |
| `node docs/validation/ctsdiff.mjs` | browser against native clock-tree DEF | seconds |

More commands that need no Docker: `node docs/validation/drc-count.mjs adder2`, `node docs/validation/lvs-dump.mjs adder2 <folder>`, `node docs/validation/sta-compare.mjs <folder>`, `node web/studio/engines/parity/browser.mjs adder2`. The side-by-side runs against native tools (`docs/validation/*-compare.sh`) need the `hpretl/iic-osic-tools:chipathon26` container and Git Bash; see the [report](docs/validation/README.md).

### Results of a fresh run

From a fresh copy of this tree after `npm install`, Node v26.7.0, Windows 11. Every command exited 0.

```
selftest.node        16 PASS lines, 0 FAIL; last: PASS names: STA instances are netlist.json cells, tiny8
lvs.selftest         LVS layout vs netlist: match=true devices=224,224 nets=109,109 ... Circuits match uniquely.
                     PASS broken layout caught devices 216,224 vs 224,224
cts.selftest         cts selftest ok
opensta.selftest     PASS shreg4 {"setup_ws_ns":6.7093,...,"total_uW":279,...}
                     PASS cnt8   {"setup_ws_ns":6.0215,...,"total_uW":1710,...}
pd.selftest 8        PASS cts 3 clock buffers, 8 sinks, latency 0.44 ns
                     PASS route failed nets 0
                     PASS drc ran 0 error tiles
pd.cases adder       PASS adder ... failed nets 0 ... lvs true devices 256,256 nets 146,146
ctsdiff              components native 553 browser 553; identical cell+position+orient 553; different 0; only in one 0; clkbuf native 9 browser 9
drc-count adder2     adder2: failed nets 0, DRC error tiles 3, LVS match true
lvs-dump adder2      browser netgen adder2: match true devices 256,256 nets 146,146
```

## Validation against native tools

[docs/validation/README.md](docs/validation/README.md) is the full report: test designs, how each side was run, numbers, logs, and what was not checked. Native side: `hpretl/iic-osic-tools:chipathon26` (OpenROAD 26Q2, OpenSTA 3.1.0, Netgen 1.5.318, Magic 8.3.636, Yosys 0.64, LibreLane 3.0.2). The native runs were done on the author's machine; the logs are stored, and the Docker-based scripts let you repeat them.

| Part | Result | Evidence |
|---|---|---|
| Clock tree (TritonCTS), tiny8 | 553 of 553 output-DEF components identical (cell, position, orientation); same buffer count, latency and skew. Only the COMPONENTS section was compared, not the NETS connectivity | [ctsdiff.txt](docs/validation/logs/ctsdiff.txt), [cts.txt](docs/validation/logs/cts.txt) |
| Netgen LVS | Same device and net counts and the same verdict as native Netgen 1.5.318 on adder2, mult8, tiny8 (browser build is 1.5.324 plus a fix; native 1.5.324 not compared) | [lvs.txt](docs/validation/logs/lvs.txt), `netgen-native-*.log` |
| Magic | Same DRC tile count and rule texts, same extracted SPICE (substrate node name `$SUB` aside), GDS XOR area 0 on sr8, adder2, tiny8 | `magic-*.txt` in [logs](docs/validation/logs) |
| OpenSTA | Complete reports identical to native `sta` 3.1.0 (licence banner aside; native `sta` was re-run for this) on two small pre-route netlists, one liberty corner, no SPEF. Post-route timing was not compared | `sta-*.txt` in [logs](docs/validation/logs) |
| graywolf, qrouter (adder2) | Native side rebuilt from the same commits with the same one-line qrouter change (the `c8f1111-drc` build). Placement files and router inputs byte-identical to native builds; the routed DEF differs in some wire choices (both route fully, same DRC and LVS result; the cause of the difference is unknown) | [qflow-native.md](docs/validation/qflow-native.md) |
| qrouter change (`c8f1111-drc`) | Reduces Magic DRC tiles: adder2 18 to 3, mult8 118 to 39, tiny8 197 to 66, with LVS still matching and 0 failed nets. A before/after on our own flow, not a comparison with a native tool; the routing is not yet DRC clean | [drc.txt](docs/validation/logs/drc.txt) |

The adder2 GDS XOR of 0 compares native Magic and browser Magic on the same routed DEF, not two end-to-end flows (the routers choose some wires differently). Layouts here have no well-tap cells; LVS assumes wells are tied to power. The routing is not DRC clean. Browser Magic and Yosys are not the same versions as the container's Magic 8.3.636 and Yosys 0.64. These results cover the listed small designs, one PDK and one liberty corner. They do not show equivalence on other inputs. Read the limits in the report before relying on a number.

Clock tree on tiny8, native OpenROAD (left) against the browser build (right):

<table><tr>
<td><img src="docs/validation/img/cts-native.png" width="100%" alt="Native OpenROAD clock tree"><br><sub>Native OpenROAD</sub></td>
<td><img src="docs/validation/img/cts-browser.png" width="100%" alt="Browser TritonCTS clock tree"><br><sub>Browser TritonCTS</sub></td>
</tr></table>

## Rebuild a WebAssembly tool

All our own builds use the Emscripten Docker image `emscripten/emsdk:3.1.74`. Mount a work folder, clone the upstream commit from the table, apply the patch if there is one, then build:

```
docker run --rm -it -v "$PWD/work:/work" emscripten/emsdk:3.1.74 bash
```

| Tool | How |
|---|---|
| graywolf | clone at `33fbcaa`, `patch -p1 < wasm.patch`, run [`build.sh`](web/vendor/graywolf/33fbcaa/build.sh) |
| qrouter, vlog2Cel, addspacers | clone qrouter `c8f1111` into `/work/qrouter` and qflow `52ecda1` into `/work/qflow`, put [`stubs/`](web/vendor/qrouter/c8f1111/stubs) in `/work/stubs`, run [`build.sh`](web/vendor/qrouter/c8f1111/build.sh). For the DRC variant first run `git apply drc-blocks.patch` in the qrouter clone ([build.sh](web/vendor/qrouter/c8f1111-drc/build.sh)) |
| Netgen | clone at `3cb047b`, `git apply netcmp-uaf.patch`, build Tcl 8.6.14, compile and link with the flags in [SOURCE.md](web/vendor/netgen/3cb047b/SOURCE.md) |
| Magic | `npm/build.sh --variant=notcl --release`, then relink with the flags in [SOURCE.md](web/vendor/magic/bed8d4f/SOURCE.md) |
| OpenSTA | cmake steps and link line in [SOURCE.md](web/vendor/opensta/defec0b/SOURCE.md); entry point [`main_wasm.cc`](web/vendor/opensta/defec0b/main_wasm.cc) |
| OpenROAD CTS | `git apply openroad-wasm.patch` on commit `61932e8`, dependency builds and link line in [SOURCE.md](web/vendor/openroad-cts/61932e8/SOURCE.md); [`main_wasm.cc`](web/vendor/openroad-cts/61932e8/main_wasm.cc) and [`grt_stub.cc`](web/vendor/openroad-cts/61932e8/grt_stub.cc) |
| Icarus, netlistsvg, Surfer, kwasm, Tiny Tapeout Explorer | prebuilt upstream files, used as they are apart from the edits in their SOURCE.md |

The validation tests the shipped binaries. It does not show that a rebuild from these recipes gives a byte-identical binary.

## What is in this repository

- `web/vendor/`: the browser builds, patches, recipes and licences (table above), plus the gf180mcuD files the tests read.
- `web/studio/engines/`: the worker code that loads each tool, the test flow (`pd.flow.mjs`) and the self-tests. `fixtures/tiny8.v` is a small 8-bit CPU (48 flops) used as a test design. `web/studio/demo/` holds the tiny8 placed DEF and the native OpenROAD CTS DEF used by the clock-tree comparison. `web/studio/stages.js` and `web/studio/viewers/sta-parser.js` are used by `selftest.node.mjs`.
- `docs/validation/`: the report, logs, pictures and comparison scripts.

## Credits

Everything here stands on other people's work. Thank you to: Claire Xenia Wolf and the Yosys authors; the [YoWASP](https://yowasp.org) project; the Verilator authors and the verilator-wasm port; Stephen Williams (Icarus Verilog) and the VeriSim WebAssembly port; Neil Turley (netlistsvg) and the KIELER group (elkjs); James Cherry and Parallax Software (OpenSTA); the OpenROAD project; Tim Edwards (Magic, Netgen, qrouter, qflow, graywolf) and the Yale TimberWolf authors, Carl Sechen and Bill Swartz; the Surfer team; Matthias Koefferlein (KLayout) and the kwasm author; Alexander Mordvintsev (Tiny Tapeout Explorer); Google and GlobalFoundries (gf180mcu PDK) and the open_pdks and IIC-OSIC-TOOLS maintainers; the LibreLane team; Emscripten.
