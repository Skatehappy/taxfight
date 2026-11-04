import assert from 'node:assert/strict';
import { scanText } from './check-claims.mjs';
const bad = ['Attorney-quality letter', 'attorney quality', 'LAWYER-QUALITY', 'lawyer grade', 'attorney-written', 'Attorney-drafted', 'a real lawyer', 'Get legal advice for $19', 'We give legal advice.', 'saves you from paying for legal advice'];
for (const t of bad) assert.ok(scanText(t).length > 0, 'should flag: ' + t);
const ok = ['This is not legal advice.', 'Letters do not constitute legal advice. Verify dates.', "It isn't legal advice", 'TaxFight does not give legal advice.', 'Consult a licensed attorney.', 'Do I need a lawyer to appeal?', 'a clear, well-organized letter'];
for (const t of ok) assert.deepEqual(scanText(t), [], 'should pass: ' + t);
// negation in a different sentence must not excuse a claim
assert.ok(scanText('Not a law firm. We give legal advice.').length > 0);
console.log('claims check tests ok');
