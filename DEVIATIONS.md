# Deviations from MASTER_SPEC.md

Logged per user instruction.

## 1. `scripts/generate-content.js` — dotenv loading and statute regex

Replaced `import 'dotenv/config'` with explicit `dotenv.config({ path: '.env.local' })` plus `.env` fallback (default dotenv reads `.env` only; spec mandates `.env.local`).

Validation regex extended to `/§|Section|Title|Code|Stat\.|Statute|ILCS|Compiled Statutes/i` (case-insensitive, plus ILCS support) so Illinois citations like `35 ILCS 200/16-55` validate.

## 2. `scripts/build-pages.js` — defensive sitemap filter

Spec section 10's sitemap-array construction is augmented with `.filter(u => u && u.includes('<loc>'))` so any future malformed entry without a `<loc>` is dropped before Google Search Console sees it. Per packet section 6 instruction: "APPLY THE SITEMAP FILTER FIX".

## 3. `.gitignore` — broader contents than spec

Created full `.gitignore` (no prior file existed) including standard Vite/Node ignores plus the spec's `.env.local` and `_failures.log` lines.

## 4. App.jsx URL-param dispute mappings

Packet section 3 provides example slug→dispute-type mappings. The existing form is structured around `propertyType` and `reasonForAppeal`, not a generic dispute-type dropdown. Mapping uses the form's actual fields:

| slug | reasonForAppeal | propertyType |
|---|---|---|
| property-tax-assessment-appeal | Assessed value exceeds fair market value | (unset) |
| over-assessed-property-value | Assessment higher than comparable properties | (unset) |
| homestead-exemption-denial | Other | (unset) |
| senior-tax-exemption-appeal | Other | (unset) |
| veteran-tax-exemption-appeal | Other | (unset) |
| disability-tax-exemption-appeal | Other | (unset) |
| agricultural-use-valuation-appeal | Other | Vacant Land |
| commercial-property-tax-appeal | Assessed value exceeds fair market value | Commercial |
| property-tax-abatement-request | Other | (unset) |
| reassessment-after-damage | Property condition not reflected (damage, deterioration) | (unset) |

Reason: per packet's own instruction "URL params must map to strings the form actually accepts." Several SEO slugs (exemption appeals) collapse to "Other" because the form doesn't have exemption categories — users can refine in the form. The form is primarily designed for residential over-valuation appeals.

## 5. Repo path mismatch

Packet header says repo "likely C:\\Projects\\taxfightletter\\taxfightletter". Actual is `C:/Projects/taxfight` with GitHub remote `Skatehappy/taxfight`. Domain `taxfightletter.com` is correct (verified in `public/landing.html`). Per packet's own "verify exact local path" instruction.
