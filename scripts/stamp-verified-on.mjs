// Stamps VERIFICATION_LOG-SEO-CONTENT.md entries with verified_on.
//   node scripts/stamp-verified-on.mjs                 -> entries lacking verified_on get TODAY (use after adding new entries)
//   node scripts/stamp-verified-on.mjs --git           -> lacking entries get the commit date of the last commit that touched their line (git blame);
//                                                          lines not committed yet get today; lines blamed to nothing fall back to the file's first commit date
// Existing verified_on tokens are never changed (idempotent), so re-running preserves history.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseEntries, stampAll, stampLine, fixTableHeaders } from './lib/log-dates.mjs';
const F = 'VERIFICATION_LOG-SEO-CONTENT.md';
const today = (process.env.STAMP_TODAY || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }));
let md = fs.readFileSync(F, 'utf8');
if (process.argv.includes('--git')) {
  const first = execFileSync('git', ['log', '--diff-filter=A', '--format=%ad', '--date=format:%Y-%m-%d', '--', F]).toString().trim().split('\n').pop();
  const blame = execFileSync('git', ['blame', '--line-porcelain', 'HEAD', '--', F], { maxBuffer: 1 << 28 }).toString().split('\n');
  const dates = []; let t = null, tz = null;
  for (const l of blame) {
    if (l.startsWith('author-time ')) t = +l.slice(12);
    else if (l.startsWith('author-tz ')) tz = l.slice(10);
    else if (l.startsWith('\t')) {
      const off = (tz[0] === '-' ? -1 : 1) * (+tz.slice(1, 3) * 60 + +tz.slice(3, 5));
      dates.push(new Date((t + off * 60) * 1000).toISOString().slice(0, 10));
    }
  }
  const L = fixTableHeaders(md).split('\n'); // header lines shift nothing (no line adds)
  let undatable = 0;
  for (const e of parseEntries(L.join('\n'))) if (!e.date) { const d = dates[e.line - 1]; if (!d) undatable++; L[e.line - 1] = stampLine(L[e.line - 1], e.kind, d || first || today); }
  md = L.join('\n');
  console.log('git backfill done; entries without determinable date (first-commit fallback): ' + undatable);
} else md = stampAll(md, today);
fs.writeFileSync(F, md);
const es = parseEntries(md);
console.log(`entries: ${es.length}; with verified_on: ${es.filter(e => e.date).length}`);
