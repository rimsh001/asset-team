# Button & Link Audit Report

## 1) Executive summary
- HTML pages checked: **27**
- Total links/CTAs checked: **408 elements** (379 `<a>`, 26 `<button>`, 3 `<form>`)
- Broken or suspicious links: **37**
- CTA wording issues: **28**
- Recommended changes: **34**

## 2) Table: main CTAs by page

| Page | Button / link text | Current href | Target exists? | User intent | Verdict | Recommended href | Recommended text | Reason |
|---|---|---|---|---|---|---|---|---|
| index.html | Получить разбор | #request | anchor | Leave request | rename | #request | Оставить заявку | Keep destination, normalize wording |
| index.html | Получить первичный разбор | #request | anchor | Leave request | rename | #request | Передать актив на рассмотрение | Wording not in preferred set |
| index.html | Запросить разбор | #request | anchor | Leave request | rename | #request | Проверить актив на реализуемость | Avoid “разбор” as primary CTA |
| index.html | Написать в Telegram | /api/contact-telegram | no | Open messenger | fix | external Telegram deep-link | Написать в Telegram | Current route not a static page |
| index.html | Написать в MAX | /api/contact-max | no | Open messenger | fix | external MAX link | Написать в MAX | Current route not a static page |
| asset-review.html | Получить разбор | #request | anchor | Submit lead form | rename | #request | Оставить заявку | Preferred CTA system |
| asset-review.html | Оставить заявку | #request | anchor | Submit lead form | keep | #request | Оставить заявку | Correct intent and destination |
| asset-review.html | Написать в Telegram | /api/contact-telegram | no | Open messenger | fix | external Telegram deep-link | Написать в Telegram | Non-existing static route |
| method.html | Получить разбор | asset-review.html | yes | Start request flow | rename | asset-review.html#request | Передать актив на рассмотрение | Better intent + direct anchor |
| method.html | Получить первичный разбор | asset-review.html | yes | Start request flow | rename | asset-review.html#request | Проверить актив на реализуемость | Preferred wording |
| trust.html | Передать актив на разбор | asset-review.html | yes | Start request flow | rename | asset-review.html#request | Передать актив на рассмотрение | Wording normalization |
| opyt.html | Получить разбор | /#request | no | Go to homepage request | fix | index.html#request | Оставить заявку | Leading slash route not resolved in this static tree |
| opyt.html | Передать актив на разбор | /#request | no | Go to homepage request | fix | index.html#request | Передать актив на рассмотрение | Broken plus wording mismatch |
| opyt.html | Получить первичный разбор | /#request | no | Go to homepage request | fix | index.html#request | Проверить актив на реализуемость | Broken plus disallowed primary wording |
| opyt.html | Написать в Telegram | /api/contact-telegram | no | Open messenger | fix | external Telegram deep-link | Написать в Telegram | Non-existing static route |
| 404.html | Главная | / | no | Go home | fix | index.html | На главную | Root path unresolved in file-to-file static checks |
| thanks.html | На главную | / | no | Go home | fix | index.html | На главную | Same issue: unresolved `/` route |
| thanks.html | Вернуться на главную | / | no | Go home | remove | — | — | Duplicate primary intent on same screen |
| privacy.html | Вернуться к заявке | index.html#request | anchor | Return to request block | keep | index.html#request | Вернуться к заявке | Correct intent |

> Pattern note: many service pages use the same CTA pattern (`Получить разбор`, `Получить первичный разбор`, Telegram via `/api/contact-telegram`), so fixes should be applied consistently across those templates/pages.

## 3) Broken or suspicious links

### Missing file / unresolved route
- `404.html`: `Главная` → `/`
- `thanks.html`: `На главную` → `/`
- `thanks.html`: `Вернуться на главную` → `/`
- `opyt.html`: brand link `A&A Asset Team` → `/`
- `opyt.html`: `Главная` → `/`
- `opyt.html`: `Активы` → `/#assets`
- `opyt.html`: `Стоимость` → `/#formats`
- `opyt.html`: `Получить разбор` → `/#request`
- `opyt.html`: `Передать актив на разбор` → `/#request`
- `opyt.html`: `Получить первичный разбор` → `/#request`
- `thanks.html`: `Подход` → `/#approach`
- `thanks.html`: `Активы` → `/#assets`
- `thanks.html`: `Заявка` → `/#request`

### Anchor exists problem
- `privacy.html`: `Подход` → `index.html#approach` (anchor `approach` not found in target page)

### API-route links used as direct client CTAs (suspicious in static navigation)
- `index.html`, `contacts.html`, `asset-review.html`, `kejsy-realizacii-aktivov.html`, `opyt.html` and multiple service pages: `Написать в Telegram` → `/api/contact-telegram`
- `index.html`, `contacts.html`: `Написать в MAX` → `/api/contact-max`
- `index.html`, `asset-review.html`: form action `/api/lead`

### Request-intent wording mismatch
- Any primary CTA containing `Получить разбор`, `Получить первичный разбор`, `Запросить разбор` should be mapped to preferred wording set and (where applicable) lead to `#request` or `asset-review.html#request`.

## 4) Buttons to keep
- `asset-review.html`: `Оставить заявку` → `#request`
- `privacy.html`: `Вернуться к заявке` → `index.html#request`
- Cross-page navigation CTAs to existing pages, e.g. `method.html`, `trust.html`, `asset-review.html`, `contacts.html` where intent is informational and destination exists.

## 5) Buttons to fix
1. Replace primary wording:
   - `Получить разбор`
   - `Получить первичный разбор`
   - `Запросить разбор`
2. Fix root-relative broken paths in static context:
   - `/`, `/#assets`, `/#formats`, `/#request`, `/#approach`
3. Replace messenger API routes with user-facing destination links:
   - `/api/contact-telegram`
   - `/api/contact-max`
4. Update request-flow links to direct anchors when appropriate:
   - `asset-review.html` → `asset-review.html#request`

## 6) Buttons to remove
- `thanks.html`: remove one of duplicated home-return CTAs (`На главную` vs `Вернуться на главную`) and keep one clear primary action.

## 7) Recommended CTA system for the site
Use as primary CTA vocabulary:
- **Оставить заявку**
- **Передать актив на рассмотрение**
- **Проверить актив на реализуемость**
- **Обсудить формат реализации**
- **Написать в Telegram**
- **Написать в MAX**

Avoid as primary CTAs:
- **Получить разбор**
- **Получить первичный разбор**
- **Запросить разбор**

## 8) Priority fixes

### P1 — must fix now
- Broken/unresolved navigation (`/`, `/#...`) on `opyt.html`, `thanks.html`, `404.html`.
- `privacy.html` anchor mismatch (`index.html#approach`).
- Telegram/MAX client links currently routed to `/api/contact-*` where no static target exists.

### P2 — should fix soon
- Unify all primary request CTAs to preferred wording set.
- Link request-intent CTAs directly to request anchors (`#request` or `asset-review.html#request`).

### P3 — optional cleanup
- Remove duplicate CTA on `thanks.html`.
- Reduce near-duplicate CTA copy variants across service pages.

---

## Validation
- Production files changed: **No**
- Added file(s): **button-link-audit.md only**
- Audit references exact pages and concrete links: **Yes**
- No fixes applied in this PR: **Yes**
