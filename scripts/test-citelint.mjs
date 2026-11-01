// Mock test for the letter-generator citation lock (S7) and the G4T test code (S6).
// Stubs global fetch: no real Anthropic or Payhip calls, no real license codes.
import assert from 'node:assert/strict';
import handler from '../api/generate.js';

const REAL = 'Texas Tax Code § 41.44';
const FAKE = 'Tex. Tax Code § 99.999';
const FAKECASE = 'Smith v. Imaginary County Appraisal District';
let calls, anth;
function stub(responder) {
  calls = []; anth = [];
  globalThis.fetch = async (url, opts = {}) => {
    calls.push(String(url));
    if (String(url).includes('payhip.com') && String(url).includes('/license/verify')) return new Response(JSON.stringify({ data: { enabled: true, product_link: 'Sry6P', uses: 0 } }), { status: 200 });
    if (String(url).includes('payhip.com')) return new Response('{}', { status: 200 });
    const body = JSON.parse(opts.body);
    anth.push(body);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: responder(anth.length, body) }] }), { status: 200 });
  };
}
async function call(body, env = {}) {
  for (const [k, v] of Object.entries(env)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  let status, json;
  const res = { setHeader() {}, status(c) { status = c; return this; }, json(j) { json = j; return this; }, end() { return this; } };
  await handler({ method: 'POST', body }, res);
  return { status, json };
}
process.env.PAYHIP_API_KEY = 'test'; process.env.ANTHROPIC_API_KEY = 'test';
const base = { accessCode: 'MOCK-CODE', systemPrompt: 'sys', userPrompt: 'write', state: 'Texas', letterType: 'property-tax-assessment-appeal' };
const lines = [];
const origLog = console.log; console.log = (...a) => lines.push(a.join(' '));

// 1. fake citation -> regenerated once without it
stub(n => n === 1 ? `Dear Board,\nUnder ${FAKE} the value is wrong. Protest rights arise under ${REAL}.\nSincerely` : `Dear Board,\nProtest rights arise under ${REAL}.\nSincerely`);
let r = await call(base);
assert.equal(r.status, 200); assert.ok(!r.json.text.includes('99.999'), 'fake statute survived'); assert.ok(r.json.text.includes('41.44'));
assert.equal(anth.length, 2, 'should regenerate exactly once');
assert.ok(anth[0].system.includes('VERIFIED AUTHORITIES') && anth[0].system.includes('41.44'), 'prompt lacks verified list');
assert.ok(anth[1].system.includes('99.999'), 'regen instruction should name the bad cite');

// 2. fake persists after regen -> sentence stripped, real kept, headers kept
stub(() => `Dear Board,\nThe court held ${FAKECASE} controls. Protest rights arise under ${REAL}. The county also violated ${FAKE}.\nSincerely`);
r = await call(base);
assert.ok(!/Imaginary|99\.999/.test(r.json.text), 'fake survived strip'); assert.ok(r.json.text.includes('41.44') && r.json.text.includes('Dear Board') && r.json.text.includes('Sincerely'));
assert.equal(anth.length, 2);

// 3. clean letter -> single call, untouched
stub(() => `Dear Board,\nProtest rights arise under ${REAL}.`);
r = await call(base); assert.equal(anth.length, 1); assert.ok(r.json.text.includes(REAL));

// 4. unknown state -> nothing is verified, every citation removed
stub(() => `Dear Board,\nProtest under ${REAL}.\nPlease reduce the value.`);
r = await call({ ...base, state: undefined }); assert.ok(!r.json.text.includes('41.44') && r.json.text.includes('Please reduce'));

// 5. lint log has citation strings only, no letter text
const logs = lines.filter(l => l.includes('citelint')).join('\n');
assert.ok(logs.includes('S:99.999') && !logs.includes('Dear Board') && !logs.includes('Please reduce'), 'log must hold citations only');

// 6. real code still verified through Payhip and marked used
stub(() => 'Dear Board.'); r = await call(base);
assert.ok(calls.some(u => u.includes('/license/verify')) && calls.some(u => u.endsWith('/license/usage')));

// 7. G4T inert with no secret (falls to Payhip -> real check path; secret never accepted)
stub(() => 'Dear Board.'); r = await call({ ...base, accessCode: 'G4T-ANYTHING' }, { G4_TEST_CODE_SECRET: undefined });
assert.ok(calls.some(u => u.includes('/license/verify')), 'G4T must be inert when env unset');

// 8. G4T with secret: skips Payhip entirely, capped at 10/day
stub(() => 'Dear Board.');
for (let i = 1; i <= 10; i++) { r = await call({ ...base, accessCode: 'g4t-s3cret' }, { G4_TEST_CODE_SECRET: 'S3CRET' }); assert.equal(r.status, 200, 'use ' + i); }
assert.ok(!calls.some(u => u.includes('payhip.com')), 'G4T must not touch Payhip');
r = await call({ ...base, accessCode: 'G4T-S3CRET' }); assert.equal(r.status, 429, '11th use must be blocked');
r = await call({ ...base, accessCode: 'G4T-WRONG' }); assert.ok(r.status !== 200 || calls.some(u => u.includes('/license/verify')), 'wrong secret must not pass');
assert.equal(lines.filter(l => l.includes('g4t_use')).length, 10, 'each use logged');

console.log = origLog;
console.log('citelint + G4T mock tests: PASS');
