// api/generate.js — keeps ANTHROPIC_API_KEY server-side only
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MODEL } from './_config.js';
import { citationBlock, lintLetter } from './_citelint.js';
import { verifyLicense } from './_license.js';

// Node serverless runtime (NOT edge). Edge caps at ~25s on Hobby and ignores
// maxDuration, which 504'd ~25s Opus letters. Node honors maxDuration:60. MUST
// use the classic (req, res) handler: Vercel's Node runtime writes via res and
// ignores a returned Response (returning one hangs the function to the timeout).
export const config = { maxDuration: 60 };

const PRODUCT_LINK = 'Sry6P';

// Verified-citation allowlist built from VERIFICATION_LOG* by scripts/build-verified-citations.mjs.
let VERIFIED = {};
try { VERIFIED = JSON.parse(fs.readFileSync(new URL('./_verified-citations.json', import.meta.url), 'utf8')); } catch { /* none: letters then cite nothing */ }
const slugOf = v => String(v || '').trim().toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
function verifiedFor(state, letterType) {
  const e = VERIFIED[slugOf(state)];
  if (!e) return { keys: [], entry: { display: [] } };
  const t = slugOf(letterType);
  const ordered = [...e.cites].sort((a, b) => (b.t.includes(t) ? 1 : 0) - (a.t.includes(t) ? 1 : 0));
  return { keys: e.cites.map(c => c.k), entry: { display: ordered.map(c => c.d) } };
}

// G4T- Gate 4 test code. Inert unless G4_TEST_CODE_SECRET is set in Vercel env (no default).
// Code form: G4T-<secret>. Skips Payhip verify and the usage mark; max 10 generations per UTC day.
// The counter lives in module memory, so it is best-effort: it resets on a cold start and is not
// shared between serverless instances. Rotate/unset the secret to shut the path off.
const G4T_DAILY_CAP = 10;
const g4t = { day: '', n: 0 };
function isG4TCode(code) {
  const secret = process.env.G4_TEST_CODE_SECRET;
  const c = (code || '').trim();
  if (!secret || !c.toUpperCase().startsWith('G4T-')) return false;
  // the app uppercases typed codes, so compare case-insensitively
  const a = Buffer.from(c.slice(4).toUpperCase()), b = Buffer.from(secret.toUpperCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function g4tTake() {
  const day = new Date().toISOString().slice(0, 10);
  if (g4t.day !== day) { g4t.day = day; g4t.n = 0; }
  if (g4t.n >= G4T_DAILY_CAP) return false;
  g4t.n++;
  console.log(JSON.stringify({ event: 'g4t_use', day, n: g4t.n, cap: G4T_DAILY_CAP }));
  return true;
}

async function callClaude(apiKey, system, messages) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 3000, thinking: { type: 'disabled' }, system: system || undefined, messages }),
  });
  if (!response.ok) { const e = new Error('AI generation failed'); e.status = 502; e.detail = await response.text(); throw e; }
  const data = await response.json();
  // Extract the text block by type, not by position (a thinking block can land at content[0]).
  const text = data.content?.find(b => b.type === 'text')?.text;
  if (!text) throw new Error(`No text block in API response (stop_reason: ${data.stop_reason || 'unknown'})`);
  return text;
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

    if (testCode && !g4tTake()) return res.status(429).json({ error: 'Test code daily limit reached.' });

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
    const { keys, entry } = verifiedFor(state, letterType);
    const system = (systemPrompt || '') + citationBlock(entry);
    let text = await callClaude(apiKey, system, messages);
    const lint = await lintLetter(
      text, keys,
      samples => callClaude(apiKey, system + `
Your previous draft cited authorities that are NOT verified: ${samples.join('; ')}. Rewrite the letter without citing them or any other authority outside the list.`, messages),
      o => console.log(JSON.stringify({ ...o, state: slugOf(state) || null, letterType: slugOf(letterType) || null }))
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
