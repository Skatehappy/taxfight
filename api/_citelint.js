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


const ANTI_FAB = (list) => `\n\nCITATION RULE (server-enforced): Cite ONLY the verified authorities listed below, exactly as written. Do not cite any other statute, regulation, rule, ordinance or court case, and do not invent section numbers. Do not add subsection letters or numbers that are not shown, and do not state any dollar amount, percentage or number of days for a legal rule unless it appears in the verified authorities or in the user's own information. If none of them fits a point, make the point without a citation.\nVERIFIED AUTHORITIES:\n${list.map(x => '- ' + x).join('\n') || '- (none - cite no statutes or cases)'}`;

export function citationBlock(entry) { return ANTI_FAB(entry?.display || []); }

// ---- subsection-level matching (full citation incl. subsection) ----
// "§ 48-5-311(g)(4)(B)(ii)" -> key S:48-5-311, chain "(g)(4)(b)(ii)". A cited chain is verified only when it is a
// prefix of a chain that appears in verified material for that section (citing LESS specifically is fine;
// citing a subsection nobody verified is not, even when the bare section is verified).
export function subsections(text) {
  const out = []; // { key, chain, sample }
  for (const m of text.matchAll(/(?:§§?|\bSection)\s*(\d[\w.\-–:/]*)((?:\s?\([A-Za-z0-9.]{1,5}\))+)/g)) {
    const key = 'S:' + core(m[1]);
    if (key.length > 3) out.push({ key, chain: m[2].replace(/\s+/g, '').toLowerCase(), sample: m[0] });
  }
  return out;
}
export function chainOk(chain, verifiedChains) {
  return (verifiedChains || []).some(v => v.startsWith(chain));
}

// ---- numeric claims: dollar / percent / day figures ----
const FIG_CONTEXT = /\b(deadline|within|days?|fees?|interest|penalt\w*|exempt\w*|ceiling|cap|capped|limit|refund|statut\w*|appeal|files?|filed|due|freeze|frozen|rate)\b/i;
export function figures(text) {
  const out = new Set();
  for (const m of text.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)(?:\s?(million|thousand)\b|k\b)?/gi)) {
    let n = Number(m[1].replace(/,/g, ''));
    const u = (m[2] || '').toLowerCase();
    if (u === 'million') n *= 1e6; else if (u === 'thousand' || /k$/i.test(m[0])) n *= 1e3;
    out.add('$' + n);
  }
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s?(?:%|percent\b)/gi)) out.add(m[1] + '%');
  for (const m of text.matchAll(/\b(\d+)[\s-]+(?:calendar[\s-]+|business[\s-]+)?days?\b/gi)) out.add(m[1] + 'd');
  return out;
}
// Figures that sit in a legal-context sentence but are neither in the state's verified material nor supplied by the user.
export function unverifiedFigures(text, verifiedNums, inputText = '') {
  const known = new Set([...(verifiedNums || []), ...figures(inputText)]);
  const bad = [];
  for (const line of text.split(/\r?\n/)) for (const s of sentences(line, true)) {
    if (!FIG_CONTEXT.test(s)) continue;
    for (const f of figures(s)) if (!known.has(f)) bad.push({ key: 'N:' + f, sample: f });
  }
  return bad;
}

// opts: { subs: {key:[chains]}, nums: [figures], input: string }  (all optional; absent = that check is skipped)
function badInText(s, ok, opts) {
  const bad = [...citations(s)].filter(([k]) => !ok.has(k)).map(([k, x]) => ({ key: k, sample: x }));
  if (opts.subs) for (const c of subsections(s)) if (ok.has(c.key) && !chainOk(c.chain, opts.subs[c.key])) bad.push({ key: c.key + c.chain, sample: c.sample });
  if (opts.nums) bad.push(...unverifiedFigures(s, opts.nums, opts.input));
  return bad;
}

// Citations / figures in text that are not verified.
export function findUnverified(text, allowed, opts = {}) {
  const ok = new Set(allowed || []);
  return badInText(text, ok, opts);
}

// Drops every sentence that carries an unverified citation or figure (line by line, so headers survive).
export function stripUnverified(text, allowed, opts = {}) {
  const ok = new Set(allowed || []);
  const bad = s => badInText(s, ok, opts).length > 0;
  return text.split('\n').map(line => {
    if (!bad(line)) return line;
    return sentences(line, true).filter(x => !bad(x)).join('').replace(/[ \t]+$/, '');
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Post-generation lint. regen(samples) -> Promise<string>. Regenerates once, then strips.
// log receives counts and citation strings only - never letter text.
export async function lintLetter(text, allowed, regen, log = () => {}, opts = {}) {
  const first = findUnverified(text, allowed, opts);
  if (!first.length) return { text, action: 'clean', flagged: [] };
  const keys = first.map(f => f.key);
  let out = text, action = 'stripped';
  if (regen) {
    try {
      const again = await regen(first.map(f => f.sample));
      if (again) {
        out = again;
        if (!findUnverified(again, allowed, opts).length) action = 'regenerated';
      }
    } catch { /* fall through to strip */ }
  }
  if (action !== 'regenerated') out = stripUnverified(out, allowed, opts);
  log({ event: 'citelint', action, flagged: keys });
  return { text: out, action, flagged: keys };
}
