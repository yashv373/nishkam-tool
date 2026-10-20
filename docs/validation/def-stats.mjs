// One parser for every flow: node docs/validation/def-stats.mjs a.def [b.def ...]
// Prints wire length (um, signal NETS only, power nets in SPECIALNETS are left out), via count, and cell counts by kind.
import { readFileSync } from "node:fs";
export function defStats(txt) {
  const dbu = +txt.match(/UNITS DISTANCE MICRONS (\d+)/)[1];
  const sec = (a, b) => { const i = txt.indexOf("\n" + a); const j = txt.indexOf(b, i); return i < 0 ? "" : txt.slice(i, j); };
  let wl = 0, vias = 0;
  for (const st of sec("NETS", "END NETS").split(/;\s*\n/)) {
    let px = null, py = null;
    for (const m of st.matchAll(/\(\s*(\*|-?\d+)\s+(\*|-?\d+)(?:\s+\d+)?\s*\)|\b([A-Za-z]\w*)\b/g)) {
      if (m[3] === undefined) {
        const x = m[1] === "*" ? px : +m[1], y = m[2] === "*" ? py : +m[2];
        if (px !== null) wl += Math.abs(x - px) + Math.abs(y - py);
        px = x; py = y;
      } else if (/^(NEW|ROUTED|FIXED|COVER|NOSHIELD|NETS|END|VERSION|RECT|TAPER|STYLE|USE|SIGNAL|CLOCK|POWER|GROUND|SOURCE|ORIGINAL|PROPERTY|DIST|TIMING|NETLIST|USER|WEIGHT|ESTCAP)$|^Metal\d$|^Poly|^COMP/.test(m[3])) { if (m[3] === "NEW") { px = py = null; } }
      else if (/^[Vv]ia/.test(m[3])) vias++;
    }
  }
  const kinds = {};
  for (const m of sec("COMPONENTS", "END COMPONENTS").matchAll(/^\s*-\s+\S+\s+(\S+)/gm)) {
    const c = m[1].replace(/^gf180mcu_fd_sc_mcu7t5v0__/, "");
    const k = /^(filltie|endcap)/.test(c) ? "tap/endcap" : /^fill_/.test(c) ? "filler" : /^clkbuf_/.test(c) ? "clkbuf" : /^buf_/.test(c) ? "buf" : /^(antenna|diode)/.test(c) ? "antenna" : "logic";
    kinds[k] = (kinds[k] || 0) + 1;
  }
  return { wireUm: +(wl / dbu).toFixed(0), vias, ...kinds };
}
if (process.argv[1]?.endsWith("def-stats.mjs")) for (const f of process.argv.slice(2)) console.log(f.split(/[\/]/).pop(), JSON.stringify(defStats(readFileSync(f, "utf8"))));
