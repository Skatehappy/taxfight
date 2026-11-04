// Playwright UI wiring test: builds the app, serves dist/, mocks /api/** (NO real Payhip/Anthropic calls, no real
// codes), then clicks every button / nav link / toggle / export and fails on any console error or page error.
// Playwright is resolved from node_modules, PLAYWRIGHT_DIR, or a known local install. If none is available the test
// SKIPs loudly (exit 0, "SKIP") unless UI_TEST_REQUIRED=1 (CI) is set.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

let pw;
for (const base of [ROOT, process.env.PLAYWRIGHT_DIR, 'C:/Users/jakld/captainsdesk'].filter(Boolean)) {
  try { pw = createRequire(path.join(base, 'x.js'))('playwright'); break; } catch { /* next */ }
}
if (!pw) {
  if (process.env.UI_TEST_REQUIRED) { console.error('ui-wiring: playwright not installed'); process.exit(1); }
  console.log('ui-wiring: SKIP (playwright not installed; set UI_TEST_REQUIRED=1 to make this fatal)'); process.exit(0);
}
if (!fs.existsSync(path.join(ROOT, 'node_modules/vite/bin/vite.js'))) {
  if (process.env.UI_TEST_REQUIRED) { console.error('ui-wiring: run npm install first'); process.exit(1); }
  console.log('ui-wiring: SKIP (node_modules missing; run npm install)'); process.exit(0);
}

execFileSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--logLevel', 'error'], { cwd: ROOT, stdio: 'pipe' });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/landing.html';
  if (p === '/app' || p.startsWith('/app/')) p = '/index.html';
  let f = path.join(DIST, p);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;

let browser;
try { browser = await pw.chromium.launch({ channel: 'msedge' }); } catch {
  try { browser = await pw.chromium.launch(); } catch {
    server.close();
    if (process.env.UI_TEST_REQUIRED) { console.error('ui-wiring: no browser'); process.exit(1); }
    console.log('ui-wiring: SKIP (no browser available)'); process.exit(0);
  }
}

const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const problems = [];
page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
page.on('pageerror', e => problems.push('pageerror: ' + e.message));
page.on('response', r => { if (r.url().startsWith(ORIGIN) && r.status() >= 400 && !r.url().includes('/api/')) problems.push('own-origin ' + r.status() + ': ' + r.url()); });

// external assets: stub fonts; serve the REAL jsPDF 2.5.1 UMD (vendored copy of the CDN build) so a real PDF is produced; never hit the network
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const JSPDF_SRC = fs.readFileSync(path.join(ROOT, 'scripts/vendor/jspdf.umd.min.js'), 'utf8');
await page.route(/cdnjs\.cloudflare\.com.*jspdf/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: JSPDF_SRC }));

// API mocks. `mode` controls what /api/generate answers.
let mode = 'ok'; const apiCalls = [];
await page.route('**/api/**', async route => {
  const url = route.request().url(); const body = JSON.parse(route.request().postData() || '{}'); apiCalls.push({ url, body });
  const send = (status, j) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(j) });
  if (url.endsWith('/api/checklist')) return send(200, { checklist: ['Completed appeal form', 'Comparable sales printouts'] });
  if (body.systemPrompt === 'Reply: VALID') {
    if (mode === 'bad-code') return send(401, { error: 'Invalid license key.' });
    if (mode === 'outage') return send(503, { error: 'License verification unavailable' });
    return send(200, { text: 'VALID' });
  }
  if (mode === 'gen-503') return send(503, { error: 'x' });
  if (mode === 'gen-400') return send(400, { error: 'Your input is too long.' });
  return send(200, { text: 'Dear Board,\n\n## Grounds\nI appeal the **assessment** of my property.  *Please* review.\n\n| Item | Value |\n|---|---|\n| Assessed | $250,000 |\n\nSincerely, Owner' });
});

const clicked = new Set(), seen = new Set();
async function noteButtons() {
  const btns = page.locator('button:visible');
  const n = await btns.count();
  for (let i = 0; i < n; i++) seen.add((await btns.nth(i).innerText()).trim());
}
async function click(locator, label) { await locator.click(); clicked.add(label); }

// 1. landing page: every internal link resolves; "#how" anchor works; external links are well formed
await page.goto(ORIGIN + '/');
const hrefs = await page.$$eval('a[href]', as => [...new Set(as.map(a => a.getAttribute('href')))]);
assert.ok(hrefs.length > 10, 'landing page should have links');
for (const h of hrefs) {
  if (h.startsWith('#')) { await page.locator(`a[href="${h}"]`).first().click({ force: true }); continue; }
  if (h.startsWith('mailto:')) { assert.match(h, /^mailto:[^@\s]+@[^@\s]+$/); continue; }
  if (/^https?:\/\//.test(h)) { assert.ok(new URL(h)); continue; }
  const r = await page.request.get(ORIGIN + h); assert.ok(r.status() < 400, `landing link ${h} -> ${r.status()}`);
}
await Promise.all([page.waitForURL(/\/app/), page.locator('a[href="/app"]').first().click()]);

// 2. app: access-code gate and error taxonomy
await page.goto(ORIGIN + '/app'); await page.evaluate(() => localStorage.clear()); await page.reload();
await noteButtons();
await click(page.getByRole('button', { name: /See a sample letter/ }), 'see a sample letter');
await click(page.getByRole('button', { name: /Hide sample letter/ }), 'hide sample letter');
const code = page.getByPlaceholder(/ABCD-1234/);
mode = 'bad-code'; await code.fill('fake-code'); await click(page.getByRole('button', { name: /Validate/ }), 'validate');
await page.getByText(/was not accepted/).waitFor(); assert.equal(await code.inputValue(), 'FAKE-CODE', 'code must stay intact after invalid');
mode = 'outage'; await click(page.getByRole('button', { name: /Validate/ }), 'validate');
await page.getByText(/did not use up your access code/).waitFor(); assert.equal(await code.inputValue(), 'FAKE-CODE');
mode = 'ok'; await code.press('Enter'); await page.getByText('Step 1 of').waitFor();

// 3. walk every form step: fill, counters, tooltips, Back/Next
async function fillStep() {
  for (const el of await page.locator('input[type=text]:visible, textarea:visible').all()) { if (!(await el.inputValue())) await el.fill('Test value 123'); }
  for (const sel of await page.locator('select:visible').all()) { if (!(await sel.inputValue())) await sel.selectOption({ index: 1 }); }
}
let steps = 0;
while (!(await page.getByRole('button', { name: /Generate My Letter/ }).count())) {
  await noteButtons(); await fillStep();
  assert.ok((await page.getByTestId('char-counter').count()) > 0, 'counter missing on step ' + steps);
  const tip = page.locator('span:text-is("?")').first();
  if (await tip.count()) { await click(tip, '?'); await click(page.getByText('Close ×').first(), 'close'); }
  await click(page.getByRole('button', { name: /Next →|Review & Generate →/ }), 'next'); steps++;
  if (steps === 2) { await click(page.getByRole('button', { name: '← Back' }), 'back'); await fillStep(); await click(page.getByRole('button', { name: /Next →|Review & Generate →/ }), 'next'); }
  assert.ok(steps < 8, 'form did not reach Generate');
}
// input cap is enforced by the browser: maxLength on text and textarea fields
await page.goto(ORIGIN + '/app'); // reload keeps the step in state? no: steps are in memory; draft is what persists
const draft = await page.evaluate(() => localStorage.getItem('tf_form'));
assert.ok(draft && draft.includes('Test value 123'), 'draft must be saved to localStorage');
assert.ok(!draft.includes('FAKE-CODE'), 'access code must not be stored in the draft');
// after reload the code gate is back (codes are never persisted) -> re-enter, and the draft must repopulate the form
await code.fill('fake-code'); await click(page.getByRole('button', { name: /Validate/ }), 'validate'); await page.getByText('Step 1 of').waitFor();
assert.ok((await page.locator('input[type=text]:visible').first().inputValue()).includes('Test value 123'), 'draft must repopulate the form after reload');
for (const el of await page.locator('input[type=text]:visible').all()) assert.equal(await el.getAttribute('maxlength'), '200');
while (!(await page.getByRole('button', { name: /Generate My Letter/ }).count())) {
  await fillStep();
  for (const ta of await page.locator('textarea:visible').all()) assert.equal(await ta.getAttribute('maxlength'), '2000');
  await click(page.getByRole('button', { name: /Next →|Review & Generate →/ }), 'next');
}

// 4. generation error taxonomy then success
await noteButtons();
mode = 'gen-503'; await click(page.getByRole('button', { name: /Generate My Letter/ }), 'generate'); await page.getByText(/did not use up your access code/).waitFor();
mode = 'gen-400'; await click(page.getByRole('button', { name: /Generate My Letter/ }), 'generate'); await page.getByText(/too long/).waitFor(); await page.getByText(/access code is unchanged/).waitFor();
mode = 'ok'; await click(page.getByRole('button', { name: /Generate My Letter/ }), 'generate');
await page.getByText(/I appeal the assessment/).first().waitFor();
assert.ok(apiCalls.some(c => c.url.endsWith('/api/checklist') && c.body.accessCode === 'FAKE-CODE'), 'client must send accessCode to checklist');

// 5. letter step: tabs, PDF, copy, checklist, edit
await noteButtons();
await click(page.getByRole('button', { name: /Assertive/ }), 'assertive'); await click(page.getByRole('button', { name: /Standard/ }), 'standard');
// no markdown symbols anywhere in the displayed letter
const shown = await page.locator('div:has-text("Dear Board")').last().innerText();
assert.ok(/I appeal the assessment of my property/.test(shown) && shown.includes('Value: $250,000'), 'cleaned text is displayed: ' + shown);
assert.ok(!/\*\*|##|\|---/.test(shown), 'raw markdown visible in the UI: ' + shown);
// PDF: when jsPDF is missing the user sees an error (never a silent no-op) ...
await page.evaluate(() => { window.__jspdf = window.jspdf; delete window.jspdf; delete window.jsPDF; });
await click(page.getByRole('button', { name: /Download PDF/ }), 'download pdf');
await page.getByRole('alert').filter({ hasText: /PDF tool could not load/ }).waitFor();
// ... and with the real library (window.jspdf.jsPDF, the 2.5.1 UMD shape) a real, non-empty PDF file is downloaded
await page.evaluate(() => { window.jspdf = window.__jspdf; });
const [dl] = await Promise.all([page.waitForEvent('download'), click(page.getByRole('button', { name: /Download PDF/ }), 'download pdf')]);
assert.equal(dl.suggestedFilename(), 'TaxFight-Appeal-standard.pdf');
const pdfBytes = fs.readFileSync(await dl.path());
assert.ok(pdfBytes.length > 1000 && pdfBytes.subarray(0, 5).toString() === '%PDF-', 'a real PDF must be downloaded, got ' + pdfBytes.length + ' bytes');
const pdfText = pdfBytes.toString('latin1');
assert.ok(pdfText.includes('I appeal the assessment of my property') && pdfText.includes('Value: $250,000'), 'PDF must contain the letter text');
assert.ok(!pdfText.includes('**') && !pdfText.includes('## ') && !pdfText.includes('| Item'), 'raw markdown inside the PDF');
await click(page.getByRole('button', { name: /Copy Text/ }), 'copy text'); await page.getByText('Copied!').waitFor();
assert.match(await page.evaluate(() => navigator.clipboard.readText()), /I appeal the assessment/);
assert.ok(await page.getByText('Completed appeal form').isVisible(), 'checklist must render');
await click(page.getByRole('button', { name: /Edit Responses/ }), 'edit responses'); await page.getByText('Step 1 of').waitFor();

// every distinct button label seen anywhere must have been clicked at some point
const norm = s => s.replace(/[^A-Za-z? ]/g, '').trim().toLowerCase();
const unclicked = [...seen].filter(l => l && ![...clicked].some(c => norm(l).includes(norm(c)) || norm(c).includes(norm(l))));
assert.deepEqual(unclicked, [], 'buttons never exercised: ' + JSON.stringify(unclicked));
assert.deepEqual(problems.filter(p => !/Failed to load resource/.test(p)), [], 'console/page errors');

await browser.close(); server.close();
console.log(`ui-wiring: PASS (${seen.size} distinct button labels seen, ${clicked.size} exercised, ${hrefs.length} landing links checked, 0 console errors)`);
