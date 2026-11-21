// Turns each plain deck (*.cir) into the exact deck the Analog Lab page runs (web/analog/control.js buildDeck), into page/.
// Native ngspice and the Node/WASM run both use page/*.cir, so all three sides run the same text.
import fs from 'node:fs';
import { buildDeck } from '../../../web/analog/control.js';
const here = new URL('./', import.meta.url);
fs.mkdirSync(new URL('page/', here), { recursive: true });
for (const f of fs.readdirSync(here).filter((f) => f.endsWith('.cir')))
  fs.writeFileSync(new URL('page/' + f, here), buildDeck(fs.readFileSync(new URL(f, here), 'utf8')).deck);
