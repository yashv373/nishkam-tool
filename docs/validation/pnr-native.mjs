// Same OpenROAD commit, same Tcl, same inputs, native instead of WebAssembly (#26).
//   node docs/validation/pnr-native.mjs <outdir-of-pnr-flow.selftest (OUT=...)> [design]    prepares  <HOST_JOBS>/pnr_native_<design>/
//   then in Git Bash:  bash docs/validation/pnr-native.sh <design>                              runs place + route natively, one thread
// The Tcl is taken from web/studio/engines/pnr.worker.js (placeScript, routeScript, floorplanDef), only the /w folder is renamed.
import { mkdirSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { floorplanDef, placeScript, routeScript } from "../../web/studio/engines/pnr.worker.js";
const [from, name = "tiny8"] = process.argv.slice(2);
const DIE = { tiny8: [135.52, 133.28], adder2: [77.28, 74.48] }[name], top = name;
const HOST = "C:/Users/Asus/eda/designs/nishkam_jobs", BOX = "/foss/designs/nishkam_jobs", dir = `${HOST}/pnr_native_${name}`, w = `${BOX}/pnr_native_${name}/w`;
mkdirSync(`${dir}/w`, { recursive: true });
const V = new URL("../../web/vendor/gf180mcu/", import.meta.url);
copyFileSync(new URL("pd-7b70722/gf180mcu_fd_sc_mcu7t5v0__nom.tlef", V), `${dir}/w/tech.lef`);
copyFileSync(new URL("pd-7b70722/gf180mcu_fd_sc_mcu7t5v0.lef", V), `${dir}/w/cells.lef`);
copyFileSync(new URL("pd-7b70722/drc_exclude.cells", V), `${dir}/w/drc_exclude.cells`);
writeFileSync(`${dir}/w/lib.lib`, gunzipSync(readFileSync(new URL("lib-tt5v0-full/gf180mcu_fd_sc_mcu7t5v0__tt_025C_5v00.lib.gz", V))));
copyFileSync(`${from}/${name}.synth.v`, `${dir}/w/${top}.v`);
writeFileSync(`${dir}/w/fp.def`, floorplanDef(top, ...DIE));
writeFileSync(`${dir}/place.tcl`, placeScript({ top, density: 0.5 }).replaceAll("/w/", w + "/"));
copyFileSync(`${from}/${name}.final.def`, `${dir}/w/in.def`);   // route input = the WebAssembly flow's own placed + CTS DEF
writeFileSync(`${dir}/route.tcl`, routeScript({ top }).replaceAll("/w/", w + "/"));
console.log("prepared", dir);
