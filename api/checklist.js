// api/checklist.js — submission checklist. Fail-closed Payhip check (or env-gated G4T test code)
// before any Anthropic call; output goes through the same citation lock as generate.js.
import { MODEL } from './_config.js';
import { verifyLicense } from './_license.js';
import { isG4TCode, g4tTake } from './_g4t.js';
import { verifiedFor, slugOf } from './_verified.js';
import { citationBlock, findUnverified, stripUnverified } from './_citelint.js';

// Node serverless runtime, classic (req, res) handler (needs node:fs for the allowlist).
export const config = { maxDuration: 30 };

const PRODUCT_LINK = 'Sry6P';

const FALLBACK = [
  'Completed appeal / protest form from your county assessor or appeals board',
  'This appeal letter — 3 copies minimum (keep one for your records)',
  'Printed comparable sales data with addresses, sale prices, and dates',
  'Photos of any condition issues or property defects cited in your letter',
  'Copy of your current assessment notice (the document you are appealing)',
  'Copy of assessor\'s property record card (request from assessor\'s office)',
  'Filing fee — confirm amount and payment method with your appeals board',
  'Send by certified mail with return receipt or file in person and get a stamped copy',
  'Note your appeal deadline and confirm your filing is before that date',
];

async function ask(apiKey, system, content) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 900, thinking: { type: 'disabled' }, system, messages: [{ role: 'user', content }] }),
  });
  // Fail loudly on an API error instead of silently returning an empty checklist.
  if (!response.ok) { const e = new Error('Checklist generation failed'); e.status = 502; e.detail = await response.text(); throw e; }
  const data = await response.json();
  const text = data.content?.find(b => b.type === 'text')?.text || '[]';
  try {
    const arr = JSON.parse(text.replace(/```json|```/g, '').trim());
    return Array.isArray(arr) ? arr.filter(x => typeof x === 'string' && x.trim()) : null;
  } catch { return null; }
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
    const { accessCode, address, state, appealType, letterExcerpt } = await readBody(req);

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
    if (over(address, 500) || over(state, 100) || over(appealType, 200) || over(letterExcerpt, 5000)) {
      return res.status(400).json({ error: 'Your input is too long.' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API not configured' });

    const { keys, subs, nums, entry } = verifiedFor(state, 'property-tax-appeal');
    const lockOpts = { subs, nums, input: [address, appealType, letterExcerpt].filter(Boolean).join('\n') };
    const system = 'You write property tax appeal submission checklists.' + citationBlock(entry);
    const prompt = `Generate a practical property tax appeal submission checklist as a JSON array of strings. Be specific to the state and situation. Include items like: completed appeal form, this cover letter (copies), comparable sales printouts, photos of condition issues, assessor field card copy, filing fee amount/method, deadline date reminder, certified mail receipt, etc. Do not cite any statute, rule or case unless it is in the verified authorities list. Return ONLY a valid JSON array, no other text.

Property: ${address}
State: ${state}
Appeal type: ${appealType || 'property tax assessment appeal'}
Letter excerpt: ${letterExcerpt?.substring(0, 200) || ''}`;

    let checklist = await ask(apiKey, system, prompt);
    if (checklist) {
      // Citation lock: any unverified statute/case -> regenerate once, else strip it from the items.
      const bad = list => list.flatMap(i => findUnverified(i, keys, lockOpts));
      const first = bad(checklist);
      if (first.length) {
        let action = 'stripped';
        try {
          const again = await ask(apiKey, system + `\nYour previous checklist cited authorities that are NOT verified: ${first.map(f => f.sample).join('; ')}. Rewrite it without citing them or any other authority outside the list.`, prompt);
          if (again) { checklist = again; if (!bad(again).length) action = 'regenerated'; }
        } catch { /* fall through to strip */ }
        if (action !== 'regenerated') checklist = checklist.map(i => stripUnverified(i, keys, lockOpts)).filter(i => i.trim());
        console.log(JSON.stringify({ event: 'citelint', endpoint: 'checklist', action, flagged: first.map(f => f.key), state: slugOf(state) || null }));
      }
    }
    if (!checklist || !checklist.length) checklist = FALLBACK;

    return res.status(200).json({ checklist });

  } catch (err) {
    if (err.status === 502) return res.status(502).json({ error: err.message, detail: err.detail });
    return res.status(500).json({ error: err.message });
  }
}
