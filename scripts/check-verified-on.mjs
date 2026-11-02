// A14: verified_on freshness gate.
//  - every entry of VERIFICATION_LOG-SEO-CONTENT.md must carry `verified_on: YYYY-MM-DD`
//  - every citation/figure RENDERED on public/* or FED TO THE GENERATOR (api/_verified-citations.json) must map to a log entry
//    verified within 12 months (FAIL) ; > 10 months is a non-fatal WARNING. A target is backed by its NEWEST matching entry.
// Usage: node scripts/check-verified-on.mjs [--now YYYY-MM-DD]   (env CHECK_NOW also works)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEntries, parseHeadingBlocks, evaluate } from './lib/log-dates.mjs';
import { citations, figures } from '../api/_citelint.js';
import { keyInText } from './data/pending.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const strip = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&sect;|&#167;/g, '§');
function* walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) yield* walk(p); else yield p; } }

const figRe = fig => new RegExp(String.raw`(^|[^\d.$])` + fig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + String.raw`(?!\d)`);

// Pure, injectable core: { logMd, legacyMd, lock, pages:[{file,text}] , now:Date } -> { fail, warn, unmapped, entries, nTargets }
export function check({ logMd, legacyMd = '', lock = {}, pages = [], now }) {
  const entries = parseEntries(logMd);
  const dated = [...entries.filter(e => e.date), ...parseHeadingBlocks(legacyMd)];
  const targets = new Map(); // label -> { label, key|fig }
  const addCite = (k, where) => { const l = 'citation ' + k; if (!targets.has(l)) targets.set(l, { label: l + ' (' + where + ')', key: k }); };
  for (const [st, v] of Object.entries(lock)) {
    for (const c of v.cites || []) addCite(c.k, 'generator lock ' + st);
    for (const n of v.nums || []) { const l = 'figure ' + st + ' ' + n; targets.set(l, { label: l + ' (generator lock)', fig: n }); }
  }
  for (const p of pages) for (const [k] of citations(p.text)) addCite(k, p.file);
  const norm = new Map(dated.map(e => [e, e.text.replace(/,/g, '')]));
  const out = [];
  for (const t of targets.values()) {
    let ds;
    if (t.key) ds = dated.filter(e => keyInText(t.key, e.text)).map(e => e.date);
    else { const re = figRe(t.fig); ds = dated.filter(e => re.test(norm.get(e))).map(e => e.date); }
    out.push({ label: t.label, dates: ds });
  }
  return { ...evaluate(entries, out, now), entries, nTargets: out.length };
}

export function load(root = ROOT) {
  const rd = f => fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), 'utf8') : '';
  const pages = [];
  const pub = path.join(root, 'public');
  if (fs.existsSync(pub)) for (const f of walk(pub)) if (/\.html?$/i.test(f)) pages.push({ file: path.relative(root, f).replaceAll('\\', '/'), text: strip(fs.readFileSync(f, 'utf8')) });
  return { logMd: rd('VERIFICATION_LOG-SEO-CONTENT.md'), legacyMd: rd('VERIFICATION_LOG.md'), lock: JSON.parse(rd('api/_verified-citations.json') || '{}'), pages };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--now');
  const nowS = (i > 0 && process.argv[i + 1]) || process.env.CHECK_NOW || new Date().toISOString().slice(0, 10);
  const r = check({ ...load(), now: new Date(nowS + 'T00:00:00Z') });
  if (r.warn.length) { console.warn('A14 WARN (non-fatal) - verified_on older than 10 months (' + r.warn.length + '):'); r.warn.forEach(w => console.warn('  ' + w)); }
  if (r.fail.length) { console.error('A14 FAIL (' + r.fail.length + '):'); r.fail.slice(0, 60).forEach(w => console.error('  ' + w)); process.exit(1); }
  console.log(`A14 ok: ${r.entries.length} log entries all carry verified_on; ${r.nTargets} rendered/generator citations+figures checked (${r.unmapped.length} not mapped to an entry), ${r.warn.length} warnings`);
}
