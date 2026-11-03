# TaxFightLetter — SEO Crawl Fix Log

**Date:** 2026-07-13
**Objective:** Create/repair `robots.txt` and verify `sitemap.xml` so Google stops crawling the
private SPA at `/app` and can discover every programmatic letter page.
**Standing rules:** No questions back; log-and-continue on ambiguity.

---

## Phase 1 — Repo reconnaissance

**Two local copies share the same GitHub remote (`Skatehappy/taxfight`):**

| Path | State | Verdict |
|---|---|---|
| `C:\Users\jakld\taxfight` | Older/leaner: `public/` has only `landing.html` + `sitemap.xml`, **no** state folders, **no** `robots.txt`. Last commit "Fix root redirect for landing page". Remote URL embeds a PAT. | **Not canonical** — stale. |
| `C:\Users\jakld\taxfight-gh` | Complete: `public/` has all 10 state folders + `/letters` hub + `robots.txt` + `sitemap.xml`. Most recent SEO commit ("SEO: add /letters hub, link from homepage, refresh sitemap"). Branch `master`, ahead of `origin` by 1 (unpushed). | **CANONICAL — operated here.** |

**Ambiguity logged (per standing rule):** the directive named `C:\NEWEST OF THE NEW\`; the project is
actually at the two paths above. Chose `taxfight-gh` because it is the only copy containing the
programmatic letter pages this task exists to protect, plus the newest SEO work.

- **Static root:** `C:\Users\jakld\taxfight-gh\public\`  (Vite `public/` — served at web root, copied to `dist/` on build).
- **Framework/host:** Vite static build on Vercel (`vercel.json` rewrites; no server-side app for pages).
- **URL patterns of the programmatic pages:**
  - `/{state}`            → `public/{state}/index.html`      (10 state landing pages)
  - `/{state}/{dispute}`  → `public/{state}/{dispute}/index.html`  (10 dispute letters per state)
  - `/letters`            → `public/letters/index.html`       (hub)
  - `/`                   → `landing.html` (redirect+rewrite in `vercel.json`)
  - `/app`, `/app/*`      → `index.html` (the private React SPA — the thing Google should NOT crawl)
- **States:** arizona, california, florida, georgia, illinois, new-york, north-carolina, ohio, pennsylvania, texas.

**Existing `robots.txt` (before):**
```
User-agent: *
Allow: /
Sitemap: https://taxfightletter.com/sitemap.xml
```
→ No `/app` disallow. This is the defect: Google was free to crawl the SPA shell at `/app`.

**Existing `sitemap.xml`:** present, 112 `<loc>` entries, `lastmod` 2026-06-27. Already contained zero
`/app` URLs and all letter pages (see Phase 3 verification).

---

## Phase 2 — robots.txt

Edited `public/robots.txt` in place — preserved the existing `Allow: /` and `Sitemap:` lines, added the
`/app` disallow:
```
User-agent: *
Allow: /
Disallow: /app
Disallow: /app/

Sitemap: https://taxfightletter.com/sitemap.xml
```

---

## Phase 3 — sitemap.xml (verify)

Cross-checked the sitemap against the actual files on disk:

- Actual pages on disk: 10 states × (1 index + 10 disputes) = **110**, + `/letters` (1) + `/` (1) = **112**.
- Sitemap `<loc>` count: **112** — exact match, no missing and no stale entries.
- `/app` URLs in sitemap: **0**.

No changes required — the sitemap was already correct and complete. (Left as-is; not regenerated.)

---

## Phase 4 — vercel.json

`vercel.json` uses modern `rewrites` (not legacy `routes`). Vercel applies rewrites **only to paths that
do not match a static file**. `robots.txt` and `sitemap.xml` are real files in `public/`, so they are
served directly and the `/:state` param rewrite never intercepts them. **No change needed.**

The `/app` → `/index.html` rewrites remain intentionally (the SPA still works for real users); crawling is
blocked at the `robots.txt` layer, which is the correct control point.

---

## Phase 5 — Validation

- `robots.txt`: contains `Disallow: /app`, `Disallow: /app/`, and the `Sitemap:` line. ✅
- `sitemap.xml`: XML well-formed (parsed OK), 112 URLs, **0** `/app` entries, all letter pages present. ✅
- `vercel.json`: no rewrite/redirect intercepts `robots.txt` or `sitemap.xml`. ✅

### Follow-up (manual, outside this task)
1. **Deploy** — these changes are committed/edited locally only. Commit + push `taxfight-gh` (or deploy via
   Vercel) so the new `robots.txt` goes live. Not auto-pushed (not requested; and this copy's remote URL has
   no auth token, unlike the `taxfight` copy).
2. **Google Search Console** — after deploy, (a) resubmit `https://taxfightletter.com/sitemap.xml`, and
   (b) optionally use "Removals" to speed up de-indexing of any already-indexed `/app` URLs. `robots.txt`
   stops future crawling but does not by itself remove already-indexed pages.
3. **Stale copy** — `C:\Users\jakld\taxfight` still lacks `robots.txt`; ignore it unless it becomes the
   deploy source.
