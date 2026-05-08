# CSS Contrast Cascade Audit

## 1. Summary
The unreadable text in process cards comes from a broad dark-theme override in `seo.css` that forces light text on **all** `.card` content inside any `.dark` container. In `#process`, cards still use the default light card background (`var(--paper)`), so applying near-white heading/body text to those light cards collapses contrast.

## 2. Affected selectors

### Base card defaults (light card model)
Defined in `style.css`:
- `.card` → `background: var(--paper)` + light-surface border
- `.card h3` → default heading color inherited from page text color (dark in normal/light contexts)
- `.card p` → `color: var(--muted)` (dark-muted)

### Dark-context overrides that introduce the conflict
Defined in `seo.css`:
- `.dark .card { color: #f3f4fa; }`
- `.dark .card h3 { color: #f6f7fb; }`
- `.dark .card p { color: rgba(255,255,255,.78); }`

### Mentioned selectors that are *not* currently present
No explicit rules found for:
- `.section.dark .card`
- `.section.dark .card h3`
- `.section.dark .card p`

## 3. Why the process cards became unreadable
1. `#process` is declared as `<section class="section dark" id="process">`, so `.dark` styles apply to all descendants.
2. Base card styles keep cards visually light (`var(--paper)`), including in process cards.
3. `seo.css` adds global dark-container text overrides for `.dark .card`, `.dark .card h3`, `.dark .card p`.
4. Those selectors have higher specificity than base `.card p` and directly set light text colors, so paragraph/heading text becomes light while card background remains light.
5. Net effect: light-on-light card content inside an otherwise correct dark section.

## 4. Correct intended contrast model
The intended model should be split by **surface**, not only by ancestor theme:
- Dark section/container surface (`.section.dark`) → light text for section heading, supporting paragraph text, and quote content.
- Light nested card surface (`.card` with `background: var(--paper)` or other light fill) inside dark section → dark heading/body text.
- Dark quote / dark blocks inside dark section → keep light text.

In other words, dark-container typography and light-card typography must be decoupled.

## 5. Minimal safe fix recommendation
Do **not** remove dark section typography globally. Instead, scope the card exception where cards are explicitly light.

Recommended pattern:
1. Keep dark section text rules for section-level content (headings, descriptive paragraphs, quote).
2. Add a more specific override for light cards inside dark sections, for example:
   - `.section.dark .card { color: var(--ink); }`
   - `.section.dark .card h3 { color: var(--ink); }`
   - `.section.dark .card p { color: var(--muted); }`
3. If any genuinely dark cards exist inside dark sections in future, distinguish them with an explicit modifier class (e.g. `.card--dark`) rather than relying on ancestor `.dark` blanket card text rules.

This is minimal and safe because it restores dark text only on card surfaces, while preserving existing dark-section light typography elsewhere.

## 6. Risk areas to verify after fix
After applying a CSS fix (in a follow-up task), visually verify these blocks:
- Homepage process cards in `#process` (`.section.dark` + `.cards` + `.card`).
- `.timeline` cards in dark sections (`#method`) — currently light cards with muted text.
- `.pricing` cards (especially `.pricing .featured`, which is intentionally dark).
- `.seo-service-card` (light cards in cream/light sections).
- `.seo-faq details` and summary/body contrast.
- Request form block (`.section.dark.request`) — ensure section text remains light while `.form` stays dark-on-light.
- Service-page cards or reusable `.card` blocks rendered inside any `.section.dark` context.

---

Validation checklist for this audit task:
- Created only `contrast-cascade-audit.md`.
- No production CSS/HTML/JS/function files modified.
