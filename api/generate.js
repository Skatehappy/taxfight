// api/generate.js — keeps ANTHROPIC_API_KEY server-side only
import { MODEL } from './_config.js';

// Node serverless runtime (NOT edge). Edge caps at ~25s on Hobby and ignores
// maxDuration, which 504'd ~25s Opus letters. Node honors maxDuration:60. MUST
// use the classic (req, res) handler: Vercel's Node runtime writes via res and
// ignores a returned Response (returning one hangs the function to the timeout).
export const config = { maxDuration: 60 };

const PRODUCT_LINK = 'Sry6P';

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
    const { accessCode, systemPrompt, userPrompt, reviewMode, draftLetter } = await readBody(req);

    const payhipApiKey = process.env.PAYHIP_API_KEY;
    if (!payhipApiKey) return res.status(500).json({ error: 'API not configured' });

    // Payhip v1 license verification
    const isCheckCall = systemPrompt === 'Reply: VALID';
    const TEST_KEYS = (process.env.TEST_KEYS || 'SMOKE-TEST-2026-BAO').split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
    const isTestKey = TEST_KEYS.includes(String(accessCode || '').trim().toUpperCase());
    if (!isTestKey) {
      const payhipRes = await fetch(
        `https://payhip.com/api/v1/license/verify?product_link=${PRODUCT_LINK}&license_key=${encodeURIComponent(accessCode.trim())}`,
        { method: 'GET', headers: { 'payhip-api-key': payhipApiKey } }
      );
      if (!payhipRes.ok) {
        return res.status(401).json({ error: 'Invalid access code' });
      }
      const payhipData = await payhipRes.json();
      if (!payhipData?.data?.enabled) {
        return res.status(401).json({ error: 'Invalid access code' });
      }
    }

    if (isCheckCall) {
      return res.status(200).json({ text: 'VALID' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API not configured' });

    let messages;
    if (reviewMode && draftLetter) {
      messages = [{
        role: 'user',
        content: `Review and improve this property tax appeal letter. Fix: (1) replace vague language with specific citations and numbers, (2) ensure every ground for appeal is explicitly addressed, (3) remove emotional language — replace with factual evidence, (4) ensure comparable sales are clearly presented, (5) verify state statute citations are properly formatted, (6) tighten redundancy. Return ONLY the improved letter, no commentary:\n\n${draftLetter}`
      }];
    } else {
      messages = [{ role: 'user', content: userPrompt }];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        thinking: { type: 'disabled' },
        system: systemPrompt || undefined,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'AI generation failed', detail: err });
    }

    const data = await response.json();
    // Extract the text block by type, not by position (a thinking block can land
    // at content[0]). Fail loudly on a missing text block — never return undefined
    // — before the mark-usage call, so the buyer's one-use license is not burned.
    const text = data.content?.find(b => b.type === 'text')?.text;
    if (!text) throw new Error(`No text block in API response (stop_reason: ${data.stop_reason || 'unknown'})`);

    // Mark license as used. Awaited (background work isn't guaranteed after res on
    // Node serverless). Skipped for test keys.
    if (!isTestKey) {
      try {
        await fetch('https://payhip.com/api/v1/license/usage', {
          method: 'PUT',
          headers: { 'payhip-api-key': payhipApiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `product_link=${PRODUCT_LINK}&license_key=${encodeURIComponent(accessCode.trim())}`,
        });
      } catch { /* letter already generated; don't fail on a usage-mark hiccup */ }
    }

    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
