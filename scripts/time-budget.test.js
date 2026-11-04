// Per-request time budget: with a slow / hanging mocked model (virtual time, no real waiting) NO /api path may run past
// the plan limit. generate (Node, maxDuration 60): worst case must stay <= 50s. checklist (maxDuration 30): model work <= 20s.
// Paths covered: draft, truncation retry, lint regeneration (taken / skipped), hanging model, slow checklist retry + regen.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.PAYHIP_API_KEY = 'x'; process.env.ANTHROPIC_API_KEY = 'x'; delete process.env.G4_TEST_CODE_SECRET;
const { default: generate, BUDGET: GB } = await import('../api/generate.js');
const { default: checklist, BUDGET: CB } = await import('../api/checklist.js');
const { fallbackFor } = await import('../api/_checklist-fallbacks.js');

const realFetch = globalThis.fetch;
const REAL = 'Texas Tax Code § 41.44', FAKE = 'Tex. Tax Code § 99.999';
let modelCalls;
// plan: array of { ms, stop?, text? }; ms = Infinity hangs until the request aborts it. Last entry repeats.
function mockModel(plan) {
  modelCalls = [];
  globalThis.fetch = (url, init) => {
    const u = String(url);
    if (u.includes('payhip.com') && u.includes('/license/verify')) return Promise.resolve(new Response(JSON.stringify({ data: { enabled: true, product_link: 'Sry6P' } }), { status: 200 }));
    if (u.includes('payhip.com')) return Promise.resolve(new Response('{}', { status: 200 }));
    const step = plan[Math.min(modelCalls.length, plan.length - 1)]; modelCalls.push(Date.now());
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException('aborted', 'AbortError'));
      if (init.signal?.aborted) return abort();
      let t;
      if (step.ms !== Infinity) t = setTimeout(() => resolve(new Response(JSON.stringify({ stop_reason: step.stop || 'end_turn', content: [{ type: 'text', text: step.text }] }), { status: 200 })), step.ms);
      init.signal?.addEventListener('abort', () => { clearTimeout(t); abort(); });
    });
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; mock.timers.reset(); });

async function timed(handler, body) {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const t0 = Date.now(); let done = false; const out = { code: 200 };
  const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(o) { out.body = o; done = true; return this; }, end() { done = true; return this; } };
  handler({ method: 'POST', body, headers: {} }, res).catch(e => { out.crash = e; done = true; });
  for (let i = 0; !done && i < 2000; i++) { mock.timers.tick(250); await new Promise(r => setImmediate(r)); }
  assert.ok(done, 'request never finished (an un-bounded path)');
  assert.ok(!out.crash, String(out.crash));
  out.elapsed = Date.now() - t0;
  mock.timers.reset();
  return out;
}
const gen = () => timed(generate, { accessCode: 'TF-MOCK', state: 'Texas', letterType: 'property-tax-assessment-appeal', systemPrompt: 'sys', userPrompt: 'Write the letter.' });
const chk = () => timed(checklist, { accessCode: 'TF-MOCK', address: '1 Main St', state: 'Texas', appealType: 'property-tax-appeal', disputeType: 'property-tax-assessment-appeal', letterExcerpt: 'x' });
const GEN_LIMIT = 50000, CHK_LIMIT = 20000;
const good = `Dear Board,\nProtest rights arise under ${REAL}.\nSincerely`;
const bad = `Dear Board,\nUnder ${FAKE} the value is wrong. Protest rights arise under ${REAL}.\nSincerely`;
const items = JSON.stringify(Array.from({ length: 8 }, (_, i) => `Step ${i + 1}: keep dated copies and send by certified mail`));
const badItems = JSON.stringify([...JSON.parse(items), `File under ${FAKE} right away`]);

test('budgets are inside the plan limits', () => {
  assert.ok(GB.MODEL_DEADLINE_MS + GB.USAGE_MARK_MS <= GEN_LIMIT);
  assert.ok(CB.MODEL_BUDGET_MS <= CHK_LIMIT);
});

test('generate: normal 23s letter succeeds with one model call', async () => {
  mockModel([{ ms: 23000, text: good }]);
  const r = await gen(); assert.equal(r.code, 200); assert.equal(modelCalls.length, 1); assert.ok(r.elapsed <= GEN_LIMIT);
});
test('generate: slow truncated draft (30s) skips the retry and fails cleanly under the limit', async () => {
  mockModel([{ ms: 30000, stop: 'max_tokens', text: 'partial' }]);
  const r = await gen(); assert.equal(r.code, 502); assert.equal(modelCalls.length, 1, 'no retry without time'); assert.ok(r.elapsed <= GEN_LIMIT, r.elapsed);
});
test('generate: truncation retry that fits is taken, then bounded by the deadline when it hangs', async () => {
  mockModel([{ ms: 15000, stop: 'max_tokens', text: 'partial' }, { ms: Infinity }]);
  const r = await gen(); assert.equal(r.code, 502); assert.equal(modelCalls.length, 2); assert.ok(r.elapsed <= GEN_LIMIT, r.elapsed);
  assert.ok(!JSON.stringify(r.body).includes('partial'));
});
test('generate: truncation retry that fits succeeds', async () => {
  mockModel([{ ms: 15000, stop: 'max_tokens', text: 'partial' }, { ms: 20000, text: good }]);
  const r = await gen(); assert.equal(r.code, 200); assert.equal(modelCalls.length, 2); assert.ok(r.elapsed <= GEN_LIMIT, r.elapsed);
});
test('generate: hanging model is aborted at the deadline', async () => {
  mockModel([{ ms: Infinity }]);
  const r = await gen(); assert.equal(r.code, 502); assert.ok(r.elapsed <= GEN_LIMIT, r.elapsed); assert.equal(r.body.detail, 'timeout');
});
test('generate: lint regeneration with no time left is skipped; unverified sentence stripped, one model call', async () => {
  mockModel([{ ms: 30000, text: bad }]);
  const r = await gen(); assert.equal(r.code, 200); assert.equal(modelCalls.length, 1);
  assert.ok(!r.body.text.includes('99.999') && r.body.text.includes('41.44')); assert.ok(r.elapsed <= GEN_LIMIT, r.elapsed);
});
test('generate: lint regeneration that starts but hangs is cut off at the deadline and falls back to stripping', async () => {
  mockModel([{ ms: 20000, text: bad }, { ms: Infinity }]);
  const r = await gen(); assert.equal(r.code, 200); assert.equal(modelCalls.length, 2);
  assert.ok(!r.body.text.includes('99.999')); assert.ok(r.elapsed <= GEN_LIMIT, r.elapsed);
});
test('generate: fast draft leaves time for a regeneration that fixes it', async () => {
  mockModel([{ ms: 10000, text: bad }, { ms: 15000, text: good }]);
  const r = await gen(); assert.equal(r.code, 200); assert.equal(modelCalls.length, 2); assert.equal(r.body.text, good); assert.ok(r.elapsed <= GEN_LIMIT);
});
test('generate: draft + truncation retry + regeneration can never chain past the limit (every call slow)', async () => {
  for (const ms of [5000, 12000, 20000, 25000, 40000]) for (const stop of ['end_turn', 'max_tokens']) {
    mockModel([{ ms, stop, text: bad }]);
    const r = await gen(); assert.ok(r.elapsed <= GEN_LIMIT, `ms=${ms} stop=${stop} took ${r.elapsed}`);
    assert.ok(!JSON.stringify(r.body).includes('99.999'));
  }
});

test('checklist: hanging model is aborted inside the model budget and the type fallback is served (HTTP 200)', async () => {
  mockModel([{ ms: Infinity }]);
  const r = await chk(); assert.equal(r.code, 200); assert.ok(r.elapsed <= CHK_LIMIT, r.elapsed);
  assert.deepEqual(r.body.checklist, fallbackFor('property-tax-assessment-appeal'));
});
test('checklist: slow truncated reply skips the retry (no time) and falls back', async () => {
  mockModel([{ ms: 14000, stop: 'max_tokens', text: '["partial"' }]);
  const r = await chk(); assert.equal(modelCalls.length, 1); assert.ok(r.elapsed <= CHK_LIMIT, r.elapsed);
  assert.deepEqual(r.body.checklist, fallbackFor('property-tax-assessment-appeal'));
});
test('checklist: fast truncation retry is taken; a hanging retry is cut at the budget', async () => {
  mockModel([{ ms: 5000, stop: 'max_tokens', text: '["partial"' }, { ms: Infinity }]);
  const r = await chk(); assert.equal(modelCalls.length, 2); assert.ok(r.elapsed <= CHK_LIMIT, r.elapsed);
  assert.deepEqual(r.body.checklist, fallbackFor('property-tax-assessment-appeal'));
});
test('checklist: slow first reply with a bad cite skips the regeneration and strips instead', async () => {
  mockModel([{ ms: 15000, text: badItems }]);
  const r = await chk(); assert.equal(modelCalls.length, 1); assert.ok(r.elapsed <= CHK_LIMIT, r.elapsed);
  assert.ok(!JSON.stringify(r.body).includes('99.999')); assert.ok(r.body.checklist.length >= 8);
});
test('checklist: fast first reply with a bad cite regenerates within the budget', async () => {
  mockModel([{ ms: 4000, text: badItems }, { ms: Infinity }]);
  const r = await chk(); assert.equal(modelCalls.length, 2); assert.ok(r.elapsed <= CHK_LIMIT, r.elapsed);
  assert.ok(!JSON.stringify(r.body).includes('99.999'));
});
test('checklist: every slow combination stays inside the model budget', async () => {
  for (const ms of [3000, 8000, 12000, 19000, 30000]) for (const text of [items, badItems]) for (const stop of ['end_turn', 'max_tokens']) {
    mockModel([{ ms, stop, text }]); const r = await chk();
    assert.ok(r.elapsed <= CHK_LIMIT, `ms=${ms} stop=${stop} took ${r.elapsed}`);
  }
});
