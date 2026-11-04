// Marketing-claims gate (A20): no public page, template, JSON-LD, generator data or src marketing
// string may claim attorney/lawyer quality or imply the product gives legal advice.
// 'legal advice' is allowed ONLY inside a sentence that negates it (not/no/never/n't/does not/isn't).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

export const BANNED = /\b(?:attorney|lawyer)[\s\-]+(?:quality|grade|written|drafted)\b|\breal\s+lawyer\b/i;
const LEGAL_ADVICE = /legal\s+advice/ig;
const NEGATION = /\b(?:not|no|never|nor|cannot|without)\b|n['’]t\b/i;

export function scanText(text) {
  const hits = [];
  const lines = text.split('\n');
  lines.forEach((ln, i) => { if (BANNED.test(ln)) hits.push({ line: i + 1, why: 'banned phrase', text: ln.trim().slice(0, 140) }); });
  for (const m of text.matchAll(LEGAL_ADVICE)) {
    let s = m.index; while (s > 0 && !/[.!?\n]/.test(text[s - 1])) s--;
    let e = m.index + m[0].length; while (e < text.length && !/[.!?\n]/.test(text[e])) e++;
    const sentence = text.slice(s, e);
    if (!NEGATION.test(sentence)) {
      hits.push({ line: text.slice(0, m.index).split('\n').length, why: "'legal advice' outside a not/no disclaimer", text: sentence.trim().slice(0, 140) });
    }
  }
  return hits;
}

function walk(p, out) {
  if (!existsSync(p)) return;
  const st = statSync(p);
  if (st.isFile()) { if (/\.(html|js|jsx|mjs|json|md)$/.test(p)) out.push(p); return; }
  for (const f of readdirSync(p)) walk(join(p, f), out);
}

export function scanRepo(root) {
  const files = [];
  for (const t of ['public', 'scripts/templates', 'scripts/data', 'scripts/generate-content.js', 'src', 'api', 'index.html', 'landing.html']) walk(join(root, t), files);
  const bad = [];
  for (const f of files) for (const h of scanText(readFileSync(f, 'utf8'))) bad.push({ file: relative(root, f), ...h });
  return { count: files.length, bad };
}

if (process.argv[1] && process.argv[1].endsWith('check-claims.mjs')) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const { count, bad } = scanRepo(root);
  if (bad.length) { for (const b of bad) console.error(`${b.file}:${b.line} ${b.why}: ${b.text}`); console.error(`A20 FAIL - ${bad.length} banned marketing claim(s)`); process.exit(1); }
  console.log(`A20 marketing claims clean (${count} files)`);
}
