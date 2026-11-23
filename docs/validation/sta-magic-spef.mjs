// node docs/validation/sta-magic-spef.mjs <workdir> : tiny8 through the old browser flow (graywolf + qrouter + CTS), Magic RC extraction -> SPEF,
// then browser OpenSTA twice (without and with that SPEF). Writes <workdir>/{nospef,spef}/{run.tcl,tiny8.v,[tiny8.spef],browser.out}.
// sta-magic-spef.sh then runs native `sta` on the very same files and diffs. Needs @yowasp/yosys in node_modules (same as pd.flow.mjs).
import fs from "node:fs";
import { flow, DESIGNS } from "../../web/studio/engines/pd.flow.mjs";
import * as M from "../../web/studio/engines/magic.worker.js";
import { handle, script } from "../../web/studio/engines/opensta.worker.js";
const out = process.argv[2], top = "tiny8", io0 = { log() {}, progress() {} };
const r = await flow(...DESIGNS[top]);
const mg = await M.handle({ files: r.rt.files, options: { top, drc: false, rc: true } }, io0);
const _n = r.ct.files[top + "_cts.v"], nl = typeof _n === "string" ? _n : new TextDecoder().decode(_n), spef = mg.files[top + ".spef"];
const PD = "/foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/lib/gf180mcu_fd_sc_mcu7t5v0__tt_025C_5v00.lib";
const o = { top, clockPort: "clk", periodNs: 24, inputDelayNs: 4.8, outputDelayNs: 4.8, loadPf: 0, uncertaintyNs: 0.1, corner: "nom_tt_025C_5v00", propagated: true,
  extraSdc: "puts \"drivers: [expr {[llength [get_pins -hierarchical * -filter {direction == output}]] + [llength [all_inputs]]}]\"\nreport_parasitic_annotation\n" };
for (const k of ["nospef", "spef"]) {
  const d = `${out}/${k}`; fs.mkdirSync(d, { recursive: true });
  const files = { [top + ".v"]: nl }; if (k === "spef") files[top + ".spef"] = spef;
  for (const [f, c] of Object.entries(files)) fs.writeFileSync(`${d}/${f}`, c);
  fs.writeFileSync(`${d}/run.tcl`, script(o, PD, top + ".v", k === "spef" ? top + ".spef" : null));
  let buf = ""; await handle({ files, options: o }, { ...io0, raw: (_t, s) => (buf += s) });
  fs.writeFileSync(`${d}/browser.out`, buf);
  console.log(k, "browser:", buf.split("\n").filter((l) => /^(worst slack|wns|tns)/.test(l)).join(" | "));
}
console.log(`magic spef nets: ${mg.summary.rcNets}`);
