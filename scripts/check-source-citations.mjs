// A15: no unlogged citation in ANY source file under scripts/data/** (merged, unrendered or rendered alike).
// A citation is "logged" when VERIFICATION_LOG.md / VERIFICATION_LOG-SEO-CONTENT.md contains it (same matcher as the page hold-back).
// Usage: node scripts/check-source-citations.mjs   (exit 1 on any unlogged citation)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { citations } from '../api/_citelint.js';
import { keyInText } from './data/pending.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
function* walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) yield* walk(p); else yield p; } }

// Pure core: files [{file,text}], logText -> [{file, key, sample}]
export function scan(files, logText) {
  const bad = [];
  const strip = (f) => /\.m?js$/i.test(f.file) ? f.text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1') : f.text;
  for (const f of files) for (const [key, sample] of citations(strip(f))) if (!keyInText(key, logText)) bad.push({ file: f.file, key, sample });
  return bad;
}
export function loadSources(root = ROOT) {
  const out = [], base = path.join(root, 'scripts', 'data');
  for (const p of walk(base)) if (/\.(json|js|mjs|md|html)$/i.test(p)) out.push({ file: path.relative(root, p).split(path.sep).join('/'), text: fs.readFileSync(p, 'utf8') });
  return out;
}
export function loadLog(root = ROOT) {
  return ['VERIFICATION_LOG.md', 'VERIFICATION_LOG-SEO-CONTENT.md'].map(f => path.join(root, f)).filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = loadSources(), bad = scan(files, loadLog());
  if (bad.length) { console.error('A15 FAIL - unlogged citations in source files (' + bad.length + '):'); bad.slice(0, 80).forEach(b => console.error('  ' + b.file + ' :: ' + b.sample)); process.exit(1); }
  console.log(`A15 ok: ${files.length} source files under scripts/data, 0 unlogged citations`);
}
