// api/_voicelint.js - owner-voice lint. Letters are written and signed by the property owner in their own name, so any
// attorney / counsel / law-firm / representative self-description is rejected. Patterns are phrase-level so normal owner
// text ("consult an attorney", "attorney's fees", "hire an attorney for the hearing") never matches.
export const OWNER_VOICE_RULE = '\n\nVOICE RULE: The letter is written and signed by the property owner in their own name ([Your Name]). Never describe the writer as an attorney, counsel, law firm, tax representative or agent and never sign for a client.';

// Normalize: curly quotes -> straight, NBSP / zero-width removed or collapsed, runs of spaces/tabs -> one space
// (newlines are kept: they mark the start of a signature / title line), lower-case.
export const normalizeVoice = s => String(s ?? '')
  .replace(/[‘’‛′]/g, "'").replace(/[“”‟″]/g, '"')
  .replace(/[​-‍⁠﻿]/g, '').replace(/[^\S\n]+/g, ' ').toLowerCase();

// A title / role position: start of text, a new line, or after punctuation ("Jane Doe, Attorney for the Owner").
const TITLE = '(?:^|[\\n,;:.\\u2013\\u2014(-])\\s*';
const ROLE = '\\b(?:as|am|is|are|be|serving as)\\s+(?:the |an? )?';
const PATTERNS = [
  ['Attorney for', new RegExp(`${TITLE}attorneys?\\s+for\\b|${ROLE}attorneys?\\s+for\\b`)],
  ['Esq.', /\besq\b/],
  ['Esquire', /\besquire\b/],
  ['counsel for', new RegExp(`${TITLE}counsel\\s+for\\b|${ROLE}counsel\\s+for\\b`)],
  ['on behalf of my client', /\bon behalf of (?:my|our) clients?\b/],
  ['my client', /\bmy clients?\b/],
  ['our client', /\bour clients?\b/],
  ['this firm represents', /\bthis firm represents\b/],
  ['attorney at law', /\battorneys? at law\b/],
  ['law office of', /\blaw offices? of\b/],
];

// -> the first banned phrase found (display form) or null.
export function findVoiceViolation(text) {
  const t = normalizeVoice(text);
  for (const [name, re] of PATTERNS) if (re.test(t)) return name;
  return null;
}
export const BANNED_PHRASES = PATTERNS.map(p => p[0]);
