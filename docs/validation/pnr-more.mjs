// Section 24: OpenSTA + OpenROAD place and route on two bigger open designs (#192). Run from a folder with @yowasp/yosys@0.68.1207 in node_modules:
//   node <repo>/docs/validation/pnr-more.mjs run <design> <outdir>      browser side (WebAssembly, same workers as the page); writes everything the native side needs
//   bash <repo>/docs/validation/pnr-more.sh <design> <outdir>          native side: OpenROAD 6f3f28c (image or-native-61:6f3f28c) on the same Tcl, native sta 3.1.0 on the same reports
// designs: sha1 (secworks/sha1, one clock), afifo (dpretet/async_fifo, two clocks, no relation between them)
// Sources are cloned by the caller into $SRC/sha1 and $SRC/async_fifo (see README section 24).
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
const [, , phase, name, out] = process.argv;
const E = (p) => new URL("../../web/studio/engines/" + p, import.meta.url), V = new URL("../../web/vendor/gf180mcu/", import.meta.url);
const SRC = process.env.SRC;
const D = {
  sha1: { top: "sha1", files: () => ["sha1.v", "sha1_core.v", "sha1_w_mem.v"].map((f) => `${SRC}/sha1/src/rtl/${f}`), clocks: [["clk", 20]], period: 20 },
  afifo: { top: "afifo32", extra: { "afifo32.v": `module afifo32(input wclk, wrst_n, winc, input [31:0] wdata, output wfull, awfull, input rclk, rrst_n, rinc, output [31:0] rdata, output rempty, arempty);
  async_fifo #(.DSIZE(32), .ASIZE(5)) u(.*);   // 32 bits x 32 words (1024 memory flops); wrapper only sets the two parameters
endmodule
` }, files: () => ["async_fifo.v", "fifomem.v", "rptr_empty.v", "sync_ptr.v", "sync_r2w.v", "sync_w2r.v", "wptr_full.v"].map((f) => `${SRC}/async_fifo/rtl/${f}`), clocks: [["wclk", 10], ["rclk", 14]], period: 10 },
}[name];
const { top } = D;
// SDC: every clock, input/output delay 20% of the first clock's period, async clock groups when there are two clocks
const clkSdc = (extra = "") => {
  const P = D.period, cp = D.clocks.map((c) => c[0]);
  return D.clocks.map(([p, per]) => `create_clock -name ${p} -period ${per} [get_ports ${p}]`).join("\n") + `
set data_in [all_inputs]
foreach p {${cp.join(" ")}} { set data_in [lsearch -all -inline -not -exact $data_in [get_ports $p]] }
set_input_delay ${P * 0.2} -clock ${cp[0]} $data_in
set_output_delay ${P * 0.2} -clock ${cp[0]} [all_outputs]
set_load 0.05 [all_outputs]
` + (cp.length > 1 ? `set_clock_groups -asynchronous -group {${cp[0]}} -group {${cp[1]}}\n` : "") + extra;
};
const w = (f, d) => fs.writeFileSync(`${out}/${f}`, d);
fs.mkdirSync(out, { recursive: true });

if (phase === "run") {
  const req = createRequire(process.cwd() + "/");
  globalThis.__yosysModule = await import(pathToFileURL(req.resolve("@yowasp/yosys")).href);
  const Y = await import(E("yosys.worker.js")), N = await import(E("pnr.worker.js")), C = await import(E("cts.worker.js")), S = await import(E("opensta.worker.js"));
  const io = { log() {}, progress() {}, raw() {} }, T = {}; let t = Date.now(); const lap = (k) => { T[k] = +((Date.now() - t) / 1000).toFixed(1); t = Date.now(); console.error(name, k, T[k], "s"); };
  const rtl = { ...Object.fromEntries(D.files().map((p) => [p.replace(/^.*\//, ""), fs.readFileSync(p, "utf8")])), ...(D.extra || {}) };
  const sy = await Y.handle({ mode: "synth", files: rtl, options: { top } }, io); lap("synth");
  if (!sy.ok) throw new Error("synth failed " + JSON.stringify(sy.summary).slice(0, 400));
  const nl = sy.files["netlist.v"]; w(`${top}.synth.v`, nl);
  const side = process.env.DIE ? +process.env.DIE : Math.round(Math.sqrt(sy.summary.area / 0.4) / 0.56 / 9) * 9 * 0.56;   // 40% of the die is cells before filling; multiple of the 0.56 um grid
  const dieW = +side.toFixed(2), dieH = +(Math.round(side / 5.04) * 5.04).toFixed(2);
  const pl = await N.handle({ files: { [top + ".v"]: nl }, options: { mode: "place", top, dieW, dieH, density: 50 } }, io); lap("place");
  const sdc = clkSdc();
  const ct = await C.handle({ files: { [top + ".def"]: pl.files[top + ".def"], [top + ".v"]: pl.files[top + "_place.v"], "constraints.sdc": sdc }, options: { top, openroad: true, repair: false } }, io); lap("cts");
  const rt = await N.handle({ files: { [top + ".def"]: ct.files[top + ".def"] }, options: { mode: "route", top, multiCorner: false } }, io); lap("route");
  const ex = `set_clock_uncertainty 0.1 [all_clocks]\n`;
  // OpenSTA worker takes one clock port; the other clocks come in through extraSdc (same text as the native side reads).
  const staO = (more) => ({ top, clockPort: D.clocks[0][0], periodNs: D.clocks[0][1], inputDelayNs: D.period * 0.2, outputDelayNs: D.period * 0.2, loadPf: 0.05, ...more });
  const extra = D.clocks.slice(1).map(([p, per]) => `create_clock -name ${p} -period ${per} [get_ports ${p}]\n`).join("") + (D.clocks.length > 1 ? `set_clock_groups -asynchronous -group {${D.clocks[0][0]}} -group {${D.clocks[1][0]}}\n` : "");
  let buf = ""; const ioS = { log() {}, progress() {}, raw: (_t, x) => (buf += x) };   // the full text OpenSTA prints, for the diff against native sta
  const pre = await S.handle({ files: { [top + ".v"]: nl }, options: staO({ extraSdc: extra }) }, ioS); w("sta-pre.browser.out", buf); buf = "";
  const post = await S.handle({ files: { [top + ".v"]: ct.files[top + "_cts.v"], [top + ".spef"]: rt.files[top + ".spef"] }, options: staO({ propagated: true, uncertaintyNs: 0.1, extraSdc: extra }) }, ioS); w("sta-post.browser.out", buf); lap("sta");
  w("synth.v", nl); w("place.def", pl.files[top + ".def"]); w("place.v", pl.files[top + "_place.v"]); w("cts.def", ct.files[top + ".def"]); w("cts.v", ct.files[top + "_cts.v"]);
  w("b-place.log", pl.files["place.log"]); w("b-cts.rpt", ct.files["cts.rpt"]); w("b-cts.log", ct.files["cts.log"]); w("b-route.log", rt.files["route.log"]);
  w("route.def", rt.files[top + "_route.def"]); w("route.spef", rt.files[top + ".spef"]); w("constraints.sdc", sdc);
  for (const [k, x] of [["pre", pre], ["post", post]]) for (const [f, d] of Object.entries(x.files)) w(`sta-${k}.${f}`, d);
  w("sta-pre.run.tcl", S.script({ ...staO({ extraSdc: extra }), top, clockPort: D.clocks[0][0] }, "/w/lib.lib", "/w/design.v", null));
  w("sta-post.run.tcl", S.script({ ...staO({ propagated: true, uncertaintyNs: 0.1, extraSdc: extra }), top }, "/w/lib.lib", "/w/design.v", "/w/design.spef"));
  w("sta-pre.summary.json", JSON.stringify(pre.summary)); w("sta-post.summary.json", JSON.stringify(post.summary));
  // native Tcl: the browser's own scripts, "/w/" is where the native side mounts the folder
  const nat = (s) => s;
  w("tech.lef", fs.readFileSync(new URL("pd-7b70722/gf180mcu_fd_sc_mcu7t5v0__nom.tlef", V))); w("cells.lef", fs.readFileSync(new URL("pd-7b70722/gf180mcu_fd_sc_mcu7t5v0.lef", V))); w("drc_exclude.cells", fs.readFileSync(new URL("pd-7b70722/drc_exclude.cells", V)));
  w("lib.lib", gunzipSync(fs.readFileSync(new URL("lib-tt5v0-full/gf180mcu_fd_sc_mcu7t5v0__tt_025C_5v00.lib.gz", V))));
  w(top + ".v", nl); w("fp.def", N.floorplanDef(top, dieW, dieH));
  w("rcx.rules", fs.readFileSync(new URL("rcx-pdk-7b70722/rules.openrcx.gf180mcuD.nom", V)));   // route.tcl runs OpenRCX after write_def; without this native OpenRCX crashed (2026-11-24)
  w("place.tcl", nat(N.placeScript({ top, density: 0.5 }))); w("cts.tcl", nat(C.script(top, true, false))); w("route.tcl", nat(N.routeScript({ top })));
  const sum = { design: name, top, synthCells: sy.summary.cells, synthArea: sy.summary.area, die: [dieW, dieH], clocks: D.clocks, T, place: pl.summary.instances, cts: ct.summary, route: { wire: rt.summary.wirelengthUm, vias: rt.summary.vias, drc: rt.summary.drcTrajectory, violations: rt.summary.violations },
    preSetup: pre.summary.setup_ws_ns, preHold: pre.summary.hold_ws_ns, postSetup: post.summary.setup_ws_ns, postHold: post.summary.hold_ws_ns };
  w("browser.json", JSON.stringify(sum, null, 1)); console.log(JSON.stringify(sum));
}

if (phase === "compare") {   // after pnr-more.sh
  const { defStats } = await import("./def-stats.mjs"), rd = (f) => fs.readFileSync(`${out}/${f}`, "utf8"), has = (f) => fs.existsSync(`${out}/${f}`);
  const comps = (t) => { const m = new Map(); t = t.slice(t.indexOf("\nCOMPONENTS"), t.indexOf("END COMPONENTS")); for (const x of t.matchAll(/^\s*-\s+(\S+)\s+(\S+)[^;]*?\(\s*(-?\d+)\s+(-?\d+)\s*\)\s*(\w+)/gm)) m.set(x[1], `${x[2]} ${x[3]} ${x[4]} ${x[5]}`); return m; };
  const same = (a, b) => { const A = comps(a), B = comps(b); let n = 0; for (const [k, v] of A) if (B.get(k) === v) n++; return `${n} of ${A.size} cells at the same spot and orientation (native has ${B.size})`; };
  const b = JSON.parse(rd("browser.json")), top1 = b.top, log = (f) => (has(f) ? rd(f) : "");
  const hp = (l) => (/DPL-0022\] HPWL after\s+([\d.]+)/.exec(l) || [])[1];
  const rows = [`design ${name}: ${b.synthCells} cells after synthesis, die ${b.die.join(" x ")} um, clocks ${b.clocks.map((c) => c.join("=")+"ns").join(", ")}`];
  rows.push(`instances after place (with tap cells): browser ${b.place}, native ${(/COMPONENTS (\d+)/.exec(rd(`${top1}_place.def`)) || [])[1] ?? "?"}`);
  rows.push(`HPWL after detailed placement (um): browser ${hp(log("b-place.log"))}, native ${hp(log("n-place.log"))}`);
  if (has(`${top1}_place.def`)) rows.push("placement: " + same(rd("place.def"), rd(`${top1}_place.def`)));
  if (has(`${top1}_cts.def`)) rows.push("after CTS: " + same(rd("cts.def"), rd(`${top1}_cts.def`)));
  rows.push(`CTS browser: ${JSON.stringify(b.cts)}`);
  rows.push(`route browser: ${JSON.stringify(b.route)} ${JSON.stringify(defStats(rd("route.def")))}`);
  if (has(`${top1}_route.def`)) rows.push(`route native: ${JSON.stringify(defStats(rd(`${top1}_route.def`)))}  (violations per iteration: ${[...log("n-route.log").matchAll(/Number of violations = (\d+)/gi)].map((m) => m[1]).join(" / ")})`);
  const perClock = (t) => { const o = {}; let c = null, l = null; for (const x of t.split("\n")) { const h = /^Clock (\S+)\s*$/.exec(x); if (h) { c = h[1]; l = null; continue; } if (!c || o[c]) continue; const a = /^\s*([\d.]+)\s+([\d.]+)\s+latency/.exec(x), b = /^\s*([\d.]+)\s+skew/.exec(x); if (a) l = a; if (b && l) o[c] = `latency ${l[1]}..${l[2]} ns, skew ${b[1]} ns`; } return o; };
  if (has("b-cts.rpt")) { const B = perClock(rd("b-cts.rpt")), Nn = perClock(log("n-cts.log")); for (const c of new Set([...Object.keys(B), ...Object.keys(Nn)])) rows.push(`CTS clock ${c}: browser ${B[c] ?? "-"} | native ${Nn[c] ?? "-"}`); }
  for (const k of ["pre", "post"]) {
    const clean = (t) => t.split("\n").map((l) => l.trim().replace(/run\.tcl line \d+/, "run.tcl line N")).filter((l) => l && !/^OpenSTA|^License|^This is free|^This program|Copyright|^Warranty|under the terms|under certain conditions/.test(l));
    const A = clean(rd(`sta-${k}.native.out`)), B = clean(rd(`sta-${k}.browser.out`)); let d = 0; const ex = [];
    for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) { d++; if (ex.length < 4) ex.push(`  line ${i}: native "${A[i]}" | browser "${B[i]}"`); }
    rows.push(`STA ${k}-route: ${B.length} lines browser, ${A.length} native, ${d} differ`, ...ex);
  }
  console.log(rows.join("\n"));
}
