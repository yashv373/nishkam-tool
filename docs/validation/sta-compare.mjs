// node docs/validation/sta-compare.mjs <outdir> : for shreg4 and cnt8 (netlists from opensta.selftest.mjs) write the netlist, the liberty and
// run.tcl, and save the FULL text the browser OpenSTA prints (browser.out). compare.sh then runs native `sta` on the same run.tcl and diffs.
import fs from "node:fs";
import zlib from "node:zlib";
import { handle, script } from "../../web/studio/engines/opensta.worker.js";
const out = process.argv[2], io = { log() {}, progress() {}, raw: (_t, s) => (buf += s) };
let buf = "";
const src = fs.readFileSync(new URL("../../web/studio/engines/opensta.selftest.mjs", import.meta.url), "utf8");
const lib = zlib.gunzipSync(fs.readFileSync(new URL("../../web/vendor/gf180mcu/lib-tt5v0-full/gf180mcu_fd_sc_mcu7t5v0__tt_025C_5v00.lib.gz", import.meta.url)));
process.on("unhandledRejection", () => {});
for (const m of src.matchAll(/^  (\w+): \{ v: ("(?:[^"\\]|\\.)*")/gm)) {
  const top = m[1], v = JSON.parse(m[2]), o = { top, clockPort: "clk", periodNs: 10, inputDelayNs: 2, outputDelayNs: 2, loadPf: 0.05 };
  fs.mkdirSync(`${out}/${top}`, { recursive: true });
  fs.writeFileSync(`${out}/${top}/${top}.v`, v); fs.writeFileSync(`${out}/${top}/lib.lib`, lib);
  fs.writeFileSync(`${out}/${top}/run.tcl`, script(o, "lib.lib", `${top}.v`));
  buf = ""; await handle({ files: { [top + ".v"]: v }, options: o }, io);
  fs.writeFileSync(`${out}/${top}/browser.out`, buf);
}
