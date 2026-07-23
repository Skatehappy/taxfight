// scripts/templates/enrichment.js — TaxFight (property-tax appeal domain)
// SEO Phase 2: injects verified, state-specific property-tax sections BELOW the
// existing page content, driven by scripts/data/state-data.json so prose reflects
// each state's actual framework (a 40%-ratio state reads differently from a
// full-market-value state; a 45-day deadline differently from a Grievance-Day one).

function esc(s){ if(s==null) return ''; return String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function has(v){ if(v==null) return false; const s=String(v).trim(); return s!=='' && s.toLowerCase()!=='null' && s.toLowerCase()!=='n/a'; }
function clean(s){ return String(s==null?'':s).trim().replace(/\s+/g,' ').replace(/\.+$/,''); }
function sent(s){ const t=clean(s); return t?t+'.':''; }
function article(w){ return /^[aeiou]/i.test(String(w).trim())?'an':'a'; }

// dispute slug -> which fields to foreground in "How to Appeal"
const TOPIC_EMPHASIS = {
  'property-tax-assessment-appeal':   ['appeal_deadline','first_level_appeal','evidence_accepted'],
  'over-assessed-property-value':     ['assessment_ratio','evidence_accepted','appeal_deadline'],
  'homestead-exemption-denial':       ['exemptions','first_level_appeal'],
  'senior-tax-exemption-appeal':      ['exemptions','first_level_appeal'],
  'veteran-tax-exemption-appeal':     ['exemptions','first_level_appeal'],
  'disability-tax-exemption-appeal':  ['exemptions','first_level_appeal'],
  'agricultural-use-valuation-appeal':['assessment_ratio','grounds_for_appeal'],
  'commercial-property-tax-appeal':   ['evidence_accepted','second_level_appeal'],
  'property-tax-abatement-request':   ['first_level_appeal','exemptions'],
  'reassessment-after-damage':        ['assessment_cycle','grounds_for_appeal'],
};
const RIGHTS = [
  ['appeal_deadline','Appeal deadline'],
  ['first_level_appeal','First-level appeal'],
  ['second_level_appeal','Next-level appeal'],
  ['grounds_for_appeal','Grounds you can raise'],
  ['evidence_accepted','Evidence that works'],
  ['assessment_ratio','How your value is assessed'],
  ['exemptions','Exemptions to claim'],
  ['hearing_format','The hearing'],
];

function overviewProse(state,d){
  const st=d.property_tax_statute||{};
  const paras=[];
  paras.push(`Property tax in ${state} is governed by the ${st.name||'state property tax code'}${has(st.citation)?` (${st.citation})`:''}. ${has(d.assessment_cycle)?`Assessment cycle: ${sent(d.assessment_cycle)}`:''} ${has(d.assessment_ratio)?`Assessed value: ${sent(d.assessment_ratio)}`:''}`.trim());
  const rb=d.regulatory_body||'';
  if(has(rb)) paras.push(`${sent(rb)} ${has(d.appeal_deadline)?`The window to act is short — ${lcFrag(d.appeal_deadline)}`:''}`.trim());
  if(has(d.recent_reform) && !/^(no|none)\b/i.test(d.recent_reform)) paras.push(`A recent change to watch: ${sent(d.recent_reform)}`);
  return paras;
}
function lcFrag(s){ const t=clean(s); return t?sent(t.charAt(0).toLowerCase()+t.slice(1)):''; }

export function renderEnrichmentSections(state, dispute, d){
  if(!d) return '';
  const S=state.name;
  const overview=overviewProse(S,d).filter(has).map(p=>`      <p>${esc(p)}</p>`).join('\n');

  const emph=TOPIC_EMPHASIS[dispute.slug]||RIGHTS.map(r=>r[0]);
  const order=[...emph, ...RIGHTS.map(r=>r[0]).filter(k=>!emph.includes(k))];
  const labelOf=Object.fromEntries(RIGHTS);
  const rights=order.map(k=>{ const v=d[k]; if(!has(v)) return ''; return `      <p><strong>${esc(labelOf[k])}:</strong> ${esc(sent(v))}</p>`; }).filter(Boolean).join('\n');

  const fileBits=[];
  if(has(d.first_level_appeal)) fileBits.push(`First, ${lcFrag(d.first_level_appeal)}`);
  if(has(d.second_level_appeal)) fileBits.push(`If that fails, ${lcFrag(d.second_level_appeal)}`);
  if(has(d.appeal_deadline)) fileBits.push(`Mind the deadline: ${lcFrag(d.appeal_deadline)}`);
  const fileBody = fileBits.length ? fileBits.map(b=>`      <p>${esc(b)}</p>`).join('\n')
    : `      <p>${esc(S)} property-tax appeals start at the county assessment board and, if needed, move to a state tax tribunal or court — a written, evidence-backed appeal filed before the deadline is the essential first step.</p>`;

  const issues=Array.isArray(d.common_disputes)?d.common_disputes.filter(has):[];
  const issuesList=issues.length?`      <ul>\n${issues.map(i=>`        <li>${esc(i)}</li>`).join('\n')}\n      </ul>`:`      <p>The most common ${esc(S)} property-tax disputes involve overvaluation, uniformity, and denied exemptions.</p>`;

  const feats=Array.isArray(d.unique_features)?d.unique_features.filter(has):[];
  const featBlock=feats.length?`    <section class="enrich-section">
      <h2>${esc(S)} Property Tax Provisions Worth Knowing</h2>
      <ul>\n${feats.slice(0,4).map(f=>`        <li>${esc(f)}</li>`).join('\n')}\n      </ul>
    </section>`:'';

  return `
  <div class="enrich">
    <section class="enrich-section">
      <h2>${esc(S)} Property Tax Overview</h2>
${overview}
    </section>
    <section class="enrich-section">
      <h2>How to Appeal Your ${esc(S)} Assessment</h2>
${rights}
    </section>
    <section class="enrich-section">
      <h2>Where to File in ${esc(S)}</h2>
${fileBody}
    </section>
    <section class="enrich-section">
      <h2>Common Property Tax Disputes in ${esc(S)}</h2>
${issuesList}
    </section>
${featBlock}
  </div>`;
}

export function dataFaqs(state, d){
  if(!d) return [];
  const S=state.name; const out=[];
  if(has(d.appeal_deadline)) out.push({q:`What is the property tax appeal deadline in ${S}?`, a:sent(d.appeal_deadline)});
  if(has(d.first_level_appeal)) out.push({q:`Where do I appeal my property assessment in ${S}?`, a:`${sent(d.first_level_appeal)}${has(d.second_level_appeal)?' If unresolved, '+lcFrag(d.second_level_appeal):''}`});
  if(has(d.exemptions)) out.push({q:`What property tax exemptions does ${S} offer?`, a:sent(d.exemptions)});
  else if(has(d.assessment_ratio)) out.push({q:`How is my property assessed in ${S}?`, a:sent(d.assessment_ratio)});
  return out.slice(0,3);
}

export function stateLawSnapshot(stateName, d){
  if(!d) return '';
  return overviewProse(stateName,d)[0]||'';
}

export function stateTeaser(state, d){
  if(!d) return '';
  const st=d.property_tax_statute||{};
  const bits=[];
  if(has(st.name)) bits.push(`Governed by ${st.name}`);
  if(has(d.appeal_deadline)) bits.push(`appeal by ${clean(d.appeal_deadline).replace(/\.$/,'')}`);
  return bits.join('; ') || 'Property-tax assessment appeals';
}
