// api/checklist.js
export const config = { runtime: 'edge' };

const PRODUCT_LINK = 'Sry6P';

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
    const { accessCode, address, state, appealType, letterExcerpt } = await req.json();

    const payhipApiKey = process.env.PAYHIP_API_KEY;
    const payhipRes = await fetch(
      `https://payhip.com/api/v1/license/verify?product_link=${PRODUCT_LINK}&license_key=${encodeURIComponent(accessCode.trim())}`,
      { method: 'GET', headers: { 'payhip-api-key': payhipApiKey } }
    );
    if (!payhipRes.ok) return new Response(JSON.stringify({ error: 'Invalid access code' }), { status: 401, headers });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Generate a practical property tax appeal submission checklist as a JSON array of strings. Be specific to the state and situation. Include items like: completed appeal form, this cover letter (copies), comparable sales printouts, photos of condition issues, assessor field card copy, filing fee amount/method, deadline date reminder, certified mail receipt, etc. Return ONLY a valid JSON array, no other text.

Property: ${address}
State: ${state}
Appeal type: ${appealType || 'property tax assessment appeal'}
Letter excerpt: ${letterExcerpt?.substring(0, 200) || ''}`,
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';
    const clean = text.replace(/```json|```/g, '').trim();

    let checklist;
    try {
      checklist = JSON.parse(clean);
    } catch {
      checklist = [
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
    }

    return new Response(JSON.stringify({ checklist }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
