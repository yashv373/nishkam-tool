// node docs/validation/ctsdiff.mjs : browser CTS on tiny8 vs the native OpenROAD CTS DEF kept in web/studio/demo/35-openroad-cts.
// Writes docs/validation/img/cts-{native,browser}.svg and prints a component-by-component comparison.
import fs from "node:fs";
import { handle } from "../../web/studio/engines/cts.worker.js";
const U = (p) => new URL(p, import.meta.url);
const def = fs.readFileSync(U("../../web/studio/demo/34-openroad-detailedplacement/tiny8.def"));
const sdc = fs.readFileSync(U("../../web/studio/engines/cts.tiny8.sdc"), "utf8");
const r = await handle({ files: { "tiny8.def": def, "constraints.sdc": sdc }, options: { top: "tiny8" } }, { log() {}, progress() {} });
const mine = Buffer.from(r.files["tiny8.def"]).toString();
const native = fs.readFileSync(U("../../web/studio/demo/35-openroad-cts/tiny8.def"), "utf8");
const comps = (t) => { const m = new Map(); const s = t.split("COMPONENTS")[1].split("END COMPONENTS")[0]; for (const x of s.split(";")) { const y = x.match(/-\s+(\S+)\s+(\S+)[\s\S]*?\(\s*(-?\d+)\s+(-?\d+)\s*\)\s+(\w+)/); if (y) m.set(y[1], [y[2], +y[3], +y[4], y[5]]); } return m; };
const a = comps(native), b = comps(mine);
let same = 0, diff = 0, only = 0;
for (const [k, v] of a) { const w = b.get(k); if (!w) only++; else if (w.join() === v.join()) same++; else diff++; }
for (const k of b.keys()) if (!a.has(k)) only++;
const clk = (m) => [...m.values()].filter((v) => /clkbuf/.test(v[0])).length;
console.log(`components native ${a.size} browser ${b.size}; identical cell+position+orient ${same}; different ${diff}; only in one ${only}; clkbuf native ${clk(a)} browser ${clk(b)}`);
// DIEAREA may have any whitespace and an origin other than 0,0: take the first and last point (bounding box) and subtract the origin.
const dieText = native.match(/DIEAREA([^;]*);/);
if (!dieText) throw new Error("ctsdiff: no DIEAREA statement in the native DEF");
const pts = [...dieText[1].matchAll(/\(\s*(-?\d+)\s+(-?\d+)\s*\)/g)].map((m) => [+m[1], +m[2]]);
if (pts.length < 2) throw new Error("ctsdiff: DIEAREA has fewer than 2 points: " + dieText[1]);
const [X, Y] = [Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]))];
const svg = (m, t) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${X} ${Y}" width="560" height="560"><rect width="${X}" height="${Y}" fill="#111"/>` +
  [...m.values()].map(([c, x, y]) => `<rect x="${x}" y="${Y - y - 5000}" width="5000" height="5000" fill="${/clkbuf/.test(c) ? "#ff3b30" : /dff/.test(c) ? "#4a63ff" : "#555"}"/>`).join("") +
  `<text x="2000" y="9000" fill="#fff" font-size="9000" font-family="sans-serif">${t}</text></svg>`;
fs.mkdirSync(U("img/"), { recursive: true });
fs.writeFileSync(U("img/cts-native.svg"), svg(a, "native OpenROAD (red = clock buffers)"));
fs.writeFileSync(U("img/cts-browser.svg"), svg(b, "browser TritonCTS (red = clock buffers)"));
