// Three-Gate v7 — Gate 2 (execution-based verify) for letter apps.
// A14: verified_on freshness (see scripts/check-verified-on.mjs).
// A1: required files present + package.json valid JSON.
// A9: citation-log parity — every statutory citation in src/App.jsx,
//     public/landing.html, landing.html, api/checklist.js must have a matching
//     entry in VERIFICATION_LOG.md (the citation identifier appears literally).
// Nonzero exit on any failure. Runs on pre-commit + GitHub Actions.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CITATION_FILES = ['src/App.jsx', 'public/landing.html', 'landing.html', 'api/checklist.js'];
const LOG = join(ROOT, 'VERIFICATION_LOG.md');

function fail(msg) { console.error('GATE RED — ' + msg); process.exit(1); }

// ── A1: required files ───────────────────────────────────────────────────────
for (const f of ['src/App.jsx', 'package.json']) if (!existsSync(join(ROOT, f))) fail('A1: missing ' + f);
try { JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')); } catch { fail('A1: package.json is not valid JSON'); }

// ── A9: citation-log parity ──────────────────────────────────────────────────
if (!existsSync(LOG)) fail('A9: VERIFICATION_LOG.md is missing');
const logNorm = readFileSync(LOG, 'utf8').replace(/\s+/g, '').toLowerCase();

let code = '';
for (const f of CITATION_FILES) { const p = join(ROOT, f); if (existsSync(p)) code += '\n' + readFileSync(p, 'utf8'); }

const tokens = new Set();
// section-symbol citations: §1954, §§5600-5615, §235-b, §92.0081, §27-2005 …
for (const m of code.matchAll(/§+\s*\d[0-9A-Za-z.\-]*/g)) {
  let t = m[0].replace(/\s+/g, '').replace(/[.\-]+$/, '');
  if (t.length > 1) tokens.add(t);
}
// CFR / U.S.C. citations: 42 U.S.C. §3604, 29 CFR §2560.503-1, 47 CFR §1.4000 …
for (const m of code.matchAll(/\b\d+\s+(?:U\.?\s?S\.?\s?C\.?|C?\.?\s?F\.?\s?R\.?)\s*§?\s*\d[0-9A-Za-z.\-]*/gi)) {
  tokens.add(m[0].replace(/\s+/g, ''));
}

const missing = [];
for (const t of tokens) if (!logNorm.includes(t.toLowerCase())) missing.push(t);

if (missing.length) {
  console.error('A9 FAIL — citations in code with no VERIFICATION_LOG.md entry (' + missing.length + '):');
  for (const m of [...missing].sort()) console.error('  ' + m);
  fail(missing.length + ' unlogged citation(s)');
}
// ── A10: letter citation lock — allowlist current + mock tests (no real codes/API) ──
import { execFileSync } from 'node:child_process';
for (const [label, args] of [['allowlist stale', ['scripts/build-verified-citations.mjs', '--check']], ['citelint/G4T mock tests failed', ['scripts/test-citelint.mjs']]]) {
  try { execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'pipe' }); } catch (e) { fail('A10: ' + label + ' ' + (e.stdout || '') + (e.stderr || '')); }
}
try { execFileSync(process.execPath, ['scripts/test-auth-gate.mjs'], { cwd: ROOT, stdio: 'pipe' }); } catch (e) { fail('A11: ' + (e.stdout || '') + (e.stderr || '')); }
try { execFileSync(process.execPath, ['scripts/test-lock-coverage.mjs'], { cwd: ROOT, stdio: 'pipe' }); } catch (e) { fail('A12: ' + (e.stdout || '') + (e.stderr || '')); }
// A14: verified_on freshness - every SEO-log entry dated; rendered/generator citations+figures backed by an entry <= 12 months old (warn > 10)
let a14Note = '';
for (const f of ['scripts/test-verified-on.mjs', 'scripts/check-verified-on.mjs']) {
  try { const o = execFileSync(process.execPath, [f], { cwd: ROOT, stdio: 'pipe' }); if (f.includes('check-')) a14Note = o.toString().trim(); }
  catch (e) { fail('A14: ' + (e.stdout || '') + (e.stderr || '')); }
}
// A15: no unlogged citation in ANY scripts/data source file (merged/unrendered included) + mock tests
for (const f of ['scripts/test-source-citations.mjs', 'scripts/check-source-citations.mjs']) {
  try { const o = execFileSync(process.execPath, [f], { cwd: ROOT, stdio: 'pipe' }); if (f.includes('check-')) a14Note += ' ' + o.toString().trim(); }
  catch (e) { fail('A15: ' + (e.stdout || '') + (e.stderr || '')); }
}
// A13: retrofit tests - Payhip mock, check-call, UI button wiring (Playwright; SKIPs loudly if no browser/playwright, fatal with UI_TEST_REQUIRED=1)
let uiNote = '';
for (const [label, file] of [['A17 checklist/generate truncation + per-type fallbacks', 'scripts/checklist-maxtokens.test.js'], ['A18 per-request time budget', 'scripts/time-budget.test.js'], ['A19 markdown strip + spelled-out figure lint', 'scripts/test-markdown-figures.mjs'], ['A13 payhip-mock', 'scripts/payhip-mock.test.js'], ['A13 isCheckCall', 'scripts/isCheckCall.test.js'], ['A13 ui-wiring', 'scripts/ui-wiring.test.mjs']]) {
  try {
    const out = execFileSync(process.execPath, [file], { cwd: ROOT, stdio: 'pipe', timeout: 170000 }).toString();
    if (/SKIP/.test(out)) uiNote = ' [' + out.trim().split(String.fromCharCode(10)).pop().trim() + ']';
  } catch (e) { fail(label + ': ' + (e.stdout || '') + (e.stderr || '') + (e.message || '')); }
}
console.log('GATE GREEN — A1 files ok; A10 citation lock ok; A11 no-Anthropic-without-license (+G4T checklist) ok; A12 lock coverage (checklist + templates) ok; A13 payhip-mock + isCheckCall + ui-wiring ok; A17 truncation/per-type fallback tests ok; A18 time budgets ok; A19 markdown/spelled figures ok; ' + a14Note + '' + uiNote + '; A9 citation-log parity: all ' + tokens.size + ' citations logged.');
process.exit(0);
