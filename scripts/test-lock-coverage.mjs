// A12: citation lock coverage beyond generate.js — (1) api/checklist.js lints its output,
// (2) every citation hard-coded in client/api templates is in the verified set.
// Stubbed fetch only: no real codes, no Anthropic/Payhip calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../api/checklist.js';
import { citations } from '../api/_citelint.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REAL = 'Tex. Tax Code § 41.44';
const FAKE = 'Tex. Tax Code § 99.999';
const FAKECASE = 'Smith v. Imaginary County Appraisal District';

// ── 1. checklist output is linted ──
let anth;
function stub(responder) {
  anth = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.includes('/license/verify')) return new Response(JSON.stringify({ data: { enabled: true, product_link: 'Sry6P' } }), { status: 200 });
    anth.push(JSON.parse(opts.body));
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(responder(anth.length)) }] }), { status: 200 });
  };
}
async function call(body) {
  let status, json;
  const res = { setHeader() {}, status(c) { status = c; return this; }, json(j) { json = j; return this; }, end() { return this; } };
  await handler({ method: 'POST', body: { accessCode: 'MOCK', address: '1 Main', state: 'Texas', ...body } }, res);
  return { status, json };
}
process.env.PAYHIP_API_KEY = 'x'; process.env.ANTHROPIC_API_KEY = 'y';
const lines = []; const origLog = console.log; console.log = (...a) => lines.push(a.join(' '));

stub(n => n === 1 ? [`File your protest under ${FAKE}`, `Protest deadline per ${REAL}`, 'Photos'] : [`Protest deadline per ${REAL}`, 'Photos']);
let r = await call({});
assert.equal(r.status, 200); assert.equal(anth.length, 2, 'should regenerate once');
assert.ok(anth[0].system.includes('VERIFIED AUTHORITIES') && anth[0].system.includes('41.44'), 'prompt lacks verified list');
assert.ok(!JSON.stringify(r.json).includes('99.999') && JSON.stringify(r.json).includes('41.44'), 'regen result wrong');

stub(() => [`Cite ${FAKECASE} at hearing`, `Per ${FAKE}, file early. Bring photos.`, `Deadline per ${REAL}`]);
r = await call({});
const out = JSON.stringify(r.json);
assert.equal(anth.length, 2);
assert.ok(!/Imaginary|99\.999/.test(out) && out.includes('41.44') && out.includes('Bring photos'), 'strip wrong: ' + out);

stub(() => ['Photos', 'Certified mail receipt']);
r = await call({}); assert.equal(anth.length, 1, 'clean checklist must be a single call'); assert.equal(r.json.checklist.length, 2);

stub(() => [`Deadline per ${REAL}`]);
r = await call({ state: undefined }); assert.ok(!JSON.stringify(r.json).includes('41.44'), 'unknown state: every citation must be removed');

const logs = lines.filter(l => l.includes('citelint')).join('\n');
assert.ok(logs.includes('S:99.999') && !logs.includes('Photos'), 'log must hold citation strings only');
console.log = origLog;

// ── 2. templates: every hard-coded citation must be in the verified set ──
const VERIFIED = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/_verified-citations.json'), 'utf8'));
const allKeys = new Set(Object.values(VERIFIED).flatMap(e => e.cites.map(c => c.k)));
export function unverifiedIn(text) { return [...citations(text)].filter(([k]) => !allKeys.has(k)).map(([k, s]) => `${k} (${s})`); }
const files = ['src/App.jsx', 'src/main.jsx', 'api/checklist.js', 'api/generate.js'];
const offenders = files.flatMap(f => unverifiedIn(fs.readFileSync(path.join(ROOT, f), 'utf8')).map(o => `${f}: ${o}`));
if (offenders.length) { console.error('A12 FAIL: unverified citations hard-coded in templates:\n  ' + offenders.join('\n  ')); process.exit(1); }
// the check itself must catch an injected fake
assert.ok(unverifiedIn(`const t = "per ${FAKE}";`).length === 1, 'template check missed an injected fake');
assert.ok(unverifiedIn(`const t = "per ${FAKECASE}";`).length === 1, 'template check missed an injected fake case');
console.log('A12 ok: checklist lint (regen/strip/clean/unknown-state/log) + template citations all verified (' + files.length + ' files)');
