// node docs/validation/lvs-dump-sr8.mjs <outdir> : sr8 (good), sr8 with one transistor removed (broken) and sr8 with one net opened (open),
// each written as the files the browser Netgen compared (same layout as lvs-dump.mjs), for the native Netgen run. Same variants as lvs.selftest.mjs.
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
const bad = good.replace(/^X2 Q a_2665_112# VDD VNW pfet.*$/m, "");
const xl = good.split("\n"), use = {};
xl.forEach((l, i) => { if (/^X/.test(l)) l.split(/\s+/).slice(1, -1).forEach((n) => { if (!/^(VDD|VSS|VNW|VPW|\$)/.test(n)) (use[n] ||= []).push(i); }); });
const [net, lines] = Object.entries(use).find(([, v]) => v.length >= 3);
xl[lines.at(-1)] = xl[lines.at(-1)].split(/\s+/).map((n) => (n === net ? "OPENED" : n)).join(" ");
const cs = fs.readFileSync(new URL("../../web/vendor/gf180mcu/pd-7b70722/gf180mcu_fd_sc_mcu7t5v0.spice", import.meta.url), "utf8");
for (const [k, sp] of Object.entries({ good, broken: bad, open: xl.join("\n") })) {
  const d = `${out}/${k}`; fs.mkdirSync(d, { recursive: true });
  const p = L.prepare(sp, nl, cs), lv = await L.handle({ files: { [`${top}.spice`]: sp, [`${top}.v`]: nl }, options: { top } }, io);
  fs.writeFileSync(`${d}/lay.spice`, p.lay); fs.writeFileSync(`${d}/cells.spice`, cs); fs.writeFileSync(`${d}/pg.v`, p.v);
  fs.copyFileSync(new URL("../../web/vendor/netgen/3cb047b/gf180mcuD_setup.tcl", import.meta.url), `${d}/setup.tcl`);
  fs.writeFileSync(`${d}/run.tcl`, ["netgen::readnet spice lay.spice 1", "netgen::readnet spice cells.spice 2", "netgen::readnet verilog pg.v 2", ...p.cells.flatMap((c) => [1, 2].map((i) => `catch {netgen::flatten class {${c} ${i}}}`)), `netgen::lvs {${top} 1} {${top} 2} setup.tcl out.txt`, "quit"].join("\n"));
  console.log(`browser netgen sr8-${k}: match ${lv.summary.match} devices ${lv.summary.devices} nets ${lv.summary.nets}`);
}
