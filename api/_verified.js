// api/_verified.js — verified-citation allowlist lookup (built from VERIFICATION_LOG* by
// scripts/build-verified-citations.mjs). Shared by generate + checklist.
import fs from 'node:fs';

let VERIFIED = {};
try { VERIFIED = JSON.parse(fs.readFileSync(new URL('./_verified-citations.json', import.meta.url), 'utf8')); } catch { /* none: nothing is cited */ }

export const slugOf = v => String(v || '').trim().toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

export function verifiedFor(state, letterType) {
  const e = VERIFIED[slugOf(state)];
  if (!e) return { keys: [], entry: { display: [] } };
  const t = slugOf(letterType);
  const ordered = [...e.cites].sort((a, b) => (b.t.includes(t) ? 1 : 0) - (a.t.includes(t) ? 1 : 0));
  return { keys: e.cites.map(c => c.k), entry: { display: ordered.map(c => c.d) } };
}
