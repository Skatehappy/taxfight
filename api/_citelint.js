// api/_citelint.js - citation extraction + no-fabrication lint for generated letters.
// Single source of truth: scripts/data/pending.js (build-time page hold-back) imports
// citations() and sentences() from here, so pages and letters use the same rule.
// Underscore prefix: not exposed as a Vercel endpoint.

const core = x => (x.match(/\d[\d.\-–/:]*[A-Za-z]?(?:[.\-]\d+)*/) || [''])[0].replace(/[–]/g, '-').replace(/[.\-/:]+$/, '');
const CASE_SKIP = new Set(['in', 'under', 'yes', 'see', 'the', 'inc', 'llc', 'co', 'corp', 'if', 'and', 'when', 'as', 'per', 'cf', 'also', 'after', 'because', 'following', 'landmark', 'court', 'case', 'courts', 'decision', 'ruling', 'holding']);
export function citations(text) {
  const keys = new Map(); // key -> sample
  const canon = k => {
    if (!k || !k.startsWith('S:')) return k;
    let v = k.slice(2).replace(/^(PA|FED)\d+-(?=\d)/, '');            // "40 P.S. § 1171.5" / "29 U.S.C. § 1132" → section only
    if (/^\d+\.\d+[A-Za-z]?-\d+\.\d+/.test(v)) v = v.split('-')[0];       // ranges "991.2141-991.2193" → first section
    return 'S:' + v;
  };
  const add = (k, s) => { k = canon(k); if (k && !keys.has(k)) keys.set(k, s.trim().slice(0, 60)); };
  const pats = [
    [/§§?\s*(\d[\w.\-–:/]*)/g, m => 'S:' + core(m[1])],
    [/\b(\d+)\s*ILCS\s*([\d/.\-]+)/g, m => 'S:' + m[1] + 'ILCS' + core(m[2])],
    [/\b(\d+)\s*(?:Pa\.\s*C\.\s*S\.|P\.\s*S\.)\s*(?:§+\s*)?(\d[\d.\-]*)?/g, m => 'S:PA' + m[1] + (m[2] ? '-' + core(m[2]) : '')],
    [/\b(?:R\.\s*C\.|ORC)\s*(?:§\s*)?(\d{3,4}\.\d+)/g, m => 'S:' + m[1]],
    [/\b(?:Fla\.\s*Stat\.|Tex\.\s*[A-Z][a-z]+\.?\s*Code|Insurance Law|Ins\.\s*Law|Code)\s+(?:§+\s*)?(\d[\d.\-]*\d)/g, m => 'S:' + core(m[1])],
    [/\bSection\s+(\d[\d.\-]*\d[A-Za-z]?)/g, m => 'S:' + core(m[1])],
    [/\b(?:Chapter|Ch\.)\s+(\d+[A-Z]?)\b/g, m => 'CH:' + m[1]],
    [/\b(?:Article|Art\.)\s+(\d+[A-Z-]*)\b/g, m => 'ART:' + m[1]],
    [/\b(?:Title)\s+(\d+[A-Z]?)\b/g, m => 'TITLE:' + m[1]],
    [/\b(\d+)\s*(?:U\.\s*S\.\s*C\.|USC|C\.\s*F\.\s*R\.|CFR)\s*(?:§+\s*)?(\d[\d.\-]*)?/g, m => 'S:FED' + m[1] + '-' + core(m[2] || '')],
    [/\b((?:[A-Z][A-Za-z'&.\-]*\s+){0,3}[A-Z][A-Za-z'&\-]*)\.?\s+v\.\s+([A-Z][A-Za-z'&\-]+)/g, m => {
      const pl = m[1].split(/\s+/).map(w => w.replace(/[.,]/g, '')).filter(w => w && !CASE_SKIP.has(w.toLowerCase()));
      const name = (pl[0] || m[2]).toLowerCase(); return name.length > 2 ? 'C:' + name : null;
    }],
  ];
  for (const [re, fn] of pats) for (const m of text.matchAll(re)) { const k = fn(m); if (k && !/^S:$|^S:FED\d+-$/.test(k) && k.length > 3) add(k, m[0]); }
  return keys;
}
// Split on sentence ends, but not after abbreviations ("Ariz. Rev. Stat.", "v.", "N.C.").
export function sentences(s, numEnds = false) {
  const out = []; let start = 0;
  const re = /[.!?]["')\]]?\s+(?=[A-Z"(§])/g; let m;
  while ((m = re.exec(s))) {
    const word = s.slice(start, m.index + 1).split(/[\s—–/(]+/).pop();
    if ((/\..*\.$/.test(word) && !(numEnds && /\d\.$/.test(word))) || /^\(?([A-Z][a-z]{0,4}|[a-z]{1,3}|[A-Z](\.[A-Z])*|§+|\d+[A-Za-z]?)\.$/.test(word)) continue;
    out.push(s.slice(start, m.index + m[0].length)); start = m.index + m[0].length;
  }
  out.push(s.slice(start));
  return out;
}


const ANTI_FAB = (list) => `\n\nCITATION RULE (server-enforced): Cite ONLY the verified authorities listed below, exactly as written. Do not cite any other statute, regulation, rule, ordinance or court case, and do not invent section numbers. If none of them fits a point, make the point without a citation.\nVERIFIED AUTHORITIES:\n${list.map(x => '- ' + x).join('\n') || '- (none - cite no statutes or cases)'}`;

export function citationBlock(entry) { return ANTI_FAB(entry?.display || []); }

// Citations in text whose canonical key is not in the allowed set.
export function findUnverified(text, allowed) {
  const ok = new Set(allowed || []);
  return [...citations(text)].filter(([k]) => !ok.has(k)).map(([k, s]) => ({ key: k, sample: s }));
}

// Drops every sentence that carries an unverified citation (line by line, so headers survive).
export function stripUnverified(text, allowed) {
  const ok = new Set(allowed || []);
  const bad = s => [...citations(s)].some(([k]) => !ok.has(k));
  return text.split('\n').map(line => {
    if (!bad(line)) return line;
    return sentences(line, true).filter(x => !bad(x)).join('').replace(/[ \t]+$/, '');
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Post-generation lint. regen(samples) -> Promise<string>. Regenerates once, then strips.
// log receives counts and citation strings only - never letter text.
export async function lintLetter(text, allowed, regen, log = () => {}) {
  const first = findUnverified(text, allowed);
  if (!first.length) return { text, action: 'clean', flagged: [] };
  const keys = first.map(f => f.key);
  let out = text, action = 'stripped';
  if (regen) {
    try {
      const again = await regen(first.map(f => f.sample));
      if (again) {
        out = again;
        if (!findUnverified(again, allowed).length) action = 'regenerated';
      }
    } catch { /* fall through to strip */ }
  }
  if (action !== 'regenerated') out = stripUnverified(out, allowed);
  log({ event: 'citelint', action, flagged: keys });
  return { text: out, action, flagged: keys };
}
