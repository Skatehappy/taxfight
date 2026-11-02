// verified_on support for VERIFICATION_LOG-SEO-CONTENT.md.
// Format (machine-readable): every ENTRY carries the token `verified_on: YYYY-MM-DD`.
//   entry kinds: (1) table row (token in an extra final cell, header column "Verified"),
//                (2) per-state "- **Primary statute:**" line,
//                (3) per-state source bullet "  - [topic] URL (retrieved D)" (token on that line).
// Also: VERIFICATION_LOG.md "### YYYY-MM-DD - title" blocks are read as dated entries (for citation mapping only).
export const TOKEN = /verified_on:\s*(\d{4}-\d{2}-\d{2})/;
const SEP = /^\|[\s:|-]+\|?\s*$/;

// -> [{ line (1-based), kind, text, date|null }]; headers/separators are not entries.
export function parseEntries(md) {
  const L = md.split(/\r?\n/), out = [];
  for (let i = 0; i < L.length; i++) {
    const s = L[i];
    if (/^\|/.test(s)) {
      if (SEP.test(s) || (L[i + 1] !== undefined && SEP.test(L[i + 1]))) continue; // separator or header
      out.push({ line: i + 1, kind: 'row', text: s, date: (s.match(TOKEN) || [])[1] || null });
    } else if (/^- \*\*Primary statute:\*\*/.test(s)) {
      out.push({ line: i + 1, kind: 'primary', text: s, date: (s.match(TOKEN) || [])[1] || null });
    } else if (/^\s+- \[[^\]]+\]\s+https?:\/\//.test(s)) {
      const t = s + (L[i + 1] && /^\s+- (?!\[)/.test(L[i + 1]) ? '\n' + L[i + 1] : '');
      out.push({ line: i + 1, kind: 'source', text: t, date: (s.match(TOKEN) || [])[1] || null });
    }
  }
  return out;
}
// Dated blocks of the legacy VERIFICATION_LOG.md ("### 2026-07-19 - title")
export function parseHeadingBlocks(md) {
  const parts = md.split(/^(?=### \d{4}-\d{2}-\d{2})/m).filter(b => /^### \d{4}-\d{2}-\d{2}/.test(b));
  return parts.map(b => ({ kind: 'block', text: b, date: b.match(/^### (\d{4}-\d{2}-\d{2})/)[1] }));
}
// Stamp one entry line with a date (idempotent: never overwrites an existing token).
export function stampLine(line, kind, date) {
  if (TOKEN.test(line)) return line;
  const tok = 'verified_on: ' + date;
  return kind === 'row' ? line.replace(/\s*\|?\s*$/, '') + ' | ' + tok + ' |' : line + ' ' + tok;
}
// Add the column header/separator to tables once.
export function fixTableHeaders(md) {
  const L = md.split(/\r?\n/);
  for (let i = 0; i < L.length - 1; i++) {
    if (/^\|/.test(L[i]) && SEP.test(L[i + 1]) && !/verified/i.test(L[i])) {
      L[i] = L[i].replace(/\s*\|?\s*$/, '') + ' | Verified |';
      L[i + 1] = L[i + 1].replace(/\s*\|?\s*$/, '') + '|---|';
    }
  }
  return L.join('\n');
}
export function stampAll(md, date) {
  const L = fixTableHeaders(md).split('\n');
  const ents = parseEntries(L.join('\n'));
  for (const e of ents) if (!e.date) L[e.line - 1] = stampLine(L[e.line - 1], e.kind, date);
  return L.join('\n');
}

// ---- age evaluation -------------------------------------------------------
const iso = d => d.toISOString().slice(0, 10);
export function monthsAgo(now, n) { const d = new Date(now.getTime()); d.setUTCMonth(d.getUTCMonth() - n); return iso(d); }
// targets: [{ label, dates: [verified_on of every log entry that backs it] }]
// -> { fail:[], warn:[], unmapped:[] }. A target is backed by its NEWEST entry.
export function evaluate(entries, targets, now) {
  const missing = entries.filter(e => !e.date).map(e => `line ${e.line}: ${e.kind} entry has no verified_on`);
  const bad = entries.filter(e => e.date && (isNaN(Date.parse(e.date)) || e.date > iso(now))).map(e => `line ${e.line}: invalid or future verified_on ${e.date}`);
  const c12 = monthsAgo(now, 12), c10 = monthsAgo(now, 10);
  const fail = [...missing, ...bad], warn = [], unmapped = [];
  for (const t of targets) {
    if (!t.dates.length) { unmapped.push(t.label); continue; }
    const newest = t.dates.slice().sort().at(-1);
    if (newest < c12) fail.push(`${t.label}: newest backing entry verified ${newest} (older than 12 months, cutoff ${c12})`);
    else if (newest < c10) warn.push(`${t.label}: newest backing entry verified ${newest} (older than 10 months, cutoff ${c10})`);
  }
  return { fail, warn, unmapped };
}
