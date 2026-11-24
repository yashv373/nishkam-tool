// Section 18C, first five rows, rebuilt 2026-11-24 (#217). Builds the decks with the Lab's own code (buildDeck, buildNetlist),
// runs them in the browser ngspice-46 WASM in Node, writes decks/<name>.cir and browser/<name>.log.
// The same decks are then run by run-native.sh in the container (native ngspice-46). Compare with compare.mjs.
// Usage (from the repo root): node docs/validation/logs/18c-2026-11-24/run18c.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildNetlist, pinPositions } from "../../../../web/analog/netlist.js";
import { buildDeck } from "../../../../web/analog/control.js";

const root = new URL("../../../../web/", import.meta.url), here = new URL("./", import.meta.url);
fs.mkdirSync(new URL("decks/", here), { recursive: true }); fs.mkdirSync(new URL("browser/", here), { recursive: true });
const PDK = ".include /pdk/gf180mcuD/design.ngspice\n.lib /pdk/gf180mcuD/sm141064.ngspice typical\n";
function draw(rows, directives) {   // same helper as web/analog/parts.run.test.mjs
  const parts = [], labels = [];
  rows.forEach(([type, props, ...nets], i) => {
    const p = { id: i + 1, type, x: 100 * (i + 1), y: 100, rot: 0, props }; parts.push(p);
    pinPositions(p).forEach(([x, y], j) => { if (nets[j]) labels.push({ x, y, name: nets[j] }); });
  });
  return { parts, wires: [], labels, directives: PDK + directives };
}
const PARTS = {
  step_temp: draw([["v", { name: "V1", value: "0.6" }, "a", "0"], ["d", { name: "D1" }, "a", "0"], ["gnd", {}, "0"]],
    ".step temp list -40 27 125\n.dc V1 0.5 0.7 0.05\n.meas dc id find i(v1) at=0.6"),
  clipper: draw([["v", { name: "VIN", value: "0" }, "in", "0"], ["r", { name: "R1", value: "1k" }, "in", "out"], ["d", { name: "D1" }, "out", "0"], ["gnd", {}, "0"]],
    ".dc VIN 0 3 0.5\n.meas dc vclamp find v(out) at=3\n.meas dc id find i(vin) at=3"),
  ce: draw([["v", { name: "VCC", value: "3.3" }, "vcc", "0"], ["v", { name: "VB", value: "dc 0.75 ac 1" }, "b", "0"], ["r", { name: "RC", value: "1k" }, "vcc", "c"],
    ["npn", { name: "Q1" }, "c", "b", "0"], ["gnd", {}, "0"]],
    ".dc VB 0.76 0.84 0.02\n.meas dc vc1 find v(c) at=0.78\n.meas dc vc2 find v(c) at=0.82\n.meas dc ic find i(vcc) at=0.8"),
  eamp: draw([["v", { name: "VIN", value: "0.1" }, "in", "0"], ["esrc", { name: "E1", value: "10" }, "out", "0", "in", "0"], ["r", { name: "RL", value: "1k" }, "out", "0"], ["gnd", {}, "0"]],
    ".dc VIN 0 0.2 0.1\n.meas dc vout find v(out) at=0.1\n.meas dc iin find i(vin) at=0.1\n.meas dc ie find i(e1) at=0.1"),
};
const decks = {
  step_r: buildDeck('RC low-pass, .step over R\nV1 in 0 ac 1\n.param rval=1k\nR1 in out {rval}\nC1 out 0 1n\n.step param rval list 1k 2k 4k\n.ac dec 10 1 1meg\n.meas ac bw when vdb(out)=-3.0103\n.end').deck,
};
for (const [n, m] of Object.entries(PARTS)) { const r = buildNetlist(m); decks[n] = buildDeck(r.deck).deck; }

const { default: create } = await import(new URL("vendor/ngspice/46/ngspice.js", root).href);
const init = "set ngbehavior=hsa\nset ng_nomodcheck\nset num_threads=1\nset enable_noisy_r\n";
for (const [n, d] of Object.entries(decks)) {
  fs.writeFileSync(new URL(`decks/${n}.cir`, here), d);
  let out = "";
  const m = await create({ locateFile: (f) => fileURLToPath(new URL("vendor/ngspice/46/" + f, root)), print: (s) => { out += s + "\n"; }, printErr: (s) => { out += s + "\n"; } });
  const FS = m.FS; FS.mkdir("/models");
  FS.writeFile("/proc/meminfo", "MemTotal:        2097152 kB\nMemFree:         1048576 kB\nMemAvailable:    1048576 kB\n");
  for (const f of ["design.ngspice", "sm141064.ngspice", "sm141064_mim.ngspice"]) FS.writeFile("/models/" + f, fs.readFileSync(new URL("vendor/gf180mcu/models-7b70722/" + f, root)));
  FS.writeFile("/.spiceinit", init); FS.mkdirTree("/home/web_user"); FS.writeFile("/home/web_user/.spiceinit", init);
  FS.writeFile("/run.cir", d.replace(/\/pdk\/gf180mcuD\//g, "/models/"));
  try { m.callMain(["-b", "-o", "/run.log", "/run.cir"]); } catch { /* exit() */ }
  fs.writeFileSync(new URL(`browser/${n}.log`, here), FS.readFile("/run.log", { encoding: "utf8" }) + out);
  console.log("browser", n, "done");
}
