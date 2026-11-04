// Checklist + generate: truncation handling and per-letter-type content (mocked Anthropic + Payhip; no network).
//  - stop_reason "max_tokens" is never parsed/linted/returned: retried once with a higher limit, then fallback / 502
//  - every dispute type gets the model's items on success and its own fallback on forced failure
//  - fallback items carry no digits, no citations, no deadlines, no other-type or other-app wording
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.PAYHIP_API_KEY = 'x'; process.env.ANTHROPIC_API_KEY = 'x'; delete process.env.G4_TEST_CODE_SECRET;
const CODE = 'TF-MOCK-0001';  // a real-buyer code; Payhip is mocked below
const { default: checklist } = await import('../api/checklist.js');
const { default: generate } = await import('../api/generate.js');
const { TYPES, NEUTRAL, fallbackFor } = await import('../api/_checklist-fallbacks.js');
const { findUnverified } = await import('../api/_citelint.js');
const { DISPUTES } = await import('./data/disputes.js');

const TYPE_NAMES = Object.keys(TYPES);
const PRODUCT_LINK = 'Sry6P';
const realFetch = globalThis.fetch;
let calls, usage = 0;
function mockModel(replies) {
  calls = []; usage = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/license/verify')) return new Response(JSON.stringify({ data: { enabled: true, product_link: PRODUCT_LINK } }), { status: 200 });
    if (u.includes('/license/usage')) { usage++; return new Response('{}', { status: 200 }); }
    assert.ok(u.includes('api.anthropic.com'), 'unexpected fetch: ' + u);
    const body = JSON.parse(init.body); calls.push(body);
    const r = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (r.http) return new Response('boom', { status: r.http });
    return new Response(JSON.stringify({ stop_reason: r.stop || 'end_turn', content: [{ type: 'text', text: r.text }] }), { status: 200 });
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

function invoke(handler, body) {
  return new Promise(resolve => {
    const out = { code: 200 };
    const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(o) { out.body = o; resolve(out); return this; }, end() { resolve(out); return this; } };
    handler({ method: 'POST', body, headers: {} }, res);
  });
}
const callChecklist = (disputeType, state = 'Texas') => invoke(checklist, { accessCode: CODE, address: '1 Main St', state, appealType: 'property-tax-appeal', disputeType, letterExcerpt: 'excerpt' });
const callGenerate = body => invoke(generate, { accessCode: CODE, state: 'Texas', letterType: 'over-assessed-property-value', systemPrompt: 'sys', userPrompt: 'Write the letter.', ...body });
const modelItems = type => Array.from({ length: 8 }, (_, i) => `Model step ${i + 1} for ${type}: keep dated records and send copies by certified mail`);

// distinctive vocabulary per type: must not appear in any OTHER type's fallback
const OWN = {
  'homestead-exemption-denial': /homestead/i,
  'senior-tax-exemption-appeal': /senior|birth certificate/i,
  'veteran-tax-exemption-appeal': /veteran|military|discharge/i,
  'disability-tax-exemption-appeal': /disabilit|physician/i,
  'agricultural-use-valuation-appeal': /agricultur|farm|crop|livestock/i,
  'commercial-property-tax-appeal': /commercial|rent roll|vacancy/i,
  'property-tax-abatement-request': /abatement/i,
  'reassessment-after-damage': /damage/i,
};

test('every dispute type the site offers has a checklist entry', () => {
  assert.deepEqual([...TYPE_NAMES].sort(), DISPUTES.map(d => d.slug).sort());
});

for (const type of TYPE_NAMES) {
  test(`checklist model path returns the model's items: ${type}`, async () => {
    mockModel([{ text: JSON.stringify(modelItems(type)) }]);
    const r = await callChecklist(type);
    assert.equal(r.code, 200);
    assert.deepEqual(r.body.checklist, modelItems(type));
    assert.equal(r.body._diag, undefined, 'real buyers never see diagnostics');
    assert.ok(calls[0].messages[0].content.includes(TYPES[type].focus), 'prompt is built from this type focus');
    assert.equal(calls[0].max_tokens, 2000);
  });

  test(`forced model failure returns this type's own fallback: ${type}`, async () => {
    mockModel([{ http: 500 }]);
    const r = await callChecklist(type);
    assert.equal(r.code, 200);
    assert.deepEqual(r.body.checklist, fallbackFor(type));
    assert.equal(r.body._diag, undefined);
    assert.ok(r.body.checklist.length >= 8);
  });

  test(`fallback is verified-content-only and type-clean: ${type}`, () => {
    const items = fallbackFor(type), text = items.join('\n');
    assert.ok(TYPES[type].steps.length >= 4 && TYPES[type].steps.length <= 6);
    assert.ok(!/\d/.test(text), 'no digits at all (no amounts, percentages, days, deadlines, section numbers)');
    assert.ok(!/§|\bv\.\s|U\.S\.C|CFR|\bIRS\b|Publication|\bCode\b|Statute|ORC\b/.test(text), 'no citations');
    assert.deepEqual(findUnverified(text, [], { subs: {}, nums: [], input: '' }), [], 'lock finds nothing to strip');
    assert.ok(!/deposit|tenant|landlord|\blease\b|eviction|move-out/i.test(text), 'no other-domain wording');
    for (const [other, re] of Object.entries(OWN)) if (other !== type) assert.ok(!re.test(text), `${type} fallback contains ${other} wording`);
    if (OWN[type]) assert.ok(OWN[type].test(text), 'fallback is specific to its type');
  });
}

test('checklist: unknown or missing type gets the neutral list (also for old clients sending only appealType)', async () => {
  mockModel([{ http: 500 }]);
  for (const t of [undefined, 'something-else']) {
    const r = await callChecklist(t);
    assert.deepEqual(r.body.checklist, fallbackFor(undefined));
    assert.ok(NEUTRAL.steps.every(s => r.body.checklist.includes(s)));
    assert.ok(!/\d|deposit|tenant/i.test(r.body.checklist.join(' ')));
  }
});

test('checklist: truncated once is retried with a higher limit and the partial is never parsed', async () => {
  const partial = '["PARTIAL-ONLY item one", "PARTIAL-ONLY item two", "PARTIAL-ONLY item three", "PARTIAL-ONLY item f';
  mockModel([{ stop: 'max_tokens', text: partial }, { text: JSON.stringify(modelItems('commercial-property-tax-appeal')) }]);
  const r = await callChecklist('commercial-property-tax-appeal');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].max_tokens, 2000); assert.equal(calls[1].max_tokens, 4000);
  assert.deepEqual(r.body.checklist, modelItems('commercial-property-tax-appeal'));
  assert.ok(!JSON.stringify(r.body).includes('PARTIAL-ONLY'));
});

test('checklist: truncated twice falls back to the type list and never uses partial output', async () => {
  const partial = '["PARTIAL-ONLY one", "PARTIAL-ONLY two", "PARTIAL-ONLY three", "PARTIAL-ONLY four"]';  // even a parseable body is ignored when truncated
  mockModel([{ stop: 'max_tokens', text: partial }]);
  const r = await callChecklist('reassessment-after-damage');
  assert.equal(r.code, 200);
  assert.equal(calls.length, 2, 'exactly one retry');
  assert.deepEqual(r.body.checklist, fallbackFor('reassessment-after-damage'));
  assert.ok(!JSON.stringify(r.body).includes('PARTIAL-ONLY'));
});

test('checklist: unparseable reply, and fewer than three surviving items, fall back with HTTP 200', async () => {
  mockModel([{ text: 'not json at all' }]);
  let r = await callChecklist('homestead-exemption-denial');
  assert.equal(r.code, 200); assert.deepEqual(r.body.checklist, fallbackFor('homestead-exemption-denial'));
  mockModel([{ text: JSON.stringify(['one', 'two']) }]);
  r = await callChecklist('homestead-exemption-denial');
  assert.deepEqual(r.body.checklist, fallbackFor('homestead-exemption-denial'));
});

test('checklist: the citation lock still strips a fabricated cite from model items', async () => {
  const items = [...modelItems('over-assessed-property-value'), 'File under Tex. Tax Code § 99.999 right away'];
  mockModel([{ text: JSON.stringify(items) }]);
  const r = await callChecklist('over-assessed-property-value');
  assert.ok(!JSON.stringify(r.body).includes('99.999'));
  assert.ok(r.body.checklist.length >= 8);
});

test('generate: truncated letter is retried once with a higher limit, then the full letter is used', async () => {
  const letter = 'Dear Assessor, I appeal my assessment. '.repeat(10);
  mockModel([{ stop: 'max_tokens', text: 'HALF A LETTER' }, { text: letter }]);
  const r = await callGenerate({});
  assert.equal(r.code, 200);
  assert.equal(calls[0].max_tokens, 3000); assert.equal(calls[1].max_tokens, 6000);
  assert.equal(r.body.text, letter.trim());  // output is whitespace-trimmed by stripMarkdown
  assert.ok(!JSON.stringify(r.body).includes('HALF A LETTER'));
  assert.equal(usage, 1, 'the delivered letter marks the license used');
});

test('generate: truncated twice returns 502, never the partial letter, and the code is not burned', async () => {
  mockModel([{ stop: 'max_tokens', text: 'HALF A LETTER ' + 'x'.repeat(400) }]);
  const r = await callGenerate({});
  assert.equal(r.code, 502);
  assert.equal(calls.length, 2, 'exactly one retry');
  assert.ok(!JSON.stringify(r.body).includes('HALF A LETTER'));
  assert.equal(usage, 0, 'the license is NOT marked used when the letter was truncated');
});

test('generate: review mode is covered by the same truncation handling', async () => {
  mockModel([{ stop: 'max_tokens', text: 'HALF' }]);
  const r = await callGenerate({ reviewMode: true, draftLetter: 'A draft letter.' });
  assert.equal(r.code, 502); assert.equal(usage, 0); assert.equal(calls.length, 2);
});
