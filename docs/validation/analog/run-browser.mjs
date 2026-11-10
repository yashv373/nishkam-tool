// Runs the same decks as run-native.sh through the browser ngspice-46 WASM build, in Node.
// Usage: node docs/validation/analog/run-browser.mjs   -> writes browser/*.log, prints native-vs-browser results.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../../../', import.meta.url);
const here = new URL('./', import.meta.url);
const rd = (u) => fs.readFileSync(u);
const { default: create } = await import(new URL('web/vendor/ngspice/46/ngspice.js', root).href);
fs.mkdirSync(new URL('browser/', here), { recursive: true });
const decks = ['nmos_idvg', 'pmos_idvg', 'mirror', 'ota5t_ac', 'inv_tran'];
const init = 'set ngbehavior=hsa\nset ng_nomodcheck\nset num_threads=1\nset enable_noisy_r\n';
// ASCII raw -> {np, vars:[name], cols:[[values]]}; handles "idx v0" first line and one value per line after.
function parseRaw(t) {
  const L = t.split('\n');
  const np = +L.find(l => l.startsWith('No. Points')).split(':')[1];
  const i0 = L.indexOf('Variables:'), iv = L.indexOf('Values:');
  const names = L.slice(i0 + 1, iv).map(l => l.trim().split(/\s+/)[1]);
  const nums = [];
  for (const l of L.slice(iv + 1)) {
    const p = l.trim().split(/\s+/).filter(Boolean);
    if (p.length) nums.push(p[p.length - 1].split(',').map(Number));   // AC values are "re,im": keep both parts
  }
  const cols = names.map((_, k) => nums.filter((_, i) => i % names.length === k));
  return { np, names, cols };
}
// Negative control: PERTURB=deck:from:to edits that deck text in the browser run only (native stays as is).
const [pd, pfrom, pto] = (process.env.PERTURB || '::').split(':');
for (const d of decks) {
  let out = '';
  const m = await create({
    locateFile: (f) => fileURLToPath(new URL('web/vendor/ngspice/46/' + f, root)),
    print: s => { out += s + '\n'; }, printErr: s => { out += s + '\n'; },
  });
  const FS = m.FS;
  FS.mkdir('/models');
  FS.writeFile('/proc/meminfo', 'MemTotal:        2097152 kB\nMemFree:         1048576 kB\nMemAvailable:    1048576 kB\n');
  for (const f of ['design.ngspice', 'sm141064.ngspice', 'sm141064_mim.ngspice'])
    FS.writeFile('/models/' + f, rd(new URL('web/vendor/gf180mcu/models-7b70722/' + f, root)));
  FS.mkdirTree('/home/web_user');
  FS.writeFile('/home/web_user/.spiceinit', init);
  let deck = rd(new URL('decks/' + d + '.cir', here)).toString().replaceAll('/foss/pdks/gf180mcuD/libs.tech/ngspice/', '/models/');
  if (d === pd) deck = deck.replaceAll(pfrom, pto);
  FS.writeFile('/' + d + '.cir', deck);
  if (d === 'ota5t_ac') FS.writeFile('/ota5t.spice', rd(new URL('decks/ota5t.spice', here)));
  FS.chdir('/');
  const t = performance.now();
  m.callMain(['-b', '-o', `/${d}.log`, `/${d}.cir`]);
  const ms = performance.now() - t;
  const log = FS.readFile(`/${d}.log`, { encoding: 'utf8' });
  fs.writeFileSync(new URL(`browser/${d}.log`, here), log);
  let rel = '';
  if (FS.analyzePath(`/${d}.raw`).exists) {
    const b = FS.readFile(`/${d}.raw`, { encoding: 'utf8' });
    if (!pd) fs.writeFileSync(new URL(`browser/${d}.raw`, here), b);
    const a = parseRaw(rd(new URL(`native/${d}.raw`, here)).toString()), c = parseRaw(b);
    // per vector: max |diff| / max |native value| of THAT vector (current vectors are not hidden by a 3.3 V sweep axis)
    rel = `raw points ${a.np}/${c.np} (native/browser)`;
    a.cols.forEach((col, k) => {
      let mx = 0, sc = 0;
      const mag = (v) => Math.hypot(...v);   // |complex| or |real|
      col.forEach((x, i) => { const y = c.cols[k]?.[i]; sc = Math.max(sc, mag(x)); mx = Math.max(mx, !y || y.length !== x.length ? Infinity : Math.hypot(...x.map((xr, j) => xr - y[j]))); });
      rel += `
   ${a.names[k]}: max|diff|/max|value| = ${(mx / sc).toExponential(2)}`;
    });
  }
  console.log(`== ${d} (${ms.toFixed(0)} ms) ${rel}`);
  console.log(log.split('\n').filter(l => /=|SPARSE|KLU|Rows/.test(l)).join('\n'));
}
