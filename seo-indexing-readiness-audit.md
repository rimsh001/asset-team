# SEO Indexing Readiness Audit

## 1. Summary
Current status: **partially ready** for Yandex indexing submission.

The core indexing foundation is present (valid `sitemap.xml`, valid `robots.txt`, correct primary domain, homepage and all 9 target service pages present in sitemap, strong service-page canonicals, and non-empty titles/descriptions on target pages).

However, there are pre-indexing gaps: missing canonical tags on `method.html`, `privacy.html`, `thanks.html`, and `404.html`; `404.html` has no meta description; and favicon link coverage is limited mostly to homepage.

## 2. Sitemap audit

### Pass
- `sitemap.xml` exists.
- Sitemap domain is `https://aateam.ru/`.
- Homepage is included: `https://aateam.ru/`.
- All 9 required service pages are included:
  - `realizaciya-imushchestva-biznesa.html`
  - `prodazha-neprofilnyh-aktivov.html`
  - `prodazha-proizvodstvennyh-baz.html`
  - `prodazha-skladov-angarov.html`
  - `prodazha-kommercheskoy-nedvizhimosti.html`
  - `prodazha-oborudovaniya.html`
  - `prodazha-spectehniki.html`
  - `prodazha-skladskih-ostatkov.html`
  - `realizaciya-nelikvidnyh-tmc.html`
- `method.html` is included in sitemap.
- XML structure is valid (parsed successfully).

### Fail / risk notes
- `privacy.html` is included in sitemap (not always required for indexing; depends on policy).
- `thanks.html` and `404.html` are **not** included (this is generally correct for exclusion pages).

## 3. Robots.txt audit

### Pass
- `robots.txt` exists.
- Global indexing allowed: `Allow: /`.
- Important pages are not blocked by explicit rules.
- `Sitemap: https://aateam.ru/sitemap.xml` is present.
- Exclusion for `thanks.html` exists (`Disallow: /thanks.html`) — appropriate for thank-you page.

### Fail / risk notes
- `Disallow: /api/` and `Disallow: /forms.html` exist; no evidence they block target SEO pages.
- No explicit CSS/JS disallow directives were found in `robots.txt`.

## 4. Canonical audit

### OK
- Homepage canonical is correct: `https://aateam.ru/`.
- All 9 target service pages have self-referencing canonical URLs on `https://aateam.ru/`.
- No canonical references found to Netlify, GitHub Pages, InSales, or preview domains in audited pages.

### Missing / unclear
- `method.html`: canonical missing (indexing intent should be clarified; if indexed, add self-canonical).
- `thanks.html`: canonical missing (if excluded, can keep noindex/disallow strategy; canonical optional).
- `privacy.html`: canonical missing (recommended self-canonical if indexed).
- `404.html`: canonical missing (common to noindex this page; canonical optional).

## 5. Meta and title audit

### Pass
- Homepage and all 9 target service pages have non-empty `<title>` and meta description.
- Service page titles appear distinct (no exact duplicates detected among 9 service pages).
- Open Graph title/description are present on all 9 target service pages and homepage.

### Gaps
- `method.html` has title + description but no OG tags.
- `privacy.html` has title + description but no OG tags.
- `thanks.html` has title + description but no OG tags.
- `404.html` has title, but meta description is missing and no OG tags.

## 6. Favicon audit

### Found
- `favicon.svg` exists in repository.
- Homepage explicitly references favicon.

### Missing explicit favicon reference
- `thanks.html`
- `privacy.html`
- `404.html`
- `method.html`
- All 9 target service pages listed in scope

### Recommendation
- Add a consistent favicon link tag to all primary indexable pages (homepage + service pages + `method.html` if indexed) for UI consistency and tab branding.

## 7. Recommended indexing priority

### Priority 1 (submit first)
- `https://aateam.ru/`
- `https://aateam.ru/realizaciya-imushchestva-biznesa.html`
- `https://aateam.ru/prodazha-neprofilnyh-aktivov.html`
- `https://aateam.ru/prodazha-proizvodstvennyh-baz.html`
- `https://aateam.ru/prodazha-skladov-angarov.html`
- `https://aateam.ru/prodazha-kommercheskoy-nedvizhimosti.html`
- `https://aateam.ru/prodazha-oborudovaniya.html`
- `https://aateam.ru/prodazha-spectehniki.html`
- `https://aateam.ru/prodazha-skladskih-ostatkov.html`
- `https://aateam.ru/realizaciya-nelikvidnyh-tmc.html`

### Priority 2
- `https://aateam.ru/method.html`
- Secondary supporting commercial pages already in sitemap (e.g., thematic support pages tied to services)

### Priority 3
- `https://aateam.ru/privacy.html` (if needed in index for legal transparency)
- Other legal/support pages only if there is an explicit SEO reason

## 8. Pages to exclude or deprioritize
- `thanks.html`: should remain excluded from indexing (already disallowed in robots).
- `404.html`: should be excluded/noindexed from indexing.
- `privacy.html`: optional indexing; typically low-priority and not a landing target.

## 9. Issues found

### P1 (must fix before indexing)
1. Define canonical policy for `method.html` and implement consistently if page is intended for indexing (currently no canonical).
2. Ensure explicit exclusion strategy for `404.html` is consistent (typically `noindex`, and avoid sitemap inclusion).

### P2 (should fix soon)
1. Add self-canonical for `privacy.html` if it remains in sitemap/indexing scope.
2. Add meta description to `404.html` (or noindex the page and treat as utility page).
3. Add favicon link to service pages + `method.html` for consistent UX signals.

### P3 (optional SEO improvement)
1. Add OG tags to `method.html`, `privacy.html`, `thanks.html` where social previews are relevant.
2. Re-evaluate whether `privacy.html` should stay in sitemap or be deprioritized.

## 10. Recommended next actions
1. Canonical pass task:
   - Add/normalize canonical tags for `method.html` and `privacy.html`.
   - Confirm canonical handling for utility pages (`thanks.html`, `404.html`).
2. Indexing controls task:
   - Implement explicit noindex strategy for non-search pages (`thanks.html`, `404.html`) if not already handled server-side.
3. Metadata hardening task:
   - Add missing description for `404.html` (if indexable) and optional OG tags on non-service pages.
4. Favicon consistency task:
   - Add favicon link element across key templates/pages.
5. Pre-submit verification task:
   - Re-run sitemap/robots/canonical audit and then submit Priority 1 URLs to Yandex Webmaster.

---

## Validation
- Created only: `seo-indexing-readiness-audit.md`.
- No production HTML/CSS/JS/function files were modified.
- `robots.txt` and `sitemap.xml` were audited only and not changed.
