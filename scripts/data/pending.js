// Verified-citations-only rule (2026-11-01): at build time every sentence that cites a
// statute, regulation or case not found in VERIFICATION_LOG.md / VERIFICATION_LOG-SEO-CONTENT.md
// is withheld from the page (content JSON and state data alike). Logging a verified citation
// and rebuilding brings its sentences back.
import fs from 'fs';

const LOG = ['VERIFICATION_LOG.md', 'VERIFICATION_LOG-SEO-CONTENT.md']
  .filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');

import { citations, sentences } from '../../api/_citelint.js';
function inLog(key, logText) {
  const [t, v] = [key.split(':')[0], key.slice(key.indexOf(':') + 1)];
  if (t === 'C') return new RegExp('\\b' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(logText);
  const needle = v.replace(/^PA/, '').replace(/^FED/, '').replace(/ILCS/, ' ILCS ').split('-').filter(Boolean)[0] && v;
  const coreNum = v.replace(/^(PA|FED)/, '').replace(/ILCS/, '|');
  const parts = coreNum.split('|').map(p => p.replace(/^-/, '')).filter(Boolean);
  const last = parts.at(-1);
  if (!last) return false;
  const esc = last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (t === 'CH') return new RegExp('\\b(Chapter|Ch\\.)\\s*' + esc + '\\b', 'i').test(logText);
  if (t === 'ART') return new RegExp('\\b(Article|Art\\.)\\s*' + esc + '\\b', 'i').test(logText);
  if (t === 'TITLE') return new RegExp('\\bTitle\\s*' + esc + '\\b', 'i').test(logText);
  // short bare numbers ("§ 65", "§ 202") count as logged only WITH a section sign; longer cores (627.7011, 33-7-11) may appear bare
  if (/^\d{1,4}$/.test(last)) return new RegExp('§+\\s*' + esc + '(?![\\d.])').test(logText);
  return new RegExp('(^|[^\\d.])' + esc + '([^\\d]|$)').test(logText) && !!needle;
}

const cache = new Map();
function logged(key) {
  if (!cache.has(key)) {
    // bare ILCS act cites ("215 ILCS 180") are logged in that literal form
    const m = key.match(/^S:(\d+)ILCS(\d+)$/);
    cache.set(key, m ? new RegExp('\\b' + m[1] + '\\s*ILCS\\s*' + m[2] + '\\b').test(LOG) : inLog(key, LOG));
  }
  return cache.get(key);
}
export const unlogged = text => [...citations(text)].filter(([k]) => !logged(k)).map(([, s]) => s);

function strip(value) {
  if (typeof value === 'string') {
    if (!unlogged(value).length) return value;
    return sentences(value).filter(x => !unlogged(x).length).join('').trim();
  }
  if (Array.isArray(value)) return value.map(strip).filter(x => x !== '' && !(x && typeof x === 'object' && 'a' in x && !x.a));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, strip(x)]));
  return value;
}

// key kept for call-site readability; the rule is the same for every page
export function holdBack(key, value) { return value ? strip(value) : value; }
