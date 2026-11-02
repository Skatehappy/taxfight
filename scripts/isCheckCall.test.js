// The access-code "check call" (client sends systemPrompt "Reply: VALID"): server must answer VALID after a
// passing license check WITHOUT calling Anthropic, must still reject bad codes, and the client string must match.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/generate.js';

let anthropicCalls, payhip;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.includes('payhip.com') && u.includes('/license/verify')) return new Response(JSON.stringify({ data: { enabled: payhip.enabled, product_link: 'Sry6P' } }), { status: 200 });
  if (u.includes('payhip.com')) return new Response('{}', { status: 200 });
  anthropicCalls++;
  return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Dear Board.' }] }), { status: 200 });
};
async function call(body) {
  let status, json; const res = { setHeader() {}, status(c) { status = c; return this; }, json(j) { json = j; return this; }, end() { return this; } };
  await handler({ method: 'POST', body }, res); return { status, json };
}
process.env.PAYHIP_API_KEY = 'x'; process.env.ANTHROPIC_API_KEY = 'y'; delete process.env.G4_TEST_CODE_SECRET;

// client and server agree on the check string
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const m = app.match(/systemPrompt:\s*"([^"]+)",\s*userPrompt:\s*"VALIDATE"/);
assert.ok(m, 'client validateCode call not found'); assert.equal(m[1], 'Reply: VALID', 'client check string must equal the server isCheckCall string');

// valid code + check -> VALID, zero Anthropic calls
payhip = { enabled: true }; anthropicCalls = 0;
let r = await call({ accessCode: 'GOOD-CODE', systemPrompt: 'Reply: VALID', userPrompt: 'VALIDATE' });
assert.deepEqual([r.status, r.json.text, anthropicCalls], [200, 'VALID', 0]);

// invalid code + check -> 401, zero Anthropic calls (a check call is not a free pass)
payhip = { enabled: false }; anthropicCalls = 0;
r = await call({ accessCode: 'BAD-CODE', systemPrompt: 'Reply: VALID', userPrompt: 'VALIDATE' });
assert.deepEqual([r.status, anthropicCalls], [401, 0]);

// near-miss strings are NOT check calls: they are real generations (billed only after the license passes)
payhip = { enabled: true };
for (const s of ['Respond with only: VALID', 'reply: valid', 'Reply: VALID ', 'x']) {
  anthropicCalls = 0; r = await call({ accessCode: 'GOOD-CODE', systemPrompt: s, userPrompt: 'write', state: 'Texas', letterType: 'x' });
  assert.equal(anthropicCalls, 1, `"${s}" must go through generation`); assert.notEqual(r.json && r.json.text, 'VALID');
}
// missing code -> 401 regardless of the check string
anthropicCalls = 0; r = await call({ systemPrompt: 'Reply: VALID' }); assert.deepEqual([r.status, anthropicCalls], [401, 0]);
console.log('isCheckCall: PASS');
