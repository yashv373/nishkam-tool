// #191 B3: does adding source/drain diffusion (netlist.js diffusion()) change ring5 frequency and ota5t UGF, and does the browser ngspice match native with the same ad/as/pd/ps?
// node diffusion-check.mjs   writes diffusion/*.cir (the page deck, plain and with ad/as/pd/ps on every FET line) and runs them in the browser ngspice-46 WASM.
// Native side: run diffusion/*.cir in the iic-osic-tools image with ngspice-46 (same .spiceinit as run-native.sh, "write /" -> "write "), then compare tper / ugf / gain_dc.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDeck } from '../../../web/analog/control.js';
import { diffusion } from '../../../web/analog/netlist.js';
const root = new URL('../../../', import.meta.url), here = new URL('./', import.meta.url);
fs.mkdirSync(new URL('diffusion/', here), { recursive: true });
const withDiff = (t) => t.split('\n').map((l) => { const m = /^X\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+[np]fet_\w+\s+W=(\S+)/i.exec(l); return m ? l + ' ' + diffusion(m[1]).join(' ') : l; }).join('\n');
const decks = {};
for (const d of ['ring5', 'ota5t_tt']) {
  const t = buildDeck(fs.readFileSync(new URL(d + '.cir', here), 'utf8')).deck;
  decks[d + '_plain'] = t; decks[d + '_diff'] = withDiff(t);
}
const { default: create } = await import(new URL('web/vendor/ngspice/46/ngspice.js', root).href);
const init = 'set ngbehavior=hsa\nset ng_nomodcheck\nset num_threads=1\nset enable_noisy_r\n';
for (const [n, t] of Object.entries(decks)) {
  fs.writeFileSync(new URL(`diffusion/${n}.cir`, here), t);
  let txt = '';
  const m = await create({ locateFile: (f) => fileURLToPath(new URL('web/vendor/ngspice/46/' + f, root)), print: (s) => { txt += s + '\n'; }, printErr: (s) => { txt += s + '\n'; } });
  const FS = m.FS; FS.mkdir('/models');
  FS.writeFile('/proc/meminfo', 'MemTotal:        2097152 kB\nMemFree:         1048576 kB\nMemAvailable:    1048576 kB\n');
  for (const f of ['design.ngspice', 'sm141064.ngspice', 'sm141064_mim.ngspice']) FS.writeFile('/models/' + f, fs.readFileSync(new URL('web/vendor/gf180mcu/models-7b70722/' + f, root)));
  FS.writeFile('/.spiceinit', init); FS.mkdirTree('/home/web_user'); FS.writeFile('/home/web_user/.spiceinit', init);
  FS.writeFile('/run.cir', t.replace(/(?:[^\s"']*[\\/])?(design|sm141064_mim|sm141064)\.ngspice/g, '/models/$1.ngspice'));
  try { m.callMain(['-b', '-o', '/run.log', '/run.cir']); } catch { /* exit() */ }
  const log = FS.readFile('/run.log', { encoding: 'utf8' });
  console.log(n, 'browser', (log.match(/^(tper|ugf|gain_dc)\s*=\s*\S+/gm) || []).join('  '));
}
