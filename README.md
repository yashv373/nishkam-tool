# nishkam-tool

[![License: MIT](https://img.shields.io/badge/our%20code-MIT-blue.svg)](LICENSE)

Open-source chip-design tools, compiled to WebAssembly so they run in a web browser with nothing to install.
This is the tool layer behind [nishkam.world](https://nishkam.world): Yosys, Verilator, Icarus Verilog, OpenSTA,
OpenROAD's clock tree synthesis, graywolf, qrouter, Magic and Netgen. For each tool you get the exact upstream
version, our small patches, the build steps, the browser wrapper code, and tests that compare the browser result with the normal native tool.

Test designs here only check that the tools work. They do not show that a design is good.

## The tools

All run in the browser (Web Workers). The PDK is gf180mcuD.

| Tool | Upstream | Pinned version | Licence | Our patch | Size |
|---|---|---|---|---|---|
| Yosys (synthesis, lint, formal) | [YoWASP](https://github.com/YoWASP/yosys) | npm `@yowasp/yosys@0.68.1207` | ISC / Apache-2.0 | no | npm |
| Verilator (lint) | [verilator-wasm](https://www.npmjs.com/package/verilator-wasm) | npm 1.0.0 | MIT (Verilator: LGPL-3.0 or Artistic-2.0) | no | npm |
| Icarus Verilog (simulation) | [iverilog](https://github.com/steveicarus/iverilog), built by [verisim](https://github.com/senolgulgonul/verisim) | `a275a9a` | GPL-2.0 | no | 2.9 MB |
| netlistsvg + elkjs (schematic) | [netlistsvg](https://github.com/nturley/netlistsvg), [elkjs](https://github.com/kieler/elkjs) | `a275a9a` | MIT, EPL-2.0 | no | 2.5 MB |
| OpenSTA (timing, power) | [parallaxsw/OpenSTA](https://github.com/parallaxsw/OpenSTA) | `defec0b` (3.1.0) | GPL-3.0 | no | 5.7 MB |
| OpenROAD TritonCTS (clock tree) | [The-OpenROAD-Project/OpenROAD](https://github.com/The-OpenROAD-Project/OpenROAD) | `61932e8` | BSD-3-Clause (OpenSTA inside: GPL-3.0) | yes, 13 build changes listed in its SOURCE.md | 36 MB |
| graywolf (placement) | [RTimothyEdwards/graywolf](https://github.com/RTimothyEdwards/graywolf) | `33fbcaa` | GPL-2.0-or-later with Yale conditions | yes, [`wasm.patch`](web/vendor/graywolf/33fbcaa/wasm.patch) | 2.2 MB |
| qrouter, vlog2Cel, addspacers (routing) | [qrouter](https://github.com/RTimothyEdwards/qrouter), [qflow](https://github.com/RTimothyEdwards/qflow) | `c8f1111`, `52ecda1` | GPL-2.0 | `c8f1111`: no. `c8f1111-drc`: yes, [`drc-blocks.patch`](web/vendor/qrouter/c8f1111-drc/drc-blocks.patch) | 0.6 MB each |
| Magic (GDS, DRC, extraction) | [RTimothyEdwards/magic](https://github.com/RTimothyEdwards/magic) | `bed8d4f` | GPL-2.0 | no (relinked with two flags) | 2.4 MB |
| Netgen (LVS) with Tcl 8.6.14 | [RTimothyEdwards/netgen](https://github.com/RTimothyEdwards/netgen) | `3cb047b` (1.5.324) | GPL-2.0 (Tcl: BSD-style) | yes, [`netcmp-uaf.patch`](web/vendor/netgen/3cb047b/netcmp-uaf.patch) (fixed upstream in 1.5.325) | 2.1 MB |
| Surfer (waveforms) | [surfer-project/surfer](https://gitlab.com/surfer-project/surfer) | build of 2026-10-09 | EUPL-1.2 | one line (service worker off) | 15 MB |
| KLayout as kwasm (GDS viewer) | [kwasm](https://pypi.org/project/kwasm/) | 0.3.1 | GPL-3.0 | no | 3.9 MB |
| Tiny Tapeout Explorer (3D GDS) | [znah/tiny_explorer](https://github.com/znah/tiny_explorer) | `59a43fb` | Apache-2.0 | small edits, see its SOURCE.md | 0.7 MB |
| gf180mcu cells, liberty, tech files | [google/gf180mcu-pdk](https://github.com/google/gf180mcu-pdk) | open_pdks `7b70722` | Apache-2.0 | trimmed, not changed | 4.6 MB |

Each folder under [`web/vendor/`](web/vendor) has a `SOURCE.md` (upstream commit, patches, build command, sizes) and its licence file. [`web/vendor/THIRD_PARTY.md`](web/vendor/THIRD_PARTY.md) explains how each copyleft piece is used.
Total size is about 78 MB; the largest file is `openroad.wasm` (36.8 MB).

## Licence

Our own code (the wrappers, tests, runner, glue, scripts and docs) is MIT, see [LICENSE](LICENSE).
**The tools in `web/vendor/` keep their own licences**, listed above and in each folder. Where a licence is GPL, the binary is distributed under those terms.

**Source offer (GPL).** For every GPL, LGPL or EUPL binary in this repository, the complete corresponding source is the upstream commit named in the table plus the patch files and build steps in the same folder. You can fetch the upstream source from the link in the table. If you cannot get something you need, open an issue here and we will provide it.

## Run it yourself

You need Node.js 20 or newer. No Docker is needed for the tests.

```
git clone https://github.com/yashv373/nishkam-tool
cd nishkam-tool
npm install
```

`npm install` fetches `@yowasp/yosys` and `verilator-wasm`. Every other tool is already in `web/vendor/`.
`npm test` runs the quick ones in order. Each command below can also be run on its own.

| Command | What it checks | Expected end of output | Time |
|---|---|---|---|
| `node web/studio/fit.test.mjs` | die-size estimator | `PASS suggested die 152 0.696` | seconds |
| `node web/studio/stages.test.mjs` | flow order and path mapping | `stages local ok` | seconds |
| `node web/studio/viewers/parse.test.mjs` | DEF and STA report parsers | `src parser ok` | seconds |
| `node web/studio/viewers/gds.test.mjs` | GDS parser | `ok` | seconds |
| `node web/studio/engines/selftest.node.mjs` | Yosys, Verilator, Icarus, netlistsvg, OpenSTA names | all lines `PASS` (exit 0) | ~1 min |
| `node web/studio/engines/lvs.selftest.mjs` | place, route, Magic extract, Netgen LVS on an 8-flop shift register | `PASS layout matches netlist`, `PASS broken layout caught devices 216,224 vs 224,224` | ~1 min |
| `node web/studio/engines/cts.selftest.mjs` | OpenROAD clock tree on tiny8 | `CTS: 9 clock buffers, 48 sinks, latency 0.67 ns, skew 0 ns` then `cts selftest ok` | ~30 s |
| `node web/studio/engines/opensta.selftest.mjs` | OpenSTA slack and power | `PASS shreg4 ...`, `PASS cnt8 ...` | ~10 s |
| `node web/studio/engines/pd.selftest.mjs 8` | full flow on 8 flops (place, CTS, route, GDS, DRC, extract) | all `PASS`, `0 error tiles` | ~1 min |
| `node web/studio/engines/pd.cases.selftest.mjs adder` | flow on one case; other names: `twoclk`, `pins40`, `tiny8`, `mult8` | `PASS adder ... failed nets 0 ... lvs true devices 256,256 nets 146,146` | ~1 min |
| `node docs/validation/ctsdiff.mjs` | browser vs native clock-tree DEF | see [`docs/validation/logs/ctsdiff.txt`](docs/validation/logs/ctsdiff.txt) | seconds |

Results from a clean copy and a fresh `npm install` (Windows 11, Node 26): `fit`, `stages`, `parse`, `gds`, `selftest.node`, `lvs`, `cts`, `opensta`, `pd.selftest 8` and `pd.cases adder` all passed. For example:

```
LVS layout vs netlist: match=true devices=224,224 nets=109,109 ... Circuits match uniquely.
PASS broken layout caught devices 216,224 vs 224,224
CTS: 9 clock buffers, 48 sinks, latency 0.67 ns, skew 0 ns
cts selftest ok
PASS shreg4 {"setup_ws_ns":6.7093,...,"total_uW":279,...}
PASS cnt8 {"setup_ws_ns":6.0215,...,"total_uW":1710,...}
```

The tiny8 test design is in [`web/studio/engines/fixtures/tiny8.v`](web/studio/engines/fixtures/tiny8.v) (a small 8-bit CPU, 48 flops).

## Validation against native tools

Full report with the test designs, how each side was run, numbers and what was not checked: **[docs/validation/README.md](docs/validation/README.md)** (also [qflow-native.md](docs/validation/qflow-native.md)). Native side: `hpretl/iic-osic-tools:chipathon26` (OpenROAD 26Q2, OpenSTA 3.1.0, Netgen 1.5.318, Magic 8.3.636, Yosys 0.64, LibreLane 3.0.2).

| Part | Result | Evidence |
|---|---|---|
| Clock tree (TritonCTS), tiny8 | Same buffers, latency and skew; 553 of 553 components identical (cell, position, orientation) | [ctsdiff.txt](docs/validation/logs/ctsdiff.txt), [cts.txt](docs/validation/logs/cts.txt) |
| Netgen LVS | Same device and net counts and the same verdict as native Netgen 1.5.318 on adder2, mult8, tiny8 (native 1.5.324 not compared) | [lvs.txt](docs/validation/logs/lvs.txt), `netgen-native-*.log` |
| Placement and routing (adder2) | Same tool outputs as native graywolf and qflow tools; routing differs only in some wire choices | [qflow-native.md](docs/validation/qflow-native.md) |
| qrouter DRC fix | Magic DRC errors: adder2 18 to 3, mult8 118 to 39, tiny8 197 to 66; LVS still matches. Routing is not yet DRC clean | [drc.txt](docs/validation/logs/drc.txt) |
| OpenSTA | Slack and power equal stored native numbers on two small designs; native not re-run | [opensta.txt](docs/validation/logs/opensta.txt) |

Limits are listed at the end of the report. Please read them before relying on a number.

## Rebuild a WebAssembly tool

Most builds use the Emscripten Docker image `emscripten/emsdk:3.1.74`. Mount a work folder, clone the upstream commit from the table, apply the patch if there is one, then build:

```
docker run --rm -it -v "$PWD/work:/work" emscripten/emsdk:3.1.74 bash
```

| Tool | How |
|---|---|
| graywolf | clone at `33fbcaa`, `patch -p1 < wasm.patch`, run [`build.sh`](web/vendor/graywolf/33fbcaa/build.sh) |
| qrouter, vlog2Cel, addspacers | clone qrouter `c8f1111` into `/work/qrouter` and qflow `52ecda1` into `/work/qflow`, put [`stubs/`](web/vendor/qrouter/c8f1111/stubs) in `/work/stubs`, run [`build.sh`](web/vendor/qrouter/c8f1111/build.sh). For the DRC variant first run `git apply drc-blocks.patch` in the qrouter clone ([build.sh](web/vendor/qrouter/c8f1111-drc/build.sh)) |
| Netgen | clone at `3cb047b`, `git apply netcmp-uaf.patch`, build Tcl 8.6.14, compile and link with the exact flags in [SOURCE.md](web/vendor/netgen/3cb047b/SOURCE.md) |
| Magic | `npm/build.sh --variant=notcl --release`, then relink with the flags in [SOURCE.md](web/vendor/magic/bed8d4f/SOURCE.md) |
| OpenSTA | cmake steps and link line in [SOURCE.md](web/vendor/opensta/defec0b/SOURCE.md); entry point [`main_wasm.cc`](web/vendor/opensta/defec0b/main_wasm.cc) |
| OpenROAD CTS | the 13 changes, dependency builds and link line in [SOURCE.md](web/vendor/openroad-cts/61932e8/SOURCE.md); [`main_wasm.cc`](web/vendor/openroad-cts/61932e8/main_wasm.cc) and [`grt_stub.cc`](web/vendor/openroad-cts/61932e8/grt_stub.cc) |
| Icarus, netlistsvg, Surfer, kwasm, Tiny Tapeout Explorer | prebuilt upstream files copied as they are; see each SOURCE.md |

The OpenROAD changes are described in words in its SOURCE.md. There is no single `.patch` file for them yet.

## The local runner

[`runner/nishkam_runner.py`](runner/nishkam_runner.py) (Python standard library only) lets a web page run LibreLane in a local Docker container (`hpretl/iic-osic-tools`). It listens on 127.0.0.1:7381, needs a random token that it prints at start-up, accepts only the origins you pass with `--origin`, and only a fixed list of settings. `python runner/nishkam_runner.py --selftest` checks its input validation. It is a work in progress.

## Credits

Everything here stands on other people's work. Thank you to:
Claire Xenia Wolf and the Yosys authors; the [YoWASP](https://yowasp.org) project; the Verilator authors and the verilator-wasm port; Stephen Williams (Icarus Verilog) and the VeriSim WebAssembly port; Neil Turley (netlistsvg) and the KIELER group (elkjs); James Cherry and Parallax Software (OpenSTA); the OpenROAD project; Tim Edwards (Magic, Netgen, qrouter, qflow, graywolf) and the Yale TimberWolf authors, Carl Sechen and Bill Swartz; the Surfer team; Matthias Koefferlein (KLayout) and the kwasm author; Alexander Mordvintsev (Tiny Tapeout Explorer); Google and GlobalFoundries (gf180mcu PDK) and the open_pdks and IIC-OSIC-TOOLS maintainers; the LibreLane team; Emscripten.

## Contributing

Bug reports and pull requests are welcome. Keep a change small, say which tool and version it touches, and run the tests above before sending it. If you change a vendored tool, add the patch file and update that folder's `SOURCE.md`. New or changed numbers in the validation report need a log in `docs/validation/logs/`.
