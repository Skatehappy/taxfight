// api/_complete.js — one Anthropic Messages call that never hands back a truncated reply (Edge-safe: no node: imports).
// stop_reason "max_tokens" means the reply was cut off. The call is retried ONCE with the next, higher limit in
// `limits`; if that is also cut off the result is { ok: false, truncated: true } and no partial text is returned,
// so callers can never parse or send half an output.
// TIME BUDGET: opts.deadline (absolute epoch ms) bounds every fetch (aborted at the deadline) and the truncation retry
// only starts when at least opts.minRetryMs remain. A call that hits the deadline returns { ok: false, timeout: true }.
// No deadline = unbounded (legacy behaviour).
// The endpoint URL is passed in by the handler (which has already passed verifyLicense): auth-gate rule - no helper
// module names the Anthropic host itself.
export const remaining = deadline => (deadline == null ? Infinity : deadline - Date.now());

export async function callComplete(url, apiKey, buildBody, limits, opts = {}) {
  const { deadline, minRetryMs = 0 } = opts;
  for (let i = 0; i < limits.length; i++) {
    if (i > 0 && remaining(deadline) < minRetryMs) return { ok: false, truncated: true, timeout: true, err: 'Not enough time left to retry a cut-off reply', attempts: i };
    if (remaining(deadline) <= 0) return { ok: false, timeout: true, err: 'Deadline reached before the model call', attempts: i };
    const ctl = new AbortController();
    const timer = deadline == null ? null : setTimeout(() => ctl.abort(), Math.max(1, remaining(deadline)));
    let response, data;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(buildBody(limits[i])),
        signal: ctl.signal,
      });
      if (!response.ok) return { ok: false, status: response.status, err: await response.text() };
      data = await response.json();
    } catch (e) {
      if (ctl.signal.aborted) return { ok: false, timeout: true, err: 'Model call exceeded the time budget', attempts: i + 1 };
      throw e;
    } finally { if (timer) clearTimeout(timer); }
    if (data.stop_reason === 'max_tokens') {
      if (i < limits.length - 1) continue;
      return { ok: false, truncated: true, err: 'Model reply was cut off at the token limit', stop: data.stop_reason, attempts: i + 1 };
    }
    // Extract the text block by type, not by position (adaptive thinking can put a "thinking" block first).
    const text = data.content?.find(b => b.type === 'text')?.text;
    if (!text) return { ok: false, err: `No text block in API response (stop_reason: ${data.stop_reason || 'unknown'})`, stop: data.stop_reason };
    return { ok: true, text, stop: data.stop_reason, attempts: i + 1 };
  }
  return { ok: false, err: 'no token limits given' };
}
