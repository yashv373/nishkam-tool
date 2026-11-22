// Run Studio's Scan + ATPG engine (atpg.worker.js + dft-core.js + Quaigh 0.0.6 WASM) on the validation designs.
// Usage (from a directory that has @yowasp/yosys@0.68.1207 in node_modules):
//   node <repo>/docs/validation/dft/run-browser.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const designsDir = path.join(here, "designs");
const outDir = path.join(here, "browser");
fs.mkdirSync(outDir, { recursive: true });

const req = createRequire(process.cwd() + "/");
globalThis.__yosysModule = await import(pathToFileURL(req.resolve("@yowasp/yosys")).href);
globalThis.fetch = async (u) => new Response(fs.readFileSync(new URL(u)));

const A = await import(pathToFileURL(path.join(repo, "web/studio/engines/atpg.worker.js")).href);
const nop = { log() {}, progress() {}, raw() {} };

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function timeQuaigh(benchText, runs = 3) {
  const atpgMs = [], simMs = [];
  let lastAtpg, lastSim;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    lastAtpg = await A.runQuaigh(["atpg", "--output", "out.tv", "in.bench"], { "in.bench": benchText });
    atpgMs.push(performance.now() - t0);
    if (lastAtpg.code !== 0) throw new Error("quaigh atpg failed: " + lastAtpg.out.join("\n"));
    const t1 = performance.now();
    lastSim = await A.runQuaigh(["sim", "--output", "out.au", "--input", "out.tv", "in.bench"], {
      "in.bench": benchText,
      "out.tv": lastAtpg.files["out.tv"],
    });
    simMs.push(performance.now() - t1);
    if (lastSim.code !== 0) throw new Error("quaigh sim failed: " + lastSim.out.join("\n"));
  }
  const stdout = lastAtpg.out.join("\n");
  return {
    atpgMs: +median(atpgMs).toFixed(2),
    simMs: +median(simMs).toFixed(2),
    atpgRunsMs: atpgMs.map((x) => +x.toFixed(2)),
    simRunsMs: simMs.map((x) => +x.toFixed(2)),
    coverage: A.coverageOf(stdout),
    faults: A.faultsOf(stdout),
    patterns: A.patternsOf(lastAtpg.files["out.tv"]).length,
    tv: lastAtpg.files["out.tv"],
    au: lastSim.files["out.au"],
    stdout,
  };
}

const results = [];

// 1. Direct c17.bench (matches atpg.selftest.mjs)
{
  const bench = fs.readFileSync(path.join(designsDir, "c17.bench"), "utf8");
  const q = await timeQuaigh(bench, 3);
  fs.writeFileSync(path.join(outDir, "c17_bench.bench"), bench);
  fs.writeFileSync(path.join(outDir, "c17_bench.wasm.tv"), q.tv);
  fs.writeFileSync(path.join(outDir, "c17_bench.wasm.au"), q.au);
  results.push({
    name: "c17 (bench)",
    key: "c17_bench",
    flops: 0,
    chainLength: 0,
    equivalenceProven: null,
    faultsDetected: q.faults?.detected ?? null,
    faultsTotal: q.faults?.total ?? null,
    coverage: q.coverage,
    patterns: q.patterns,
    crossCheckMismatches: null,
    handleMs: null,
    quaighAtpgMs: q.atpgMs,
    quaighSimMs: q.simMs,
  });
  console.log("c17 (bench):", q.coverage + "%", q.faults, "patterns:", q.patterns, "atpgMs:", q.atpgMs, "simMs:", q.simMs);
}

// 2. Full Studio handle() runs on RTL designs
const rtlCases = [
  { name: "c17 (RTL)", key: "c17", file: "c17.v", top: "c17" },
  { name: "counter", key: "counter", file: "counter.v", top: "counter" },
  { name: "acc", key: "acc", file: "acc.v", top: "acc" },
  { name: "s27", key: "s27", file: "s27.v", top: "s27" },
  { name: "s298", key: "s298", file: "s298.v", top: "s298" },
  { name: "s344", key: "s344", file: "s344.v", top: "s344" },
];

for (const c of rtlCases) {
  const src = fs.readFileSync(path.join(designsDir, c.file), "utf8");
  const t0 = performance.now();
  let r;
  try {
    r = await A.handle({ files: { [c.file]: src }, options: { top: c.top } }, nop);
  } catch (err) {
    const handleMs = +(performance.now() - t0).toFixed(1);
    console.error("CRASH", c.name, err.message);
    // Dump the .bench that caused the crash for diagnostics
    try {
      const { yosys } = await import(pathToFileURL(path.join(repo, "web/studio/engines/yosys.worker.js")).href);
      const C = await import(pathToFileURL(path.join(repo, "web/studio/engines/dft-core.js")).href);
      const g = await yosys(C.genericScript([c.file], c.top), { [c.file]: src }, nop);
      const gen = JSON.parse(new TextDecoder().decode(g.fs["gen.json"]));
      const cut = C.cutToBench(gen, c.top);
      fs.writeFileSync(path.join(outDir, `${c.key}.crash.bench`), cut.text);
      console.error("  dumped", `${c.key}.crash.bench`);
    } catch (e2) { console.error("  dump failed:", e2.message); }
    results.push({ name: c.name, key: c.key, ok: false, crash: err.message, handleMs });
    continue;
  }
  const handleMs = +(performance.now() - t0).toFixed(1);
  if (!r.ok) {
    console.error("FAIL", c.name, r.summary);
    results.push({ name: c.name, key: c.key, ok: false, error: r.summary });
    continue;
  }
  const s = r.summary;
  const bench = r.files["dft/in.bench"];
  const q = await timeQuaigh(bench, 3);
  fs.writeFileSync(path.join(outDir, `${c.key}.bench`), bench);
  fs.writeFileSync(path.join(outDir, `${c.key}.wasm.tv`), r.files["dft/out.tv"]);
  fs.writeFileSync(path.join(outDir, `${c.key}.wasm.au`), r.files["dft/out.au"]);
  if (r.files["dft/scan.v"]) fs.writeFileSync(path.join(outDir, `${c.key}.scan.v`), r.files["dft/scan.v"]);
  if (r.files["dft/test_chain.py"]) fs.writeFileSync(path.join(outDir, `${c.key}.test_chain.py`), r.files["dft/test_chain.py"]);

  const row = {
    name: c.name,
    key: c.key,
    ok: true,
    flops: s.flops,
    chainLength: s.chain.length,
    chain: s.chain,
    equivalenceProven: s.equivalence?.checked ? s.equivalence.proven : null,
    faultsDetected: s.faults?.detected ?? null,
    faultsTotal: s.faults?.total ?? null,
    coverage: s.coverage,
    patterns: s.patterns,
    crossCheckRows: s.crossCheck?.rows ?? null,
    crossCheckMismatches: s.crossCheck?.mismatches ?? null,
    handleMs,
    quaighAtpgMs: q.atpgMs,
    quaighSimMs: q.simMs,
    benchInputs: s.inputs.length,
    benchOutputs: s.outputs.length,
    benchGates: bench.split("\n").filter((l) => l.includes("=")).length,
  };
  results.push(row);
  console.log(
    `${c.name}: flops=${row.flops} cov=${row.coverage}% faults=${row.faultsDetected}/${row.faultsTotal} ` +
      `patterns=${row.patterns} eq=${row.equivalenceProven} xchk=${row.crossCheckMismatches} ` +
      `handleMs=${row.handleMs} atpgMs=${row.quaighAtpgMs} simMs=${row.quaighSimMs}`
  );
}

fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(results, null, 2) + "\n");
console.log("Wrote", path.join(outDir, "summary.json"));
