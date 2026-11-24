// Native LibreLane 3.0.2 Classic on tiny8 for sky130A or ihp-sg13g2 (container gf180, ONE job at a time).
//   node docs/validation/pdk-native.mjs <sky130A|ihp-sg13g2> <outdir>
// Copies config.json, flow.log, final metrics.json and every STA summary/corner report into <outdir>.
import { DESIGNS } from "../../web/studio/engines/pd.flow.mjs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { mkdirSync, writeFileSync, rmSync, cpSync, readdirSync, existsSync } from "node:fs";
const [pdk, out] = process.argv.slice(2), [top, src] = DESIGNS.tiny8;
const SCL = { "sky130A": "sky130_fd_sc_hd", "ihp-sg13g2": "sg13g2_stdcell" }[pdk], die = { "sky130A": 110, "ihp-sg13g2": 130 }[pdk];
const jid = `val_${pdk}_tiny8`, host = `${homedir().replaceAll("\\", "/")}/eda/designs/nishkam_jobs/${jid}`;
rmSync(host, { recursive: true, force: true }); mkdirSync(host, { recursive: true }); mkdirSync(out, { recursive: true });
writeFileSync(`${host}/${top}.v`, src);
const cfg = { meta: { version: 3, flow: "Classic" }, FP_SIZING: "absolute", DIE_AREA: [0, 0, die, die], CLOCK_PERIOD: 20, PL_TARGET_DENSITY_PCT: 50, DESIGN_NAME: top, CLOCK_PORT: "clk", VERILOG_FILES: [`dir::${top}.v`] };
if (pdk === "sky130A") Object.assign(cfg, { CTS_ROOT_BUFFER: "sky130_fd_sc_hd__clkbuf_16", CTS_CLK_BUFFERS: ["sky130_fd_sc_hd__clkbuf_8", "sky130_fd_sc_hd__clkbuf_4", "sky130_fd_sc_hd__clkbuf_2"] });
writeFileSync(`${host}/config.json`, JSON.stringify(cfg, null, 1)); writeFileSync(`${out}/config.json`, JSON.stringify(cfg, null, 1));
const t0 = Date.now();
const r = spawnSync("docker", ["exec", "-w", `/foss/designs/nishkam_jobs/${jid}`, "gf180", "bash", "-lc", `unset PDK STD_CELL_LIBRARY; librelane --version > version.txt 2>&1; timeout -k 5 1500 librelane --pdk ${pdk} --scl ${SCL} config.json --run-tag run > flow.log 2>&1`], { env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
console.log("rc", r.status, "seconds", (Date.now() - t0) / 1000);
for (const f of ["flow.log", "version.txt"]) if (existsSync(`${host}/${f}`)) cpSync(`${host}/${f}`, `${out}/${f}`);
const run = `${host}/runs/run`; if (existsSync(`${run}/final/metrics.json`)) cpSync(`${run}/final/metrics.json`, `${out}/metrics.json`);
if (existsSync(run)) for (const d of readdirSync(run)) if (/sta/.test(d) && existsSync(`${run}/${d}/summary.rpt`)) cpSync(`${run}/${d}/summary.rpt`, `${out}/${d}.summary.rpt`);
