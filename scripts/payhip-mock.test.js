// Payhip license verification (api/_license.js) against a stubbed Payhip. No network, no real keys.
import assert from 'node:assert/strict';
import { verifyLicense } from '../api/_license.js';

const LINK = 'Sry6P';
let calls;
const stub = fn => { calls = []; globalThis.fetch = async (url, opts = {}) => { calls.push({ url: String(url), opts }); return fn(String(url), opts); }; };
const json = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

// 1. enabled + matching product -> ok; key sent to payhip.com only, api key as header, license key URL-encoded
stub(() => json(200, { data: { enabled: true, product_link: LINK, uses: 0 } }));
assert.deepEqual(await verifyLicense('  ABCD-1234 ', LINK, 'k'), { ok: true });
assert.ok(calls[0].url.startsWith('https://payhip.com/api/v1/license/verify?'), 'must call payhip.com verify');
assert.ok(calls[0].url.includes('license_key=ABCD-1234') && calls[0].opts.headers['payhip-api-key'] === 'k');

// 2. disabled license, wrong product, missing data, non-200 -> 401 (invalid)
for (const [label, resp] of [
  ['disabled', () => json(200, { data: { enabled: false, product_link: LINK } })],
  ['wrong product', () => json(200, { data: { enabled: true, product_link: 'OTHER' } })],
  ['no data', () => json(200, {})],
  ['404', () => json(404, { error: 'not found' })],
  ['500', () => json(500, 'boom')],
]) { stub(resp); const r = await verifyLicense('CODE', LINK, 'k'); assert.equal(r.ok, false, label); assert.equal(r.status, 401, label); }

// 3. outage (network error, non-JSON 200, abort) -> 503 transient, never "invalid"
stub(() => { throw new TypeError('fetch failed'); }); let r = await verifyLicense('CODE', LINK, 'k'); assert.deepEqual([r.ok, r.status], [false, 503]);
stub(() => json(200, '<html>maintenance</html>')); r = await verifyLicense('CODE', LINK, 'k'); assert.deepEqual([r.ok, r.status], [false, 503]);
stub((u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
const realSetTimeout = globalThis.setTimeout; globalThis.setTimeout = (fn, ms) => realSetTimeout(fn, ms > 1000 ? 5 : ms);
r = await verifyLicense('CODE', LINK, 'k'); globalThis.setTimeout = realSetTimeout;
assert.deepEqual([r.ok, r.status], [false, 503], 'timeout must be 503');

// 4. empty / whitespace key never reaches Payhip
for (const k of ['', '   ', undefined, null]) { stub(() => json(200, { data: { enabled: true, product_link: LINK } })); r = await verifyLicense(k, LINK, 'k'); assert.deepEqual([r.ok, r.status, calls.length], [false, 401, 0]); }

console.log('payhip-mock: PASS');
