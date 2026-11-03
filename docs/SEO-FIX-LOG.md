# TaxFightLetter (taxfightletter.com) — SEO Crawl-Unstick Log (v2, CORRECT REPO)

Directive: `CC-DIRECTIVE-TaxFightLetter-SEO-crawl-unstick-v2.md`
Date: 2026-06-27 · Mode: full-autonomy, log-and-continue · Standard: SSSCo/BuyAppsOnce v6.x
Repo: **`Skatehappy/taxfight`** (branch `master`) — cloned fresh to `C:\Users\jakld\taxfight-gh`.
Build only — **NOT deployed, NOT committed, NOT pushed.** Left as a working-tree diff for Rob to review.

---

## STEP 0 — Repo confirmation (verify, don't assume)

The directive's inferred name `Skatehappy/taxfightletter` **does not exist**. Searched `Skatehappy`'s
GitHub and found the real repo: **`Skatehappy/taxfight`**, confirmed as the live taxfightletter.com source:
- `scripts/data/config.js` → `domain: "taxfightletter.com"`; sitemap `<loc>` URLs are `taxfightletter.com`.
- Commit `571e5df "Programmatic SEO Phase 1: 10 states x 10 property tax dispute types"` + merge `3bb9e5f`.
- `public/` + `scripts/` present (generator + static output). ✓
(The stale local `C:\Users\jakld\taxfightletter` was NOT used.)

---

## STEP 1 — Inventory (ground truth)

- **Generator:** `scripts/build-pages.js`; data in `scripts/data/` (`states.js` = 10 states,
  `disputes.js` = 10 property-tax dispute types, `config.js`); templates `state-hub-template.js` +
  `deep-page-template.js`; content cache `scripts/data/generated/`.
- **Pages: 100 deep** `public/{state}/{topic}/index.html` + 10 state hubs + `landing.html`. URL pattern
  `/{state}/{topic}`. Tax topic slugs: `property-tax-assessment-appeal`, `over-assessed-property-value`,
  `homestead-exemption-denial`, `senior-tax-exemption-appeal`, `veteran-tax-exemption-appeal`,
  `disability-tax-exemption-appeal`, `commercial-property-tax-appeal`, `agricultural-use-valuation-appeal`,
  `property-tax-abatement-request`, `reassessment-after-damage`.
- **Static HTML confirmed** — content in raw source, Google-readable. ✓
- **Sitemap:** valid XML, **111 `<loc>` entries** (1 home + 10 states + 100 deep), 0 malformed/empty blocks.
- **CANONICALS (checked FIRST per directive — flagged as highest-probability cause for this weakest-ranking
  domain): CORRECT, self-referential** (`/{state}/{topic}` → itself; verified on 3 pages). **The
  homepage-pointing-canonical bug that would explain both the stuck pages AND the poor ranking is NOT
  present.** Ranking weakness is a separate content/authority matter, not a canonical defect.
- **robots.txt:** present, `Allow: /`, sitemap referenced. ✓
- **No stray `noindex`.** ✓
- **Existing internal linking:** deep pages ALREADY cross-link **18 siblings each**; state hubs link their
  10 topics + other states. **STEP 3 already implemented and exceeds the 3–6 target.**

### ROOT CAUSE (confirmed)
**Orphan-from-homepage.** The cluster cross-links itself densely, but the homepage (`landing.html`, served
at `/`) linked to **none** of it (only Payhip + the app). Google discovered the `/{state}/{topic}` URLs via
the sitemap **only** (weakest signal) → "Discovered – currently not indexed." Same root cause as the sibling
FightMyHOA app. Not canonicals, not noindex, not dead URLs.

---

## STEP 2 — Link hub (core fix)
- **New `scripts/templates/hub-template.js`** + generator wiring → emits **`public/letters/index.html`**
  (served at **`/letters`** via the existing `/:state` Vercel rewrite). Lists all 10 state hubs + all 100
  deep pages as real static `<a href>` with descriptive anchors ("Arizona Property Tax Assessment Appeal",
  …), grouped by state. Verified: **100 deep-page links + 10 state links**.
- **Linked from homepage:** two crawlable `<a href="/letters">` added to `public/landing.html` (hero button
  "Browse Letters by State →" + footer "All Property Tax Appeal Letters by State"). Every deep page is now
  ≤2 clicks from `/`.

## STEP 3 — Cross-link siblings
- **Already present (18 static cross-links/page)** in `deep-page-template.js`; no change needed. Verified on
  built pages. Rule already in place: same-topic-other-states + other-topics-same-state.

## STEP 4 — Sitemap + robots + canonicals
- **Sitemap regenerated:** `<lastmod>2026-06-27</lastmod>` on every entry + the new `/letters` (priority
  0.9). **112 URLs**, valid XML, 0 empty blocks. Priorities: `/` 1.0, `/letters` 0.9, states 0.8, deep 0.7.
- **robots.txt:** confirmed present + sitemap-referenced. ✓
- **Canonicals:** self-referential (verified, incl. hub → `/letters`). ✓  **noindex:** none. ✓

## STEP 5 — Build + verify (NOT deployed)
- `npm install` → `npm run generate:pages` (cached content, no AI regen; 10 hubs + 100 deep, **0 missing**)
  → `npm run build` (vite) → **succeeded**.
- **dist/ verified:** `dist/letters/index.html` = 100 deep links; `dist/sitemap.xml` = 112 URLs, lastmod
  today; `dist/landing.html` links `/letters` ×2; 3 deep pages each self-canonical + 18 cross-links.
- **NOT deployed.**

---

## Diff for Rob to review (clean — content-only; dist/ + node_modules/ gitignored)
- **M** `public/landing.html` — two `/letters` links (hero + footer).
- **M** `public/sitemap.xml` — lastmod=today on all + `/letters` (112 URLs).
- **M** `scripts/build-pages.js` — emit hub page; add lastmod + `/letters` to sitemap.
- **?? (new)** `scripts/templates/hub-template.js` — hub template.
- **?? (new)** `public/letters/index.html` — generated hub (commit as source).
- `landing.html.bak` (repo root) — safety backup, untracked, not for commit.

The 100 deep + 10 state pages regenerated identically (content unchanged); CRLF-only churn was reverted so
the diff stays clean. Their committed versions already carry the 18-sibling cross-links.

**Rob:** `git add scripts/templates/hub-template.js public/letters scripts/build-pages.js public/landing.html public/sitemap.xml`,
review, commit, push to `Skatehappy/taxfight` → Vercel deploys.

---

## RELEASE GATE
- Rob reviews diff → pushes → Vercel deploy.
- Rob requests indexing on **`https://taxfightletter.com/letters`** via GSC URL Inspection.
- Over 1–2 weeks the GSC "Discovered – currently not indexed" count should fall.
- Success metric = the count dropping, not this report.

## Single most likely root cause (as required)
**Orphan-from-homepage / no authoritative internal links into the cluster** — confirmed and fixed via the
hub + homepage links. The directive's flagged worst-case (homepage-pointing canonicals) was checked FIRST
and is **clean** — canonicals are correct, so the poor ranking (position ~26) is an authority/content-depth
matter, not a crawl/canonical defect; the internal-linking fix is still the correct unstick action.

## Out of scope / untouched (per directive)
`src/` app shell, `api/` letter-generation logic, page CONTENT (only links added), app version (not bumped).
Not deployed.
