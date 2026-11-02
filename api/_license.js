// api/_license.js — shared fail-closed Payhip license verification (generate + checklist)
// Fail-closed Payhip license verify. Runs on EVERY request (gate check and
// generation). Rejects unless HTTP 200 + data.enabled===true + product_link
// matches this app. Network error / timeout / non-JSON -> 503 (never "invalid").
export async function verifyLicense(licenseKey, productLink, apiKey) {
  const key = (licenseKey || '').trim();
  if (!key) return { ok: false, status: 401, error: 'Invalid license key.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://payhip.com/api/v1/license/verify?product_link=${encodeURIComponent(productLink)}&license_key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { headers: { 'payhip-api-key': apiKey }, signal: controller.signal });
    if (res.status !== 200) return { ok: false, status: 401, error: 'Invalid license key.' };
    const json = await res.json();
    const d = json && json.data;
    if (!d || d.enabled !== true || d.product_link !== productLink) {
      return { ok: false, status: 401, error: 'Invalid license key.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, status: 503, error: 'License verification unavailable — please try again shortly.' };
  } finally {
    clearTimeout(timer);
  }
}
