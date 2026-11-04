// api/checklist.js — submission checklist. Fail-closed Payhip check (or env-gated G4T test code)
// before any Anthropic call; output goes through the same citation lock as generate.js.
import { MODEL } from './_config.js';
import { verifyLicense } from './_license.js';
import { isG4TCode, g4tTake } from './_g4t.js';
import { verifiedFor, slugOf } from './_verified.js';
import { citationBlock, findUnverified, stripUnverified } from './_citelint.js';
import { callComplete, remaining } from './_complete.js';
import { stripMarkdown } from './_markdown.js';
import { OWNER_VOICE_RULE, findVoiceViolation } from './_voicelint.js';
import { typeInfo, fallbackFor } from './_checklist-fallbacks.js';

// Node serverless runtime, classic (req, res) handler (needs node:fs for the allowlist).
export const config = { maxDuration: 30 };

const PRODUCT_LINK = 'Sry6P';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// stop_reason "max_tokens" means the reply was cut off: callComplete retries once with the higher limit and never
// returns partial text. { list: null } on ANY model failure (HTTP error, truncation, no text, unparseable reply),
// so the caller serves the per-type fallback.
const LIMITS = [2000, 4000];
// TIME BUDGET (maxDuration 30s): all model work (first call, truncation retry, lint regeneration) must finish within
// MODEL_BUDGET_MS of the handler start (license verify <= 8s counts inside that clock). A retry / regeneration only
// starts with MIN_REDO_MS left; otherwise unverified items are stripped / the per-type fallback is served (HTTP 200).
export const BUDGET = { MODEL_BUDGET_MS: 20000, MIN_REDO_MS: 8000 };
async function ask(apiKey, system, content, deadline) {
  const r = await callComplete(ANTHROPIC_URL, apiKey, max => ({ model: MODEL, max_tokens: max, thinking: { type: 'disabled' }, system, messages: [{ role: 'user', content }] }), LIMITS, { deadline, minRetryMs: BUDGET.MIN_REDO_MS });
  if (!r.ok) return { list: null, r };
  try {
    const arr = JSON.parse(r.text.replace(/```json|```/g, '').trim());
    if (!Array.isArray(arr)) return { list: null, r, parseFailed: true };
    return { list: arr.filter(x => typeof x === 'string' && x.trim()).map(stripMarkdown).filter(Boolean), r };
  } catch { return { list: null, r, parseFailed: true }; }
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  const t0 = Date.now();
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { accessCode, address, state, appealType, disputeType, letterExcerpt } = await readBody(req);

    // Fail closed: no Anthropic call without a passed Payhip verification (or an enabled G4T test code).
    const testCode = isG4TCode(accessCode);
    const payhipApiKey = process.env.PAYHIP_API_KEY;
    if (!payhipApiKey && !testCode) return res.status(500).json({ error: 'API not configured' });
    if (!testCode) {
      const lic = await verifyLicense(accessCode, PRODUCT_LINK, payhipApiKey);
      if (!lic.ok) return res.status(lic.status).json({ error: lic.error });
    } else if (!g4tTake('checklist')) {
      return res.status(429).json({ error: 'Test code daily limit reached.' });
    }

    const over = (v, n) => typeof v === 'string' && v.length > n;
    if (over(address, 500) || over(state, 100) || over(appealType, 200) || over(disputeType, 200) || over(letterExcerpt, 5000)) {
      return res.status(400).json({ error: 'Your input is too long.' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API not configured' });

    // The dispute slug (disputeType) picks the per-type focus and fallback; older clients send only appealType.
    const type = disputeType || appealType;
    const { keys, subs, nums, entry } = verifiedFor(state, type);
    const lockOpts = { subs, nums, input: [address, appealType, letterExcerpt].filter(Boolean).join('\n') };
    const system = 'You write practical submission checklists for property owners filing property tax disputes.' + citationBlock(entry) + OWNER_VOICE_RULE;
    const prompt = `Generate a practical submission checklist for a property owner filing ${typeInfo(type).focus}, as a JSON array of 8 to 10 strings. Every item is one plain action step of at most 25 words and fits this situation only. Always include sending the filing by certified mail with return receipt, or filing in person and getting a stamped copy, and keeping a copy. Do not cite any statute, rule or case unless it is in the verified authorities list. Write plain text only (no markdown). Return ONLY a valid JSON array, no other text.

Property: ${address}
State: ${state}
Dispute: ${type || 'property tax assessment dispute'}
Letter excerpt: ${letterExcerpt?.substring(0, 200) || ''}`;

    // Any model failure (HTTP error, truncation, unparseable reply, too few survivors) -> HTTP 200 with this type's own fallback.
    const diag = {};
    const deadline = t0 + BUDGET.MODEL_BUDGET_MS;
    const got = await ask(apiKey, system, prompt, deadline);
    let checklist = got.list;
    diag.attempts = got.r.attempts; diag.stop = got.r.stop; diag.status = got.r.status;
    if (!got.r.ok) {
      diag.failed = got.r.timeout ? 'timeout' : got.r.truncated ? 'truncated' : 'model-error';
      console.log(JSON.stringify({ event: 'checklist_model_fail', reason: diag.failed, status: got.r.status || null }));
    } else if (got.parseFailed) diag.parseFailed = true;

    if (checklist) {
      // Citation + figure lock: any unverified statute/case/figure -> regenerate once, else strip it from the items.
      const bad = list => list.flatMap(i => findUnverified(i, keys, lockOpts));
      const first = bad(checklist);
      if (first.length) {
        let action = 'stripped';
        try {
          const again = remaining(deadline) < BUDGET.MIN_REDO_MS ? { list: null } : await ask(apiKey, system + `\nYour previous checklist cited authorities that are NOT verified: ${first.map(f => f.sample).join('; ')}. Rewrite it without citing them or any other authority outside the list.`, prompt, deadline);
          if (again.list) { checklist = again.list; if (!bad(again.list).length) action = 'regenerated'; }
        } catch { /* fall through to strip */ }
        if (action !== 'regenerated') checklist = checklist.map(i => stripUnverified(i, keys, lockOpts)).filter(i => i.trim());
        diag.lock = action; diag.flagged = first.map(f => f.key);
        console.log(JSON.stringify({ event: 'citelint', endpoint: 'checklist', action, flagged: first.map(f => f.key), state: slugOf(state) || null }));
      }
      checklist = checklist.slice(0, 15);
    }
    // Owner-voice lint on every item: one regeneration naming the phrase (budget permitting), else the safe per-type fallback.
    if (Array.isArray(checklist)) {
      const voiceHit = list => list.map(findVoiceViolation).find(Boolean) || null;
      const h = voiceHit(checklist);
      if (h) {
        let again = { list: null };
        try { if (remaining(deadline) >= BUDGET.MIN_REDO_MS) again = await ask(apiKey, system + `
Your previous checklist contained the phrase "${h}", which is not allowed. Rewrite it as plain action steps for the property owner, with no attorney, counsel or representative self-description.`, prompt, deadline); } catch { /* fall back */ }
        checklist = again.list && !voiceHit(again.list) ? again.list.slice(0, 15) : null;
        diag.voice = checklist ? 'regenerated' : 'fallback';
        console.log(JSON.stringify({ event: 'voicelint', endpoint: 'checklist', action: diag.voice }));
      }
    }
    diag.survivors = Array.isArray(checklist) ? checklist.length : -1;
    if (!Array.isArray(checklist) || checklist.length < 3) { diag.usedFallback = true; checklist = fallbackFor(type); }

    // _diag only for the Gate 4 test code, never for real buyers.
    return res.status(200).json(testCode ? { checklist, _diag: diag } : { checklist });

  } catch (err) {
    if (err.status === 502) return res.status(502).json({ error: err.message, detail: err.detail });
    return res.status(500).json({ error: err.message });
  }
}
