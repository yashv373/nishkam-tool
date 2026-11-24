// node count-viewer.mjs <file.gds>   Per-layer polygon counts as Studio's 2D viewer parser flattens them (text labels not counted).
import { readFileSync } from "node:fs";
import { parseGds, topCells, hierDepth, flatten } from "../../../../web/studio/viewers/gds-parser.js";
const lib = parseGds(readFileSync(process.argv[2])), top = topCells(lib)[0];
const f = flatten(lib, top, hierDepth(lib, top));
console.log("top", top);
for (const [k, o] of [...f.layers].sort((a, b) => parseInt(a[0]) - parseInt(b[0]) || a[0].localeCompare(b[0]))) console.log("LAYER", k, "polys=" + o.n);
