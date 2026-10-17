// node docs/validation/lvs-dump.mjs <design> <outdir> : browser flow, then write the Magic SPICE and the netlist Netgen compared,
// and print the browser Netgen result. The same two files are then fed to native netgen in the container.
import fs from "node:fs";
import { flow, DESIGNS } from "../../web/studio/engines/pd.flow.mjs";
import * as M from "../../web/studio/engines/magic.worker.js";
import * as L from "../../web/studio/engines/lvs.worker.js";
import { prepare } from "../../web/studio/engines/lvs.worker.js";
const [n, out] = process.argv.slice(2), top = DESIGNS[n][0], io = { log() {}, progress() {} };
const r = await flow(...DESIGNS[n]);
const mg = await M.handle({ files: r.rt.files, options: { top, extract: true, drc: false, keepExt: true } }, io);
const nl = r.ct ? r.ct.files[top + "_cts.v"] : r.nl;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/${top}.spice`, mg.files[top + ".spice"]);
fs.writeFileSync(`${out}/${top}.v`, nl);
const cs = fs.readFileSync(new URL("../../web/vendor/gf180mcu/pd-7b70722/gf180mcu_fd_sc_mcu7t5v0.spice", import.meta.url), "utf8");
const p = prepare(new TextDecoder().decode(mg.files[top + ".spice"]), typeof nl === "string" ? nl : new TextDecoder().decode(nl), cs);
fs.writeFileSync(`${out}/lay.spice`, p.lay); fs.writeFileSync(`${out}/cells.spice`, cs); fs.writeFileSync(`${out}/pg.v`, p.v);
fs.copyFileSync(new URL("../../web/vendor/netgen/3cb047b/gf180mcuD_setup.tcl", import.meta.url), `${out}/setup.tcl`);
fs.writeFileSync(`${out}/run.tcl`, ["netgen::readnet spice lay.spice 1", "netgen::readnet spice cells.spice 2", "netgen::readnet verilog pg.v 2", ...p.cells.flatMap((c) => [1, 2].map((i) => `catch {netgen::flatten class {${c} ${i}}}`)), `netgen::lvs {${top} 1} {${top} 2} setup.tcl out.txt`, "quit"].join("\n"));
const lv = await L.handle({ files: { [top + ".spice"]: mg.files[top + ".spice"], [top + ".v"]: nl }, options: { top } }, io);
console.log(`browser netgen ${n}: match ${lv.summary.match} devices ${lv.summary.devices} nets ${lv.summary.nets}`);
