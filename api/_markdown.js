// api/_markdown.js — stripMarkdown: model output / letter text -> clean plain text (no node: imports; used by the
// server before linting and by the client before display, copy and PDF). Idempotent.
const SEP_ROW = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

export function stripMarkdown(input) {
  if (typeof input !== 'string' || !input) return input || '';
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) continue;                                  // code fence markers (content kept)
    if (/^\s*([-*])(\s*\1){2,}\s*$/.test(line)) { out.push(''); continue; }    // horizontal rules (underscore runs are signature blanks: kept)
    if (/^\s*\|.*\|?\s*$/.test(line) && line.includes('|')) {                  // table block
      const block = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) block.push(lines[i++]);
      i--;
      const hasHeader = block.length > 1 && SEP_ROW.test(block[1]);
      const header = hasHeader ? cells(block[0]) : null;
      for (let r = hasHeader ? 2 : 0; r < block.length; r++) {
        if (SEP_ROW.test(block[r])) continue;
        const cs = cells(block[r]);
        const parts = cs.map((c, k) => (header && header[k] && c ? `${header[k]}: ${c}` : c)).filter(Boolean);
        if (parts.length) out.push('- ' + parts.join('; '));
      }
      if (hasHeader && block.length === 2) out.push(header.filter(Boolean).join(', '));
      continue;
    }
    line = line.replace(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/, '$1');               // headings
    line = line.replace(/^\s{0,3}>\s?/, '');                                    // blockquote
    line = line.replace(/^(\s*)[*+•]\s+/, '$1- ');                              // bullets -> plain '-'
    out.push(line);
  }
  let t = out.join('\n');
  t = t.replace(/\*\*\*(?=\S)([^*\n]+?)\*\*\*/g, '$1')
       .replace(/\*\*(?=\S)([^*\n]+?)\*\*/g, '$1')
       .replace(/(?<![\w_])__(?=\S)([^_\n]+?)__(?![\w_])/g, '$1')
       .replace(/(?<![\w*])\*(?=[^\s*])([^*\n]+?)(?<=[^\s*])\*(?![\w*])/g, '$1')
       .replace(/(?<![\w_])_(?=[^\s_])([^_\n]+?)(?<=[^\s_])_(?![\w_])/g, '$1')
       .replace(/`([^`\n]+)`/g, '$1')
       .replace(/\[([^\]\n]+)\]\((https?:[^)\s]+)\)/g, '$1 ($2)');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}
