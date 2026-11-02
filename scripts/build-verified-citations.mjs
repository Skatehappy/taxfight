// Builds api/_verified-citations.json: per state, every statute/regulation/case citation that
// survives the VERIFICATION_LOG hold-back (scripts/data/pending.js) on the published pages and
// state data, tagged with the dispute topics it appears under. The letter generator
// (api/generate.js) is only allowed to cite entries from this file.
// Run: node scripts/build-verified-citations.mjs   (also runs from `npm run generate:pages`)
import fs from 'fs';
import path from 'path';
import { holdBack } from './data/pending.js';
import { STATES } from './data/states.js';
import { citations, subsections, figures } from '../api/_citelint.js';
import { isMerged } from './data/merged.js';

const GEN = path.join('scripts', 'data', 'generated');
const SD = JSON.parse(fs.readFileSync(path.join('scripts', 'data', 'state-data.json'), 'utf8'));

function* leaves(v) {
  if (typeof v === 'string') yield v;
  else if (Array.isArray(v)) for (const x of v) yield* leaves(x);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* leaves(x);
}
// "§ 1603" -> "Cal. Rev. & Tax. Code § 1603": widen the match back to the start of its phrase.
function widen(text, sample) {
  const i = text.indexOf(sample);
  if (i < 0) return sample;
  const before = text.slice(Math.max(0, i - 45), i);
  const cut = Math.max(before.lastIndexOf('. '), before.lastIndexOf('; '), before.lastIndexOf(', '), before.lastIndexOf('('), before.lastIndexOf(': '));
  let d = (before.slice(cut < 0 ? 0 : cut + 2) + sample).replace(/^[\s,;:.)\]]+/, '');
  const w = d.split(/\s+/);
  while (w.length > 1 && /^[a-z]/.test(w[0])) w.shift(); // drop lowercase lead-in words ("under", partial words)
  return w.join(' ').replace(/[\s,;:.]+$/, '');
}

const out = {};
for (const st of STATES) {
  const cites = new Map(); // key -> { k, d, t:Set }
  const subs = new Map(); // key -> Set of verified subsection chains
  const nums = new Set(); // verified $ / % / day figures for this state
  const take = (value, topic) => {
    for (const text of leaves(value)) {
      for (const c of subsections(text)) { if (!subs.has(c.key)) subs.set(c.key, new Set()); subs.get(c.key).add(c.chain); }
      for (const f of figures(text)) nums.add(f);
      for (const [k, sample] of citations(text)) {
      const e = cites.get(k) || { k, d: widen(text, sample), t: new Set() };
      if (topic) e.t.add(topic);
      cites.set(k, e);
      }
    }
  };
  take(holdBack(st.slug, SD[st.abbr]), null);
  for (const f of fs.existsSync(path.join(GEN, st.slug)) ? fs.readdirSync(path.join(GEN, st.slug)) : []) {
    const topic = f.replace(/\.json$/, '');
    if (isMerged(st.slug, topic)) continue;
    take(holdBack(`${st.slug}/${topic}`, JSON.parse(fs.readFileSync(path.join(GEN, st.slug, f), 'utf8'))), topic);
  }
  out[st.slug] = { cites: [...cites.values()].map(e => ({ k: e.k, d: e.d, t: [...e.t].sort(), s: [...(subs.get(e.k) || [])].sort() })).sort((a, b) => a.k.localeCompare(b.k)), nums: [...nums].sort() };
}
const target = path.join('api', '_verified-citations.json');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== JSON.stringify(out)) { console.error('api/_verified-citations.json is stale - run node scripts/build-verified-citations.mjs'); process.exit(1); }
  console.log('api/_verified-citations.json is current'); process.exit(0);
}
fs.writeFileSync(target, JSON.stringify(out));
console.log('api/_verified-citations.json: ' + Object.entries(out).map(([s, v]) => `${s}=${v.cites.length}`).join(' '));
