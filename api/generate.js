// api/generate.js — keeps ANTHROPIC_API_KEY server-side only
import { MODEL } from './_config.js';
import { citationBlock, lintLetter } from './_citelint.js';
import { verifyLicense } from './_license.js';
import { isG4TCode, g4tTake } from './_g4t.js';
import { verifiedFor, slugOf } from './_verified.js';
import { callComplete } from './_complete.js';

// Node serverless runtime (NOT edge). Edge caps at ~25s on Hobby and ignores
// maxDuration, which 504'd ~25s Opus letters. Node honors maxDuration:60. MUST
// use the classic (req, res) handler: Vercel's Node runtime writes via res and
// ignores a returned Response (returning one hangs the function to the timeout).
export const config = { maxDuration: 60 };

const PRODUCT_LINK = 'Sry6P';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// stop_reason "max_tokens" = truncated: retried once with a higher limit, never linted or returned as a letter.
// Any failure throws with status 502 BEFORE the license usage mark, so the code is not burned.
const TOKEN_LIMITS = [3000, 6000];
async function callClaude(apiKey, system, messages) {
  const r = await callComplete(ANTHROPIC_URL, apiKey, max => ({ model: MODEL, max_tokens: max, thinking: { type: 'disabled' }, system: system || undefined, messages }), TOKEN_LIMITS);
  if (r.ok) return r.text;
  const e = new Error(r.truncated ? 'The letter was cut off before it finished. Please try again; your access code has not been used.' : 'AI generation failed');
  e.status = 502; e.detail = r.truncated ? 'truncated' : r.err;
  throw e;
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
  cors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { accessCode, systemPrompt, userPrompt, reviewMode, draftLetter, state, letterType } = await readBody(req);

    const testCode = isG4TCode(accessCode);
    const payhipApiKey = process.env.PAYHIP_API_KEY;
    if (!payhipApiKey && !testCode) return res.status(500).json({ error: 'API not configured' });

    // Payhip v1 license verification
    const isCheckCall = systemPrompt === 'Reply: VALID';

    if (!testCode) {
      const lic = await verifyLicense(accessCode, PRODUCT_LINK, payhipApiKey);
      if (!lic.ok) return res.status(lic.status).json({ error: lic.error });
    }

    if (isCheckCall) {
      return res.status(200).json({ text: 'VALID' });
    }

    // Input caps (invalid input -> 400; the license is not consumed by a rejected request).
    const over = (v, n) => typeof v === 'string' && v.length > n;
    if (over(systemPrompt, 12000) || over(userPrompt, 40000) || over(draftLetter, 20000)) {
      return res.status(400).json({ error: 'Your input is too long.' });
    }

    if (testCode && !g4tTake('generate')) return res.status(429).json({ error: 'Test code daily limit reached.' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API not configured' });

    let messages;
    if (reviewMode && draftLetter) {
      messages = [{
        role: 'user',
        content: `Review and improve this property tax appeal letter. Fix: (1) replace vague language with specific numbers, (2) ensure every ground for appeal is explicitly addressed, (3) remove emotional language — replace with factual evidence, (4) ensure comparable sales are clearly presented, (5) keep only citations that appear in the verified authorities list and delete any other statute or case citation, (6) tighten redundancy. Return ONLY the improved letter, no commentary:\n\n${draftLetter}`
      }];
    } else {
      messages = [{ role: 'user', content: userPrompt }];
    }

    // Citation lock: the model may cite only verified authorities for this state (server-side),
    // and the output is linted for anything else (regenerate once, then strip the sentence).
    const { keys, subs, nums, entry } = verifiedFor(state, letterType);
    // full-citation lock (subsections) + numeric-claims check against verified state figures; figures the user typed are allowed
    const lockOpts = { subs, nums, input: [systemPrompt, userPrompt, draftLetter].filter(Boolean).join('\n') };
    const system = (systemPrompt || '') + citationBlock(entry);
    let text = await callClaude(apiKey, system, messages);
    const lint = await lintLetter(
      text, keys,
      samples => callClaude(apiKey, system + `
Your previous draft used citations, subsections or figures (dollar amounts, percentages, day counts) that are NOT verified: ${samples.join('; ')}. Rewrite the letter without them: cite only the listed authorities exactly as written (no added subsection letters) and state no legal dollar, percentage or deadline figure that is not in the list or supplied by the user.`, messages),
      o => console.log(JSON.stringify({ ...o, state: slugOf(state) || null, letterType: slugOf(letterType) || null })),
      lockOpts
    );
    text = lint.text;
    if (!text) throw new Error('Letter was empty after citation lint');

    // Mark license as used. Awaited (background work isn't guaranteed after res on
    // Node serverless). Test codes (G4T-) are never marked.
    if (!testCode) try {
      await fetch('https://payhip.com/api/v1/license/usage', {
        method: 'PUT',
        headers: { 'payhip-api-key': payhipApiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `product_link=${PRODUCT_LINK}&license_key=${encodeURIComponent(accessCode.trim())}`,
      });
    } catch { /* letter already generated; don't fail on a usage-mark hiccup */ }

    return res.status(200).json({ text });

  } catch (err) {
    if (err.status === 502) return res.status(502).json({ error: err.message, detail: err.detail });
    return res.status(500).json({ error: err.message });
  }
}
