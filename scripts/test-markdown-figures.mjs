// stripMarkdown (letters render and export as clean text) + spelled-out / parenthetical figure lint.
import assert from 'node:assert/strict';
import { stripMarkdown } from '../api/_markdown.js';
import { figures, findUnverified, stripUnverified, wordsToNumber } from '../api/_citelint.js';

// ---- stripMarkdown ----
const md = [
  '# Formal Appeal', '', '## Grounds for Appeal', 'The **assessed value** is __wrong__ and *clearly* excessive, see _comparable_ sales.',
  '', '* First point', '+ Second point', '- Third point', '1. Numbered stays', '',
  '| Address | Sale Price | Date |', '|---|---:|:---|', '| 12 Oak St | $250,000 | May 2026 |', '| 14 Oak St | $240,000 | June 2026 |', '',
  '```', 'code line', '```', '---', 'Use `parcel 123` and [the form](https://example.com/form).', '> quoted line', '', '', '', 'Sincerely,', '____________',
].join('\n');
const out = stripMarkdown(md);
assert.ok(!/[#*|`]/.test(out.replace(/\$/g, '')), 'no markdown symbols left: ' + out);
assert.ok(!/__[a-z]|\*\*|---/.test(out), out);
assert.match(out, /^Formal Appeal\n\nGrounds for Appeal\nThe assessed value is wrong and clearly excessive, see comparable sales\./);
assert.match(out, /^- First point\n- Second point\n- Third point\n1\. Numbered stays$/m);
assert.match(out, /^- Address: 12 Oak St; Sale Price: \$250,000; Date: May 2026$/m);
assert.match(out, /^- Address: 14 Oak St; Sale Price: \$240,000; Date: June 2026$/m);
assert.ok(out.includes('code line') && !out.includes('```'));
assert.ok(out.includes('Use parcel 123 and the form (https://example.com/form).'));
assert.ok(out.includes('quoted line') && !out.includes('> '));
assert.ok(out.includes('____________'), 'signature blank kept');
assert.ok(!/\n{3,}/.test(out));
// idempotent, and plain text / legal symbols pass through untouched
assert.equal(stripMarkdown(out), out);
const plain = 'Dear Board,\nUnder Tex. Tax Code § 41.44(a) the deadline is 30 days; 2 * 3 = 6 and snake_case_name stay.\nSincerely';
assert.equal(stripMarkdown(plain), plain);
assert.equal(stripMarkdown(''), ''); assert.equal(stripMarkdown(undefined), '');
// table without a header separator still becomes readable lines
assert.equal(stripMarkdown('| a | b |\n| c | d |'), '- a; b\n- c; d');

// ---- spelled-out figures ----
const f = t => [...figures(t)].sort().join(',');
assert.equal(wordsToNumber('thirty-six'), 36); assert.equal(wordsToNumber('one hundred and five'), 105); assert.equal(wordsToNumber('five hundred'), 500);
assert.equal(wordsToNumber('two thousand'), 2000); assert.equal(wordsToNumber('ninety-nine'), 99);
assert.equal(f('thirty (30) days'), '30d');
assert.equal(f('thirty days'), '30d');
assert.equal(f('thirty-six days'), '36d');
assert.equal(f('a sixty-day period'), '60d');
assert.equal(f('(45) calendar days'), '45d');
assert.equal(f('30 (thirty) days'), '30d');
assert.equal(f('ten percent'), '10%');
assert.equal(f('ten percent (10%)'), '10%');
assert.equal(f('ninety-nine per cent'), '99%');
assert.equal(f('five hundred dollars'), '$500');
assert.equal(f('five hundred dollars ($500)'), '$500');
assert.equal(f('two thousand dollars'), '$2000');
assert.equal(f('250 dollars'), '$250');
assert.equal(f('one day'), '', '"one day" is prose, not a deadline claim');
assert.equal(f('the thirty-first day'), '', 'ordinals are not figures');
assert.equal(f('five years and six months'), '', 'month/year windows are intentionally not tracked');
assert.equal(f('the 30 days and $500 and 10%'), '$500,10%,30d');

// ---- lint: caught vs not caught ----
const keys = ['S:41.44'];
const opts = { subs: {}, nums: ['30d', '$500', '10%'], input: 'My assessed value is $285,000. I have fifteen (15) days left.' };
const caught = s => findUnverified(s, keys, opts).map(b => b.key);
// unverified spelled-out figures are caught
assert.deepEqual(caught('You must file within forty-five days of the notice.'), ['N:45d']);
assert.deepEqual(caught('You must file within forty-five (45) days of the notice.'), ['N:45d']);
assert.deepEqual(caught('The deadline is sixty days after mailing.'), ['N:60d']);
assert.deepEqual(caught('A penalty of twenty percent applies to late filings.'), ['N:20%']);
assert.deepEqual(caught('The filing fee is two hundred dollars.'), ['N:$200']);
assert.deepEqual(caught('The late fee is two hundred dollars ($200).'), ['N:$200']);
assert.deepEqual(caught('Interest accrues at twelve per cent per year.'), ['N:12%']);
// verified figures (any spelling) and user-supplied figures (digits or words) are NOT caught
assert.deepEqual(caught('You must file within thirty (30) days of the notice.'), []);
assert.deepEqual(caught('You must file within thirty days of the notice.'), []);
assert.deepEqual(caught('A penalty of ten percent applies to late filings.'), []);
assert.deepEqual(caught('The filing fee is five hundred dollars.'), []);
assert.deepEqual(caught('My appeal is due within fifteen days, a deadline I was given.'), []);
assert.deepEqual(caught('My notice lists a value of two hundred eighty-five thousand dollars in the appeal.'), [], 'user-supplied $285,000 spelled out');
// figures outside a legal-context sentence are left alone (same rule as digits)
assert.deepEqual(caught('The home was built in a sixty-year-old style.'), []);
// stripping drops only the offending sentence
const stripped = stripUnverified('Protest rights arise under § 41.44. You must file within forty-five days. The value is too high.', keys, opts);
assert.ok(!stripped.includes('forty-five') && stripped.includes('41.44') && stripped.includes('too high'), stripped);
// the verified allowlist is built with the same figures(): spelled-out figures in the verified log are verified
assert.equal(f('The owner has thirty (30) days to protest.'), '30d');

console.log('markdown + spelled-figures tests: PASS');
