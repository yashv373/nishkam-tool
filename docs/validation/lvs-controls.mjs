// node docs/validation/lvs-controls.mjs <outdir> : sr8 (good) plus two more negative controls (issue #212): "swap" (two pins of one flip-flop exchange their nets) and "short" (every flip-flop VSS pin wired to VDD) and "short1" (only f3). Same file layout as lvs-dump-sr8.mjs.
import fs from "node:fs";
import * as P from "../../web/studio/engines/place.worker.js";
import * as R from "../../web/studio/engines/route.worker.js";
import * as M from "../../web/studio/engines/magic.worker.js";
import * as L from "../../web/studio/engines/lvs.worker.js";
const out = process.argv[2], bits = 8, top = "sr8", q = (i) => (i === bits - 1 ? "dout" : `q${i}`), io = { log() {}, progress() {} };
const nl = `module ${top}(clk, rst_n, din, dout);\n  input clk; input rst_n; input din; output dout;\n` + Array.from({ length: bits - 1 }, (_, i) => `  wire q${i};`).join("\n") + "\n" +
  Array.from({ length: bits }, (_, i) => `  gf180mcu_fd_sc_mcu7t5v0__dffrnq_1 f${i} (.CLK(clk), .D(${i ? q(i - 1) : "din"}), .Q(${q(i)}), .RN(rst_n));`).join("\n") + "\nendmodule\n";
const pl = await P.handle({ files: { [`${top}.v`]: nl }, options: { top } }, io), rt = await R.handle({ files: pl.files, options: { top } }, io);
const mg = await M.handle({ files: rt.files, options: { top, extract: true } }, io), good = new TextDecoder().decode(mg.files[`${top}.spice`]);
// swap: exchange the D-pin nets of flip-flops f2 and f4 (lines "Xf<n> D Q RN ..."); the shift chain becomes f2 -> f3 -> f2, so it cannot match sr8
const xl = good.split("\n"), a = xl.findIndex((l) => /^Xf2 /.test(l)), b = xl.findIndex((l) => /^Xf4 /.test(l)), fa = xl[a].split(/\s+/), fb = xl[b].split(/\s+/);
[fa[1], fb[1]] = [fb[1], fa[1]]; xl[a] = fa.join(" "); xl[b] = fb.join(" ");
console.log(`swap: D nets of f2 and f4 exchanged (f2.D ${fa[1]}, f4.D ${fb[1]})`);
// short: the VSS pin of every flip-flop is wired to VDD (the VSS rail is left connected to no cell); short1: the same for flip-flop f3 only
const short = good.split("\n").map((l) => (/^X/.test(l) ? l.split(/\s+/).map((n) => (n === "VSS" ? "VDD" : n)).join(" ") : l)).join("\n");
const short1 = good.split("\n").map((l) => (/^Xf3 /.test(l) ? l.split(/\s+/).map((n) => (n === "VSS" ? "VDD" : n)).join(" ") : l)).join("\n"); // only flop f3
const cs = fs.readFileSync(new URL("../../web/vendor/gf180mcu/pd-7b70722/gf180mcu_fd_sc_mcu7t5v0.spice", import.meta.url), "utf8");
for (const [k, sp] of Object.entries({ good, swap: xl.join("\n"), short, short1 })) {
  const d = `${out}/${k}`; fs.mkdirSync(d, { recursive: true });
  const p = L.prepare(sp, nl, cs), lv = await L.handle({ files: { [`${top}.spice`]: sp, [`${top}.v`]: nl }, options: { top } }, io);
  fs.writeFileSync(`${d}/lay.spice`, p.lay); fs.writeFileSync(`${d}/cells.spice`, cs); fs.writeFileSync(`${d}/pg.v`, p.v);
  fs.copyFileSync(new URL("../../web/vendor/netgen/3cb047b/gf180mcuD_setup.tcl", import.meta.url), `${d}/setup.tcl`);
  fs.writeFileSync(`${d}/run.tcl`, ["netgen::readnet spice lay.spice 1", "netgen::readnet spice cells.spice 2", "netgen::readnet verilog pg.v 2", ...p.cells.flatMap((c) => [1, 2].map((i) => `catch {netgen::flatten class {${c} ${i}}}`)), `netgen::lvs {${top} 1} {${top} 2} setup.tcl out.txt`, "quit"].join("\n"));
  fs.writeFileSync(`${d}/browser.lvs.txt`, lv.files[`${top}.lvs.txt`]);
  console.log(`browser netgen sr8-${k}: match ${lv.summary.match} devices ${lv.summary.devices} nets ${lv.summary.nets}`);
}
