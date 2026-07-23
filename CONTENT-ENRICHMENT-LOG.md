# TaxFight — Content Enrichment Log (SEO Phase 2)

Date: 2026-07-22 · Directive: CC-DIRECTIVE-All-Letter-Apps-Content-Enrichment.md (app 5, done alongside 2-3)

## Inventory
Same generator as hoafight: 10 states × 10 property-tax dispute topics + 10 state
hubs + 1 `/letters` hub = 111 canonical pages.

## Technical SEO
`vercel.json`: fixed the homepage redirect — replaced the redundant `/` → `/landing.html`
301 (the rewrite already serves the landing page at `/`) with `/landing.html` → `/`
so the `.html` alternate consolidates to the canonical root. Canonicals + sitemap
already bare-domain `https://taxfightletter.com`.

## STEP 1 — state-data.json (10 states)
Verified per-state property-tax data (statute, assessment cycle/ratio, appeal
deadline, first/second-level appeal, grounds, evidence, hearing format, exemptions,
tax-lien process, regulatory body, unique features, common disputes, recent reform).
WebSearch-sourced (Perplexity unavailable). **51 sources** in
`VERIFICATION_LOG-SEO-CONTENT.md`. Differentiation: CA (Prop 13 base-year, Sep15/Nov30
two-deadline, tax-deed), TX (100% + 10% homestead cap, ARB/May-15, 2025 Prop 13 $140k),
FL (Save Our Homes 3%, 25-day TRIM/VAB), NY (Grievance Day, SCAR vs Article 7), IL
(33⅓% / Cook 10-25%, PTAB), PA (base-year + Common Level Ratio), OH (35%, DTE-1/Mar-31,
BOR→BTA), GA (40%, 45-day, HB 581 floating homestead), NC (100%, octennial, PTC), AZ
(FCV vs LPV 5% cap, 60-day/NOV, Prop 130).

## STEP 2-3 — Generator + verify
Ported the shared `enrichment.js` pattern (property-tax fields + topic map:
overvaluation→assessment_ratio/evidence; exemption→exemptions; process→first/second
appeal; lien→tax_lien_process). 4 sections (Property Tax Overview / How to Appeal /
Where to File / Common Disputes + Provisions-Worth-Knowing) below existing content;
2-3 data-derived FAQ Q&As merged into FAQPage JSON-LD (8/page); state-hub snapshot.
Regenerated 111 pages (URLs unchanged); modules compile; JSON-LD valid. Build only.
