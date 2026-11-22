// Feed Difetto's own .bench files (native-difetto/*.bench) to Studio's Quaigh 0.0.6 WASM, so both sides use the SAME .bench.
// Also simulate Difetto's native .tv with the WASM and compare to Difetto's native .au byte for byte.
// Usage (from a directory that has @yowasp/yosys@0.68.1207 in node_modules): node run-browser-on-difetto-bench.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(here, "../../..");
const req = createRequire(process.cwd() + "/");
globalThis.__yosysModule = await import(pathToFileURL(req.resolve("@yowasp/yosys")).href);
globalThis.fetch = async (u) => new Response(fs.readFileSync(new URL(u)));
const A = await import(pathToFileURL(path.join(repo, "web/studio/engines/atpg.worker.js")).href);
const nat = path.join(here, "native-difetto"), out = path.join(here, "browser-on-difetto-bench");
fs.mkdirSync(out, { recursive: true });
const rows = [];
for (const key of ["c17", "counter", "acc", "s27", "s298", "s344"]) {
  const bench = fs.readFileSync(path.join(nat, key + ".bench"), "utf8");
  const row = { key };
  try {
    const t0 = performance.now();
    const a = await A.runQuaigh(["atpg", "--output", "out.tv", "in.bench"], { "in.bench": bench });
    row.atpgMs = +(performance.now() - t0).toFixed(1);
    if (a.code !== 0) throw new Error(a.out.join("\n"));
    const so = a.out.join("\n");
    const f = A.faultsOf(so);
    Object.assign(row, { faultsDetected: f?.detected, faultsTotal: f?.total, coverage: A.coverageOf(so), patterns: A.patternsOf(a.files["out.tv"]).length });
    fs.writeFileSync(path.join(out, key + ".wasm.tv"), a.files["out.tv"]);
    // WASM sim of the NATIVE .tv vs native .au
    const s = await A.runQuaigh(["sim", "--output", "out.au", "--input", "n.tv", "in.bench"], { "in.bench": bench, "n.tv": fs.readFileSync(path.join(nat, key + ".tv")) });
    row.wasmSimOfNativeTvMatchesNativeAu = s.code === 0 && Buffer.from(s.files["out.au"]).equals(fs.readFileSync(path.join(nat, key + ".au")));
  } catch (e) { row.error = String(e.message || e).slice(0, 200); }
  rows.push(row); console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(rows, null, 2) + "\n");
