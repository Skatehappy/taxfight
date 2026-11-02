// A15 mock tests: unlogged citation in any source file fails; logged one passes; JS comments ignored.
import assert from 'node:assert/strict';
import { scan } from './check-source-citations.mjs';
const log = '| Tex. Tax Code § 41.44 | VERIFIED | x | y | verified_on: 2026-11-02 |';
const ok = scan([{ file: 'scripts/data/generated/texas/a.json', text: '{"a":"Protest under Tex. Tax Code § 41.44."}' }], log);
assert.equal(ok.length, 0, 'logged citation passes');
const bad = scan([{ file: 'scripts/data/generated/texas/merged-unrendered.json', text: '{"a":"See Tex. Tax Code § 41.99 for relief."}' }], log);
assert.equal(bad.length, 1, 'unlogged citation in an unrendered/merged source fails'); assert.match(bad[0].file, /merged-unrendered/);
const js = scan([{ file: 'scripts/data/x.js', text: '// example Tex. Tax Code § 41.99\nexport const a = 1;' }], log);
assert.equal(js.length, 0, 'comments in .js ignored');
const js2 = scan([{ file: 'scripts/data/x.js', text: 'export const a = "Tex. Tax Code § 41.99";' }], log);
assert.equal(js2.length, 1, 'string data in .js is scanned');
console.log('source-citation mock tests: PASS (logged ok / unlogged fails / js comments ignored)');
