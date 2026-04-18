// api/generate.js
// Vercel Edge Function — keeps ANTHROPIC_API_KEY server-side only

export const config = { runtime: 'edge' };

const PRODUCT_LINK = 'PLACEHOLDER'; // Replace with Payhip product code after listing created

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    const body = await req.json();
    const { accessCode, systemPrompt, userPrompt, reviewMode, draftLetter } = body;

    const payhipApiKey = process.env.PAYHIP_API_KEY;
    if (!payhipApiKey) return new Response(JSON.stringify({ error: 'API not configured' }), { status: 500, headers });

    // Payhip v1 license verification
    const isCheckCall = systemPrompt === 'Reply: VALID';
    const payhipRes = await fetch(
      `https://payhip.com/api/v1/license/verify?product_link=${PRODUCT_LINK}&license_key=${encodeURIComponent(accessCode.trim())}`,
      { method: 'GET', headers: { 'payhip-api-key': payhipApiKey } }
    );

    if (!payhipRes.ok) {
      return new Response(JSON.stringify({ error: 'Invalid access code' }), { status: 401, headers });
    }

    const payhipData = await payhipRes.json();
    if (!payhipData?.data?.enabled) {
      return new Response(JSON.stringify({ error: 'Invalid access code' }), { status: 401, headers });
    }

    if (isCheckCall) {
      return new Response(JSON.stringify({ text: 'VALID' }), { status: 200, headers });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'API not configured' }), { status: 500, headers });

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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt || undefined,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'AI generation failed', detail: err }), { status: 502, headers });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Mark license as used (non-blocking)
    fetch('https://payhip.com/api/v1/license/usage', {
      method: 'PUT',
      headers: { 'payhip-api-key': payhipApiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `product_link=${PRODUCT_LINK}&license_key=${encodeURIComponent(accessCode.trim())}`,
    }).catch(() => {});

    return new Response(JSON.stringify({ text }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
