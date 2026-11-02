// A14 mock tests: freshness policy for verified_on (no network, injectable now).
import assert from 'node:assert/strict';
import { check } from './check-verified-on.mjs';
import { parseEntries, stampAll } from './lib/log-dates.mjs';

const HDR = '| Citation | Status | What | Source | Verified |\n|---|---|---|---|---|\n';
const log = d => HDR + `| Tex. Tax Code § 41.44 | VERIFIED | Protest by May 15. $140,000 exemption. | Official: x |${d ? ' verified_on: ' + d + ' |' : ''}\n`;
const lock = { texas: { cites: [{ k: 'S:41.44', d: 'Tex. Tax Code § 41.44', t: [], s: [] }], nums: ['$140000'] } };
const now = new Date('2026-11-01T00:00:00Z');
const run = (d, extra = {}) => check({ logMd: log(d), lock, pages: [], now, ...extra });

// fresh
let r = run('2026-10-01'); assert.deepEqual([r.fail, r.warn], [[], []]);
assert.equal(r.nTargets, 2, 'citation + figure both checked');
// 10-month warn (non-fatal)
r = run('2025-12-15'); assert.equal(r.fail.length, 0); assert.equal(r.warn.length, 2, JSON.stringify(r));
// 13-month fail
r = run('2025-09-15'); assert.equal(r.fail.length, 2); assert.match(r.fail[0], /older than 12 months/);
// missing date fails
r = run(null); assert.ok(r.fail.some(f => /no verified_on/.test(f)));
// future date is invalid
r = run('2027-01-01'); assert.ok(r.fail.some(f => /future/.test(f)));
// rendered page citation maps to the stale entry -> fail; newest of several entries wins
r = check({ logMd: log('2025-09-15'), lock: {}, pages: [{ file: 'public/x.html', text: 'See Tex. Tax Code § 41.44 for protest.' }], now });
assert.equal(r.fail.length, 1); assert.match(r.fail[0], /public\/x\.html/);
r = check({ logMd: log('2025-09-15') + `| Tex. Tax Code § 41.44 | RE-VERIFIED | again $140,000 | Official: y | verified_on: 2026-10-20 |\n`, lock, pages: [], now });
assert.deepEqual(r.fail, [], 'a fresh re-verification backs the citation');
// STRICT: unmapped citation on a page FAILS (never skipped)
r = check({ logMd: log('2026-10-01'), lock: {}, pages: [{ file: 'public/y.html', text: 'See Tex. Tax Code § 41.99 for relief.' }], now });
assert.ok(r.fail.some(f => /UNMAPPED/.test(f) && /41.99/.test(f)), 'unmapped citation must fail: ' + JSON.stringify(r.fail));
// STRICT: unmapped dollar / percent / day figures (page or generator lock) FAIL
r = check({ logMd: log('2026-10-01'), lock: { texas: { cites: [], nums: ['$777', '45d', '8%'] } }, pages: [{ file: 'public/z.html', text: 'The fee is $999 and you have 17 days; rate 4.5%.' }], now });
for (const x of ['$777', '45d', '8%', '$999', '17d', '4.5%']) assert.ok(r.fail.some(f => f.includes('UNMAPPED') && f.includes(x)), 'unmapped figure ' + x + ' must fail');
// mapped figure on a page passes (days written as "N days" in the log map to Nd)
r = check({ logMd: log('2026-10-01') + '| x | VERIFIED | 30 days and 5% | y | verified_on: 2026-10-01 |\n', lock: {}, pages: [{ file: 'public/w.html', text: 'File within 30 days; 5 percent; $140,000.' }], now });
assert.deepEqual(r.fail, [], JSON.stringify(r.fail));
// stamping: new (undated) entries get today's date, existing dates are preserved
const stamped = stampAll(log(null) + `| § 11.13 | VERIFIED | x | y | verified_on: 2026-07-22 |\n- **Primary statute:** Foo\n  - [a] https://x.gov (retrieved 2026-07-22)\n    - desc\n`, '2026-11-01');
const ds = parseEntries(stamped).map(e => e.date);
assert.deepEqual(ds, ['2026-11-01', '2026-07-22', '2026-11-01', '2026-11-01']);
assert.equal(stampAll(stamped, '2030-01-01'), stamped, 'idempotent: never rewrites existing dates');
console.log('verified_on mock tests: PASS (strict unmapped citation+figure fail / fresh / 10-month warn / 13-month fail / missing fail / stamp+preserve)');
