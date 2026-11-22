// Section 22 (gate-level simulation, #188). Run from a folder with @yowasp/yosys@0.68.1207 in node_modules:
//   node <repo>/docs/validation/gls-compare.mjs build <outdir>    browser side: synthesis, RTL sim and gate sim (Yosys + Icarus WebAssembly, same files as the page)
//   bash <repo>/docs/validation/gls-compare.sh <outdir>           native side: same netlist + testbench, native Icarus, the PDK's own models
//   node <repo>/docs/validation/gls-compare.mjs compare <outdir>  value-by-value comparison of the VCD files
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const [, , phase, out] = process.argv;
const E = (p) => new URL("../../web/studio/engines/" + p, import.meta.url);
const { parseVcd, diffVcd, glsRun } = await import(E("gls-core.js"));

export const DESIGNS = {
  shreg4: {
    v: "module shreg4(input clk, rst_n, din, output dout); reg [3:0] s; always @(posedge clk or negedge rst_n) if (!rst_n) s <= 0; else s <= {s[2:0], din}; assign dout = s[3]; endmodule\n",
    tb: `module tb; reg clk = 0, rst_n = 0, din = 0; wire dout;
  shreg4 dut(.clk(clk), .rst_n(rst_n), .din(din), .dout(dout));
  always #5 clk = ~clk;
  reg [31:0] pat = 32'b1011_0010_1110_0001_0110_1001_1100_0101;
  integer i;
  initial begin $dumpfile("d.vcd"); $dumpvars(0, tb);
    #17 rst_n = 1;
    for (i = 0; i < 32; i = i + 1) begin @(negedge clk); din = pat[i]; end
    #12 rst_n = 0; #7 rst_n = 1;
    for (i = 0; i < 8; i = i + 1) begin @(negedge clk); din = ~din; end
    #20 $finish; end
endmodule
`,
  },
  counter: {
    v: "module counter(input clk, input rst, output reg [3:0] q);\n  always @(posedge clk) if (rst) q <= 4'd0; else q <= q + 4'd1;\nendmodule\n",
    tb: `module tb; reg clk = 0, rst = 1; wire [3:0] q;
  counter dut(.clk(clk), .rst(rst), .q(q));
  always #5 clk = ~clk;
  initial begin $dumpfile("d.vcd"); $dumpvars(0, tb);
    #12 rst = 0; #200 rst = 1; #20 rst = 0; #100 $finish; end
endmodule
`,
  },
  "counter-bug": { top: "counter", bug: ["xor2", "xnor2", "Z", "ZN"], get v() { return DESIGNS.counter.v; }, get tb() { return DESIGNS.counter.tb; } },   // counter with one xor2 in its netlist swapped for xnor2 (negative control)
  tiny8: {
    tb: `module tb; reg clk = 0, rst_n = 0; reg [15:0] instr; wire [7:0] pc, out;
  tiny8 dut(.clk(clk), .rst_n(rst_n), .instr(instr), .pc(pc), .out(out));
  always #5 clk = ~clk;
  // program: r0=6, r1=1, r2=0; loop: r2+=r0, r0-=r1, out=r2, jnz r0 loop (pc 3)
  always @(*) case (pc)
    8'd0: instr = 16'h1006;  8'd1: instr = 16'h1401;  8'd2: instr = 16'h1800;
    8'd3: instr = 16'h2802;  8'd4: instr = 16'h3001;  8'd5: instr = 16'h5800;
    8'd6: instr = 16'h4003;  default: instr = 16'h0000;
  endcase
  initial begin $dumpfile("d.vcd"); $dumpvars(0, tb);
    #23 rst_n = 1; #600 rst_n = 0; #13 rst_n = 1; #200 $finish; end
endmodule
`,
  },
};

if (phase === "build") {
  const req = createRequire(process.cwd() + "/");
  globalThis.__yosysModule = await import(pathToFileURL(req.resolve("@yowasp/yosys")).href);
  const Y = await import(E("yosys.worker.js")), I = await import(E("icarus.worker.js"));
  const { PROBLEMS } = await import(new URL("../../web/problems.js", import.meta.url));
  DESIGNS.tiny8.v = PROBLEMS.find((x) => x.id === "squeeze-tiny8").files["tiny8.v"];
  const nop = { log() {}, progress() {}, raw() {} };
  const models = fs.readFileSync(new URL("../../web/vendor/gf180mcu/sim-7b70722/gf180mcu_fd_sc_mcu7t5v0.sim.v", import.meta.url), "utf8");
  for (const [top, d] of Object.entries(DESIGNS)) {
    const dn = d.top || top, s = await Y.handle({ mode: "synth", files: { [dn + ".v"]: d.v }, options: { top: dn } }, nop);
    if (!s.ok) throw new Error("synth " + top);
    let nl = s.files["netlist.v"];
    if (d.bug) { const [from, to, pf, pt] = d.bug, re = new RegExp("(gf180mcu_fd_sc_mcu7t5v0__)" + from + "(_\\d+ \\S+ \\([^;]*?)\\." + pf + "\\("); if (!re.test(nl)) throw new Error("no " + from); nl = nl.replace(re, `$1${to}$2.${pt}(`); }
    const r = await glsRun({ files: { [dn + ".v"]: d.v, "tb.v": d.tb }, tb: "tb.v", netlist: nl, json: s.files["netlist.json"], models, sim: (f, o) => I.handle({ files: f, options: o }, nop) });
    if (!r.ok) throw new Error(top + ": " + r.summary.error);
    const dir = `${out}/${top}`; fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/${dn}.v`, d.v); fs.writeFileSync(`${dir}/tb.v`, d.tb); fs.writeFileSync(`${dir}/netlist.v`, nl); fs.writeFileSync(`${dir}/top`, dn);
    fs.writeFileSync(`${dir}/ours-rtl.vcd`, r.files["gls/rtl.vcd"]); fs.writeFileSync(`${dir}/ours-gate.vcd`, r.files["gls/gate.vcd"]);
    console.log(top, "cells", s.summary.cells, "| ours RTL vs gate in the page code:", r.summary.mismatches, "differ of", r.summary.compared, "| gate sim ms", r.summary.msGate);
  }
} else if (phase === "rtlgate") {   // our RTL run against our gate run (what the Studio stage shows)
  for (const top of Object.keys(DESIGNS)) {
    const d = diffVcd(fs.readFileSync(`${out}/${top}/ours-rtl.vcd`, "utf8"), fs.readFileSync(`${out}/${top}/ours-gate.vcd`, "utf8"));
    console.log(top, "compared", d.compared, "differ", d.mismatches);
    for (const r of d.rows) console.log("  ", r.name, "first at", r.firstT, "rtl", r.rtl, "gate", r.gate, "differs at", r.diffTimes, "times, ends equal:", r.endsEqual);
  }
} else if (phase === "compare") {
  const rows = [];
  for (const top of Object.keys(DESIGNS)) for (const k of ["rtl", "gate"]) {
    const a = parseVcd(fs.readFileSync(`${out}/${top}/ours-${k}.vcd`, "utf8")), b = parseVcd(fs.readFileSync(`${out}/${top}/native-${k}.vcd`, "utf8"));
    const d = diffVcd(a, b), changes = [...a.values()].reduce((n, s) => n + s.ch.length, 0);
    const onlyA = [...a.keys()].filter((n) => !b.has(n)).length, onlyB = [...b.keys()].filter((n) => !a.has(n)).length;
    const top1 = [...a.keys()].filter((n) => /^tb\.\w+$/.test(n) || /^tb\.dut\.\w+$/.test(n)).length;
    rows.push(`${top} ${k}: signals compared ${d.compared} (top-level ${top1}), value changes ${changes}, differ ${d.mismatches}, only-ours ${onlyA}, only-native ${onlyB}`);
    for (const r of d.rows.slice(0, 5)) rows.push(`   ${r.name} first at ${r.firstT}: ours ${r.rtl} native ${r.gate}`);
  }
  console.log(rows.join("\n"));
}
