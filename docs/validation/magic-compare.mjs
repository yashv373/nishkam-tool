// node docs/validation/magic-compare.mjs <design|sr8> <outdir> (run where @yowasp/yosys is in node_modules)
// Browser flow -> routed DEF -> browser Magic (GDS, DRC, extract). Writes into <outdir>: the routed DEF, the PDK files, run.tcl (the same Magic
// commands as magic.worker.js, for native Magic) and browser.* (gds, spice, drc rules, drc count) for magic-compare.sh to compare.
import fs from "node:fs";
import { flow, DESIGNS } from "../../web/studio/engines/pd.flow.mjs";
import * as M from "../../web/studio/engines/magic.worker.js";
import * as P from "../../web/studio/engines/place.worker.js";
import * as R from "../../web/studio/engines/route.worker.js";
import * as C from "../../web/studio/engines/cts.worker.js";
import { PDK, pdk } from "../../web/studio/engines/place.worker.js";
process.on("unhandledRejection", () => {});
const [n, out] = process.argv.slice(2), io = { log() {}, progress() {} };
let top, files;
if (n === "sr8") { // same chain as pd.selftest.mjs 8
  top = "sr8"; const q = (i) => (i === 7 ? "dout" : `q${i}`);
  const nl = `module sr8(clk, rst_n, din, dout);\n  input clk; input rst_n; input din; output dout;\n` + Array.from({ length: 7 }, (_, i) => `  wire q${i};`).join("\n") + "\n" +
    Array.from({ length: 8 }, (_, i) => `  gf180mcu_fd_sc_mcu7t5v0__dffrnq_1 f${i} (.CLK(clk), .D(${i ? q(i - 1) : "din"}), .Q(${q(i)}), .RN(rst_n));`).join("\n") + "\nendmodule\n";
  const pl = await P.handle({ files: { "sr8.v": nl }, options: { top } }, io);
  const ct = await C.handle({ files: { "sr8.def": pl.files["sr8.def"], "constraints.sdc": "create_clock -name clk -period 40 [get_ports clk]\n" }, options: { top } }, io);
  files = (await R.handle({ files: { ...pl.files, "sr8.def": ct.files["sr8.def"] }, options: { top } }, io)).files;
} else { top = DESIGNS[n][0]; files = (await flow(...DESIGNS[n])).rt.files; }
const mg = await M.handle({ files, options: { top, extract: true, drc: true, keepExt: true } }, io);
fs.mkdirSync(out, { recursive: true });
const W = (f, d) => fs.writeFileSync(`${out}/${f}`, d);
for (const k of ["tech", "tlef", "lef", "gds"]) W(PDK[k], await pdk(k));
const def = Object.keys(files).find((p) => /\.def$/.test(p)); W(`${top}.def`, files[def]);
W("run.tcl", ["tech load " + PDK.tech, "scalegrid 1 10", "snap lambda", "drc off", "gds readonly true", "gds read " + PDK.gds, "lef read " + PDK.tlef, "lef read " + PDK.lef, `def read ${top}.def`,
  `gds write ${top}.gds`, "select top cell", "drc euclidean on", "drc style drc(full)", "drc on", "drc check", "drc catchup", "drc count total", "echo end-of-drc", 'foreach {r b} [drc listall why] {puts "RULE $r"}',
  "extract do local", "extract no capacitance", "extract no coupling", "extract no resistance", "extract no adjust", "extract all", "ext2spice lvs", `ext2spice -o ${top}.spice ${top}`, "quit -noprompt"].join("\n") + "\n");
W("top.txt", top); W("browser.spice", mg.files[top + ".spice"]); W("browser.gds", mg.files[top + ".gds"]);
W("browser.drc", `${mg.summary.drcErrors}\n${mg.summary.drcRules.join("\n")}\n`);
console.log(`browser ${n}: DRC ${mg.summary.drcErrors} tiles, gds ${mg.files[top + ".gds"].length} bytes`);
