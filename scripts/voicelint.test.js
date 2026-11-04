// Owner-voice lint: letters are written and signed by the property owner. Banned attorney/counsel self-descriptions fail
// generation (one regeneration, then 502 with the access code NOT marked used). Mocked fetch only; no network, no real codes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PAYHIP_API_KEY = 'x'; process.env.ANTHROPIC_API_KEY = 'x'; delete process.env.G4_TEST_CODE_SECRET;
const { findVoiceViolation, OWNER_VOICE_RULE } = await import('../api/_voicelint.js');
const { default: generate } = await import('../api/generate.js');
const { default: checklist } = await import('../api/checklist.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULE_RE = /written and signed by the property owner in their own name \(\[Your Name\]\)\. Never describe the writer as an attorney, counsel, law firm, tax representative or agent and never sign for a client\./;

test('banned phrases are detected, with case / spacing / quote variants', () => {
  for (const t of ['Attorney for the Owner', 'ATTORNEY   FOR the owner', 'attorney\nfor', 'attorney for', 'John Smith, Esq.', 'John Smith Esq', 'ESQUIRE', 'counsel for the taxpayer', 'Counsel  For', 'on behalf of my client', 'On Behalf Of My  Client', 'This firm represents the owner', 'my client', 'our clients', 'Attorney at Law', 'Law Office of Smith', 'Law Offices of Smith', 'Attorneys for the owner'])
    assert.ok(findVoiceViolation(t), `should flag: ${JSON.stringify(t)}`);
});

test('legitimate owner text is not flagged', () => {
  for (const t of ['You may wish to consult an attorney.', "I may seek attorney's fees under the statute.", 'Attorney’s fees are recoverable.', 'I have not hired counsel.', 'The county’s counsel may respond.', 'A licensed property tax attorney can help', 'I am the sole owner and represent myself.', 'Sincerely,\n[Your Name]', 'The Esquimalt parcel', 'I spoke with the county attorney.', 'Many taxpayers hire property tax attorneys for this stage.', 'You may hire an attorney for the hearing.', 'I have not retained counsel for this appeal.'])
    assert.equal(findVoiceViolation(t), null, `should not flag: ${JSON.stringify(t)}`);
});

const realFetch = globalThis.fetch;
let marks, modelCalls;
function mockModel(texts) {
  marks = 0; modelCalls = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/license/verify')) return new Response(JSON.stringify({ data: { enabled: true, product_link: 'Sry6P' } }), { status: 200 });
    if (u.includes('/license/usage')) { marks++; return new Response('{}', { status: 200 }); }
    const body = JSON.parse(init.body); modelCalls.push(body);
    const text = texts[Math.min(modelCalls.length - 1, texts.length - 1)];
    return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text }] }), { status: 200 });
  };
}
async function run(handler, body) {
  const out = { code: 200 };
  const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(o) { out.body = o; return this; }, end() { return this; } };
  await handler({ method: 'POST', body, headers: {} }, res);
  return out;
}
const genBody = { accessCode: 'TF-MOCK', state: 'Texas', letterType: 'property-tax-assessment-appeal', systemPrompt: 'sys', userPrompt: 'Write the letter.' };
const BAD = 'Dear Board,\nSincerely,\nJane Doe, Attorney for the Owner';
const CLEAN = 'Dear Board,\nI request a reassessment.\nSincerely,\n[Your Name]';

test('generate: bad draft then clean regeneration -> clean letter, usage marked once, notice names the phrase', async () => {
  mockModel([BAD, CLEAN]);
  const r = await run(generate, genBody);
  globalThis.fetch = realFetch;
  assert.equal(r.code, 200); assert.equal(r.body.text, CLEAN);
  assert.equal(modelCalls.length, 2); assert.equal(marks, 1);
  assert.match(modelCalls[1].system, /Attorney for/);
  assert.match(modelCalls[0].system, RULE_RE);
});

test('generate: banned phrase twice -> 502, code NOT marked used, offending text never returned', async () => {
  mockModel([BAD]);
  const r = await run(generate, genBody);
  globalThis.fetch = realFetch;
  assert.equal(r.code, 502); assert.equal(marks, 0);
  assert.ok(!JSON.stringify(r.body).toLowerCase().includes('attorney for the owner'));
  assert.match(r.body.error, /not been used/);
});

test('generate: review mode is linted too', async () => {
  mockModel([BAD, BAD]);
  const r = await run(generate, { ...genBody, reviewMode: true, draftLetter: CLEAN });
  globalThis.fetch = realFetch;
  assert.equal(r.code, 502); assert.equal(marks, 0);
  assert.match(modelCalls[0].messages[0].content, /signed by the property owner/);
});

const items = n => JSON.stringify(Array.from({ length: 8 }, (_, i) => `Step ${i + 1} ${n}: keep dated copies and send by certified mail`));
const badItems = JSON.stringify([...JSON.parse(items('a')), 'Sign it as Jane Doe, Attorney for the Owner']);
const cBody = { accessCode: 'TF-MOCK', address: '1 Main St', state: 'Texas', appealType: 'property-tax-appeal', disputeType: 'property-tax-assessment-appeal', letterExcerpt: 'x' };

test('checklist: banned item then clean list -> clean list; banned twice -> safe fallback, never the bad text', async () => {
  mockModel([badItems, items('b')]);
  let r = await run(checklist, cBody);
  assert.equal(r.code, 200); assert.equal(modelCalls.length, 2);
  assert.ok(r.body.checklist.every(i => !findVoiceViolation(i)) && r.body.checklist[0].includes('Step 1 b'));
  mockModel([badItems]);
  r = await run(checklist, cBody);
  globalThis.fetch = realFetch;
  assert.equal(r.code, 200); assert.ok(r.body.checklist.length >= 3);
  assert.ok(r.body.checklist.every(i => !findVoiceViolation(i)));
});

function walk(d) { return fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]) : []; }

test('every prompt carries the user-signs rule; no banned phrase in prompts', () => {
  const t = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8');
  const sys = t.slice(t.indexOf('function buildSystemPrompt'), t.indexOf('function buildUserPrompt'));
  assert.match(sys, RULE_RE);
  assert.ok(!/\battorney\b/i.test(sys.replace(/Never describe[^.]*\./, '')), 'persona must not self-describe as an attorney');
  assert.equal(findVoiceViolation(sys), null);
  const usr = t.slice(t.indexOf('function buildUserPrompt'), t.indexOf('// ─── Main App'));
  assert.equal(findVoiceViolation(usr), null);
  assert.match(usr, /signed by the property owner/);
  assert.match(OWNER_VOICE_RULE, RULE_RE);
  assert.match(fs.readFileSync(path.join(ROOT, 'api/generate.js'), 'utf8'), /PLAIN_TEXT_RULE \+ OWNER_VOICE_RULE/);
  assert.match(fs.readFileSync(path.join(ROOT, 'api/checklist.js'), 'utf8'), /citationBlock\(entry\) \+ OWNER_VOICE_RULE/);
});

test('static samples, templates, api and generated pages contain no banned phrase', () => {
  const files = ['src', 'api', 'scripts/templates', 'scripts/data', 'public'].flatMap(d => walk(path.join(ROOT, d)))
    .filter(f => /\.(js|jsx|html|json|mjs)$/.test(f) && !/_voicelint\.js$/.test(f) && !/_verified-citations/.test(f));
  assert.ok(files.length > 50);
  const hits = files.filter(f => findVoiceViolation(fs.readFileSync(f, 'utf8'))).map(f => path.relative(ROOT, f));
  assert.deepEqual(hits, []);
});
