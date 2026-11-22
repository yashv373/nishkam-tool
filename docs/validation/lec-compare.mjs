// Section 23 (equivalence check, #189). Run from a folder with @yowasp/yosys@0.68.1207 in node_modules:
//   node <repo>/docs/validation/lec-compare.mjs build <outdir>    browser side: synthesis + the Studio LEC code (lec-core.js) in WebAssembly Yosys; writes each case's files and the scripts
//   bash <repo>/docs/validation/lec-compare.sh <outdir>           native side: the same scripts in native Yosys 0.64, with our cell models and with the PDK liberty, and EQY
//   node <repo>/docs/validation/lec-compare.mjs compare <outdir>  verdict table, decided with the same lec-core.js rules
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const [, , phase, out] = process.argv;
const E = (p) => new URL("../../web/studio/engines/" + p, import.meta.url);
const core = await import(E("lec-core.js"));
const { parseEquiv, proofOk, diffOutputs, equivScript, miterScript, resetOf } = core;

const SH = "module shreg4(input clk, rst_n, din, output dout); reg [3:0] s; always @(posedge clk or negedge rst_n) if (!rst_n) s <= 0; else s <= {s[2:0], din}; assign dout = s[3]; endmodule\n";
const CNT = "module counter(input clk, input rst, output reg [3:0] q);\n  always @(posedge clk) if (rst) q <= 4'd0; else q <= q + 4'd1;\nendmodule\n";
// case: [name, top, rtl key, seeded change or null]. A seeded change swaps the first cell of type `from` for `to` (pin names too).
const CASES = [["shreg4", "shreg4", "sh", null], ["counter", "counter", "cnt", null], ["tiny8", "tiny8", "t8", null],
  ["counter-bug", "counter", "cnt", ["xor2", "xnor2", "Z", "ZN"]], ["tiny8-bug", "tiny8", "t8", ["nand2", "nor2", "ZN", "ZN"]]];
const swap = (nl, from, to, pf, pt) => {
  const re = new RegExp(`(gf180mcu_fd_sc_mcu7t5v0__)${from}(_\\d+ \\S+ \\([^;]*?)\\.${pf}\\(`);
  if (!re.test(nl)) throw new Error("no " + from + " in the netlist");
  return nl.replace(re, `$1${to}$2.${pt}(`);
};
const LIB = "/foss/pdks/gf180mcuD/libs.ref/gf180mcu_fd_sc_mcu7t5v0/lib/gf180mcu_fd_sc_mcu7t5v0__tt_025C_5v00.lib";
const ST = { ok: "proven", differs: "differs", bounded: "bounded" };

if (phase === "build") {
  const req = createRequire(process.cwd() + "/");
  globalThis.__yosysModule = await import(pathToFileURL(req.resolve("@yowasp/yosys")).href);
  const Y = await import(E("yosys.worker.js")), { text } = await import(E("_rpc.js"));
  const { PROBLEMS } = await import(new URL("../../web/problems.js", import.meta.url));
  const RTL = { sh: SH, cnt: CNT, t8: PROBLEMS.find((x) => x.id === "squeeze-tiny8").files["tiny8.v"] };
  const nop = { log() {}, progress() {}, raw() {} };
  const models = fs.readFileSync(new URL("../../web/vendor/gf180mcu/sim-7b70722/gf180mcu_fd_sc_mcu7t5v0.yosys.v", import.meta.url), "utf8");
  const results = {};
  for (const [name, top, key, bug] of CASES.filter((c) => !process.argv[4] || c[0] === process.argv[4])) {
    const src = RTL[key], s = await Y.handle({ mode: "synth", files: { [top + ".v"]: src }, options: { top } }, nop);
    if (!s.ok) throw new Error("synth " + name);
    let nl = s.files["netlist.v"]; if (bug) nl = swap(nl, ...bug);
    const dir = `${out}/${name}`; fs.mkdirSync(dir, { recursive: true });
    const reset = resetOf(s.files["netlist.json"], top), srcs = [top + ".v"];
    const lib = (x) => x.replace("read_verilog -sv models.v", `read_liberty -overwrite -ignore_miss_func -ignore_miss_dir -setattr liberty_cell ${LIB}`);
    for (const [f, t] of Object.entries({ [top + ".v"]: src, "netlist.v": nl, "models.v": models, "equiv.ys": equivScript(srcs, top), "miter_ind.ys": miterScript(srcs, top, reset, true), "miter_bmc.ys": miterScript(srcs, top, reset, false) })) fs.writeFileSync(`${dir}/${f}`, t);
    for (const f of ["equiv", "miter_ind", "miter_bmc"]) fs.writeFileSync(`${dir}/${f}_lib.ys`, lib(fs.readFileSync(`${dir}/${f}.ys`, "utf8")));
    fs.writeFileSync(`${dir}/${name}.eqy`, `[gold]\nread_verilog -sv ${top}.v\nprep -top ${top}\n\n[gate]\nread_liberty -overwrite -ignore_miss_func -ignore_miss_dir -setattr liberty_cell ${LIB}\nread_verilog -sv netlist.v\nprep -top ${top}\n\n[strategy sby]\nuse sby\ndepth 5\nengine smtbmc yices\n`);
    fs.writeFileSync(`${dir}/top`, top);
    if (process.env.FILES_ONLY) continue;   // rewrite the scripts only (no proof in the browser engine)
    const t0 = Date.now();   // one case per process (argv[4]) so the shell can time it out: WebAssembly Yosys blocks the event loop, a timer inside cannot stop it
    const r = await core.lecRun({ files: { [top + ".v"]: src }, top, netlist: nl, json: s.files["netlist.json"], models, yosys: (sc, f) => Y.yosys(sc, f, nop), text });
    const m = r.summary; results[name] = { verdict: m.verdict, method: m.method, points: m.points, proven: m.provenPoints, unproven: m.unprovenPoints, firstDiff: m.rows?.[0] && `${m.rows[0].name} cycle ${m.rows[0].cycle}`, ms: Date.now() - t0 };
    console.log(name, JSON.stringify(results[name]));
    fs.writeFileSync(`${dir}/ours.json`, JSON.stringify(results[name]));
  }
} else if (phase === "compare") {
  const ours = Object.fromEntries(CASES.map((c) => [c[0], fs.existsSync(`${out}/${c[0]}/ours.json`) ? JSON.parse(fs.readFileSync(`${out}/${c[0]}/ours.json`, "utf8")) : { verdict: "timeout (stopped by the shell)" }])), rd = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
  // same decision order as lecRun: equiv flow all proven -> proven; else miter + induction -> proven; else bounded miter: a counterexample -> differs, none -> bounded
  const decide = (dir, sfx) => {
    const e = parseEquiv(rd(`${dir}/equiv${sfx}.log`));
    if (e.total && !e.unproven) return `proven (equiv, ${e.total} points)`;
    if (proofOk(rd(`${dir}/miter_ind${sfx}.log`))) return "proven (miter + induction)";
    const b = rd(`${dir}/miter_bmc${sfx}.log`), v = rd(`${dir}/cex_x${sfx}.vcd`);
    if (v) { const d = diffOutputs(v); return `differs (cycle ${d.rows[0]?.cycle}, ${d.rows[0]?.name})`; }
    return /Yosys.*ERROR|^ERROR:/m.test(b) ? "error" : "bounded";
  };
  const eqyV = (dir, n) => { const l = rd(`${dir}/${n}.eqy.log`); return /Successfully proved designs equivalent/.test(l) ? "proven" : /Failed to prove|unproven|FAIL/i.test(l) ? "not proven" : "no result"; };
  for (const name of Object.keys(ours)) {
    const dir = `${out}/${name}`, o = ours[name];
    console.log(`${name}: browser ${o.verdict}${o.method ? ` (${o.method}${o.points ? ", " + o.points + " points" : ""}${o.firstDiff ? ", first " + o.firstDiff : ""})` : ""} | native, our models: ${decide(dir, "")} | native, PDK liberty: ${decide(dir, "_lib")} | EQY: ${eqyV(dir, name)}`);
  }
}
