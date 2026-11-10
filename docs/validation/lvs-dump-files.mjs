// node docs/validation/lvs-dump-files.mjs <top> <extracted.spice> <netlist.v> <outdir> : write the files Netgen compares (as lvs-dump.mjs), from files already on disk
// (e.g. the OUT=... dump of pnr-flow.selftest.mjs: <name>.spice and <name>.final.v), and print the browser Netgen result.
import fs from "node:fs";
import * as L from "../../web/studio/engines/lvs.worker.js";
const [top, spf, vf, d] = process.argv.slice(2), sp = fs.readFileSync(spf, "utf8"), nl = fs.readFileSync(vf, "utf8");
const cs = fs.readFileSync(new URL("../../web/vendor/gf180mcu/pd-7b70722/gf180mcu_fd_sc_mcu7t5v0.spice", import.meta.url), "utf8");
fs.mkdirSync(d, { recursive: true });
const p = L.prepare(sp, nl, cs), lv = await L.handle({ files: { [top + ".spice"]: sp, [top + ".v"]: nl }, options: { top } }, { log() {}, progress() {} });
fs.writeFileSync(`${d}/lay.spice`, p.lay); fs.writeFileSync(`${d}/cells.spice`, cs); fs.writeFileSync(`${d}/pg.v`, p.v);
fs.copyFileSync(new URL("../../web/vendor/netgen/3cb047b/gf180mcuD_setup.tcl", import.meta.url), `${d}/setup.tcl`);
fs.writeFileSync(`${d}/run.tcl`, ["netgen::readnet spice lay.spice 1", "netgen::readnet spice cells.spice 2", "netgen::readnet verilog pg.v 2", ...p.cells.flatMap((c) => [1, 2].map((i) => `catch {netgen::flatten class {${c} ${i}}}`)), `netgen::lvs {${top} 1} {${top} 2} setup.tcl out.txt`, "quit"].join("\n"));
console.log(`browser netgen ${top}: match ${lv.summary.match} devices ${lv.summary.devices} nets ${lv.summary.nets}`);
