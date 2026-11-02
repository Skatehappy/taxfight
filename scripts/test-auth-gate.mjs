// A11: no path to api.anthropic.com without a passed Payhip (or G4T, generate only) check.
// Static scan + behavioral test with stubbed fetch. No real codes, no network.
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bad = [];
const fail = m => bad.push(m);

// ── static ──
const BYPASS = [/SMOKE-TEST-d/i, /TEST_KEYS/, /TEST-2026/i];
for (const dir of ['api', 'src', 'scripts', 'public']) {
  const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]) : [];
  for (const f of walk(path.join(ROOT, dir))) {
    if (!/\.(js|mjs|jsx|html|json)$/.test(f) || /test-auth-gate\.mjs$/.test(f)) continue;
    const t = fs.readFileSync(f, 'utf8');
    for (const re of BYPASS) if (re.test(t)) fail(`bypass key pattern ${re} in ${path.relative(ROOT, f)}`);
  }
}
for (const f of fs.readdirSync(path.join(ROOT, 'api')).filter(n => n.endsWith('.js'))) {
  const t = fs.readFileSync(path.join(ROOT, 'api', f), 'utf8');
  const call = t.search(/fetch\(\s*['"`]https:\/\/api\.anthropic\.com/);
  const inFn = t.search(/function callClaude/);
  if (call < 0) continue;
  if (f === '_license.js') continue;
  const v = t.indexOf('verifyLicense(');
  if (!/from '\.\/_license\.js'/.test(t) || v < 0) fail(`api/${f} reaches api.anthropic.com but does not use verifyLicense`);
  else if (inFn < 0 && v > call) fail(`api/${f}: verifyLicense runs after the Anthropic call`);
}

// ── behavioral ──
let anthropicCalls = 0, payhip;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('api.anthropic.com')) { anthropicCalls++; return new Response(JSON.stringify({ content: [{ type: 'text', text: '["a"]' }] }), { status: 200 }); }
  if (u.includes('payhip.com/api/v1/license/verify')) return payhip(u);
  if (u.includes('payhip.com/api/v1/license/usage')) return new Response('{}', { status: 200 });
  throw new Error('unexpected fetch ' + u);
};
process.env.PAYHIP_API_KEY = 'x'; process.env.ANTHROPIC_API_KEY = 'y';
delete process.env.G4_TEST_CODE_SECRET; delete process.env.TEST_KEYS;
const PL = (fs.readFileSync(path.join(ROOT, 'api/generate.js'), 'utf8').match(/PRODUCT_LINK\s*=\s*'([^']+)'/) || [])[1];

const scenarios = [
  ['no code', '', () => new Response('{}', { status: 404 })],
  ['fake code / payhip 404', 'FAKE-0000', () => new Response('{}', { status: 404 })],
  ['payhip non-ok 500', 'FAKE-0000', () => new Response('{}', { status: 500 })],
  ['payhip down (throws)', 'FAKE-0000', () => { throw new Error('net'); }],
  ['payhip non-JSON', 'FAKE-0000', () => new Response('<html>', { status: 200 })],
  ['payhip disabled code', 'FAKE-0000', () => new Response(JSON.stringify({ data: { enabled: false, product_link: PL } }), { status: 200 })],
  ['payhip other product', 'FAKE-0000', () => new Response(JSON.stringify({ data: { enabled: true, product_link: 'zzzzz' } }), { status: 200 })],
  ['G4T- without secret set', 'G4T-ANYTHING', () => new Response('{}', { status: 404 })],
  ['old smoke-test key', 'SMOKE-TEST-2026-BAO', () => new Response('{}', { status: 404 })],
];

function nodeRes() {
  const r = { code: 200, body: null, setHeader() {}, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, end() { return r; } };
  return r;
}
const gen = (await import(pathToFileURL(path.join(ROOT, 'api/generate.js')))).default;
const chk = (await import(pathToFileURL(path.join(ROOT, 'api/checklist.js')))).default;
async function callGen(code, extra = {}) {
  const res = nodeRes();
  await gen({ method: 'POST', body: { accessCode: code, systemPrompt: 's', userPrompt: 'u', state: 'Arizona', ...extra } }, res);
  return res.code;
}
async function callChk(code) {
  const r = await chk(new Request('http://x/api/checklist', { method: 'POST', body: JSON.stringify({ accessCode: code, address: 'a', state: 'AZ' }) }));
  return r.status;
}
for (const [name, code, p] of scenarios) {
  payhip = p;
  for (const [ep, fn] of [['generate', callGen], ['checklist', callChk]]) {
    anthropicCalls = 0;
    const s = await fn(code);
    if (anthropicCalls) fail(`${ep}: Anthropic reached on "${name}"`);
    if (s !== 401 && s !== 503) fail(`${ep}: "${name}" returned ${s}, expected 401/503`);
  }
}
// missing Payhip key must fail closed
delete process.env.PAYHIP_API_KEY; payhip = () => new Response('{}', { status: 404 });
for (const [ep, fn] of [['generate', callGen], ['checklist', callChk]]) {
  anthropicCalls = 0; const s = await fn('FAKE-0000');
  if (anthropicCalls || s < 400) fail(`${ep}: no PAYHIP_API_KEY did not fail closed (${s})`);
}
process.env.PAYHIP_API_KEY = 'x';
// check call must not reach the model or mark usage
let usage = 0; const base = globalThis.fetch;
globalThis.fetch = (u, o) => { if (String(u).includes('license/usage')) usage++; return base(u, o); };
payhip = () => new Response(JSON.stringify({ data: { enabled: true, product_link: PL } }), { status: 200 });
anthropicCalls = 0; for (let i = 0; i < 3; i++) await callGen('REAL-CODE', { systemPrompt: 'Reply: VALID' });
if (anthropicCalls || usage) fail(`access check ran model (${anthropicCalls}) or marked usage (${usage})`);
// positive control: a passed check DOES reach Anthropic (proves the harness can see it)
anthropicCalls = 0; await callChk('REAL-CODE');
if (anthropicCalls !== 1) fail('control: valid code did not reach Anthropic on checklist (harness broken)');

if (bad.length) { console.error('A11 FAIL:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('A11 ok: ' + scenarios.length * 2 + ' deny scenarios + fail-closed + check-call + control');
