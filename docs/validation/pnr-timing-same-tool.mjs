// The SAME Magic extraction + OpenSTA (both WebAssembly, as in Studio) on any routed DEF + its netlist, so timing compares like with like.
//   node docs/validation/pnr-timing-same-tool.mjs <top> <routed.def> <netlist.v>     (run from a folder with node_modules/@yowasp/yosys not needed)
import { readFileSync } from "node:fs";
const [top, defF, nlF] = process.argv.slice(2);
const M = await import("../../web/studio/engines/magic.worker.js"), S = await import("../../web/studio/engines/opensta.worker.js");
process.on("unhandledRejection", () => {});
const io = { log() {}, progress() {} };
const mg = await M.handle({ files: { [top + "_route.def"]: readFileSync(defF) }, options: { top, extract: true, drc: false, rc: true } }, io);
const sta = (await S.handle({ files: { [top + ".v"]: readFileSync(nlF, "utf8"), [top + ".spef"]: mg.files[top + ".spef"] }, options: { top, clockPort: "clk", periodNs: 24, inputDelayNs: 4.8, outputDelayNs: 4.8, loadPf: 0, propagated: true } }, io)).summary;
console.log(JSON.stringify({ setup_ws_ns: sta.setup_ws_ns, hold_ws_ns: sta.hold_ws_ns, setup_tns: sta.setup_tns_ns, hold_tns: sta.hold_tns_ns }));
process.exit(0);
