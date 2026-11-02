// api/_g4t.js — G4T- Gate 4 test code, shared by generate + checklist.
// Inert unless G4_TEST_CODE_SECRET is set in Vercel env (no default). Code form: G4T-<secret>.
// Skips the Payhip verify and the usage mark. Capped per UTC day per bucket (generate / checklist).
// Counters live in module memory: best-effort, reset on a cold start, not shared between instances.
// Rotate/unset the secret to shut the path off. No node: imports so it is safe on any runtime.
const CAP = 10;
const state = {};

export function isG4TCode(code) {
  const secret = process.env.G4_TEST_CODE_SECRET;
  const c = (code || '').trim();
  if (!secret || !c.toUpperCase().startsWith('G4T-')) return false;
  // the app uppercases typed codes, so compare case-insensitively (constant-time over the longer length)
  const a = c.slice(4).toUpperCase(), b = secret.toUpperCase();
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function g4tTake(bucket) {
  const day = new Date().toISOString().slice(0, 10);
  const s = state[bucket] || (state[bucket] = { day: '', n: 0 });
  if (s.day !== day) { s.day = day; s.n = 0; }
  if (s.n >= CAP) return false;
  s.n++;
  console.log(JSON.stringify({ event: 'g4t_use', bucket, day, n: s.n, cap: CAP }));
  return true;
}
