// node docs/validation/sta-comb.mjs <workdir> : adder2 (no clock port) synthesised in the browser, then browser OpenSTA with a VIRTUAL clock.
// Writes <workdir>/{adder2.v,lib.lib,run.tcl,browser.out}; sta-comb.sh runs native `sta` on the same files and diffs.
// Run from a folder with @yowasp/yosys in node_modules (pd.flow.mjs rule). The Tcl is ours (docs only): the worker's own script() always makes a clock on a port.
import fs from "node:fs";
import zlib from "node:zlib";
import { DESIGNS } from "../../web/studio/engines/pd.flow.mjs";
import { pdkOf } from "../../web/studio/pdk.js";
import * as Y from "../../web/studio/engines/yosys.worker.js";
process.on("unhandledRejection", () => {});
const out = process.argv[2], [top, src] = DESIGNS.adder2, io = { log() {}, progress() {} };
const sy = await Y.handle({ mode: "synth", files: { [top + ".v"]: src }, options: { top } }, io);
const nl = sy.files["netlist.v"];
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/adder2.v`, nl);
const P = pdkOf(), libUrl = P.url.libTt, gz = fs.readFileSync(libUrl.protocol === "file:" ? libUrl : new URL(libUrl));
fs.writeFileSync(`${out}/lib.lib`, zlib.gunzipSync(gz));
const tcl = (lib, v = "adder2.v") => `read_liberty ${lib}
read_verilog ${v}
link_design ${top}
create_clock -name vclk -period 10
set_input_delay 2 -clock vclk [all_inputs]
set_output_delay 2 -clock vclk [all_outputs]
set_load 0.05 [all_outputs]
puts "@@CHECK"
check_setup -verbose
puts "@@MAX"
report_checks -path_delay max -format full_clock_expanded -fields {slew cap input_pins} -digits 4 -group_path_count 50
puts "@@MIN"
report_checks -path_delay min -format full_clock_expanded -fields {slew cap input_pins} -digits 4 -group_path_count 50
puts "@@SUMMARY"
report_wns -digits 4
report_tns -digits 4
report_worst_slack -max -digits 4
report_worst_slack -min -digits 4
puts "@@POWER"
report_power
`;
fs.writeFileSync(`${out}/run.tcl`, tcl("lib.lib"));
// browser OpenSTA: same wasm build as opensta.worker.js
const STA = new URL("../../web/vendor/opensta/defec0b/", import.meta.url);
let buf = "";
const say = (s) => (buf += s + "\n");
const mod = await (await import(new URL("sta.js", STA).href)).default({ print: say, printErr: say, locateFile: (f) => new URL(f, STA).href });
mod.FS.mkdirTree("/w");
mod.FS.writeFile("/w/lib.lib", fs.readFileSync(`${out}/lib.lib`)); mod.FS.writeFile("/w/adder2.v", nl); mod.FS.writeFile("/w/run.tcl", tcl("/w/lib.lib", "/w/adder2.v"));
try { mod.callMain(["/w/run.tcl"]); } catch (e) { if (e?.status === undefined) { console.log(buf.slice(-1500)); throw e; } }
fs.writeFileSync(`${out}/browser.out`, buf);
console.log("browser:", buf.split("\n").filter((l) => /^worst slack|^wns|^tns/.test(l)).join(" | "));
