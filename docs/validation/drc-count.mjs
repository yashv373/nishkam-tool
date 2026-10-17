// node docs/validation/drc-count.mjs <design>   (run from a folder with @yowasp/yosys in node_modules)
// Browser flow (pd.flow) then Magic DRC; prints error tiles and LVS result. Uses whichever qrouter build place.worker.js points at.
import { flow, DESIGNS } from "../../web/studio/engines/pd.flow.mjs";
import * as M from "../../web/studio/engines/magic.worker.js";
import * as L from "../../web/studio/engines/lvs.worker.js";
const n = process.argv[2], top = DESIGNS[n][0], io = { log() {}, progress() {} };
const r = await flow(...DESIGNS[n]);
const mg = await M.handle({ files: r.rt.files, options: { top, extract: true, drc: true, keepExt: true } }, io);
const lv = await L.handle({ files: { [top + ".spice"]: mg.files[top + ".spice"], [top + ".v"]: r.ct ? r.ct.files[top + "_cts.v"] : r.nl }, options: { top } }, io);
console.log(`${n}: failed nets ${r.failed}, DRC error tiles ${mg.summary.drcErrors}, LVS match ${lv.summary.match}`);
