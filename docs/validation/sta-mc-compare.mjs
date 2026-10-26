// node docs/validation/sta-mc-compare.mjs <selftest OUT dir> <workdir> : multi-corner STA (#72). For every corner of the standard gf180mcu flow, write the exact Tcl our engine runs
// (script() with options.corner) and save the full text the browser OpenSTA prints (browser.out). sta-mc-compare.sh then runs native `sta` on the same Tcl and diffs.
import fs from "node:fs";
import { handle, script, STA_CORNERS } from "../../web/studio/engines/opensta.worker.js";
const [src, out] = process.argv.slice(2), io = { log() {}, progress() {}, raw: (_t, s) => (buf += s) };
let buf = "";
const PD = "/foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/lib/gf180mcu_fd_sc_mcu7t5v0__";
const base = { top: "tiny8", clockPort: "clk", periodNs: 24, inputDelayNs: 4.8, outputDelayNs: 4.8, loadPf: 0, uncertaintyNs: 0.1 };
process.on("unhandledRejection", () => {});
for (const stage of ["pre", "post"]) for (const c of STA_CORNERS) {
  const rc = c.slice(0, 3); if (stage === "pre" && rc !== "nom") continue;   // no wires before layout: LibreLane skips the identical min / max corners
  const spef = rc === "nom" ? "tiny8.spef" : `tiny8_${rc}.spef`, v = stage === "pre" ? "tiny8.synth.v" : "tiny8.final.v", d = `${out}/${stage}.${c}`;
  fs.mkdirSync(d, { recursive: true });
  const files = { [v]: fs.readFileSync(`${src}/${v}`, "utf8") }; if (stage === "post") files[spef] = fs.readFileSync(`${src}/${spef}`);
  for (const f of Object.keys(files)) fs.writeFileSync(`${d}/${f}`, files[f]);
  const o = { ...base, corner: c, propagated: stage === "post" };
  fs.writeFileSync(`${d}/run.tcl`, script(o, `${PD}${c.slice(4)}.lib`, v, stage === "post" ? spef : null));
  buf = ""; await handle({ files: { [v]: files[v], ...(stage === "post" ? { [spef]: files[spef] } : {}) }, options: o }, io);
  fs.writeFileSync(`${d}/browser.out`, buf);
}
