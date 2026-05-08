# Final Service Pages QA Audit

## 1. Summary
Сайт **почти готов к запуску трафика**, но есть один критичный пробел на странице `prodazha-spectehniki.html`: CTA-блок и часть обязательного контента не соответствуют обновлённому стандарту service pages. До исправления этого пункта рекомендован статус **Hold**.

## 2. Passed checks
- Проверенные страницы из списка присутствуют в репозитории и доступны для проверки.
- На целевых service pages (кроме одной отмеченной ниже) в шапке используется нужная навигация:
  `Проблема / Метод / Активы / Направления / Стоимость / Заявка`.
- В проверенных service pages не найдено ссылок на `trust.html` и `asset-review.html`.
- В футерах service pages используется `Направления` (а не `Услуги`), контакты (телефон/email) видимы.
- На большинстве service pages hero CTA содержит:
  - `Оставить заявку` → `index.html#request`
  - `Написать в Telegram` → `/api/contact-telegram`
  - `Написать в MAX` → `/api/contact-max`
- В `seo.css` найден блок `Service page hero CTA buttons`.
- В `seo.css`:
  - `.page-links` использует flex
  - `.page-link` оформлен как кнопка
  - присутствует мобильный stacking (`@media` для column/100% width)
- В `seo.css` присутствует блок `Mixed surface contrast fixes`, включая:
  - читаемость на тёмных секциях
  - тёмный текст внутри светлых карточек на тёмных секциях
  - светлый текст для `pricing .featured`
  - светлый текст на `#assets` image cards
  - тёмный текст timeline-карточек в тёмных секциях
- Форма на главной странице:
  - `action="/api/lead"`
  - `method="POST"`
  - поля input/select/textarea с `name` присутствуют
  - consent по персональным данным присутствует
- Страница `thanks.html` содержит CTA:
  - `На главную`
  - `Написать на почту`
  - `Написать в Telegram`
  - `Написать в MAX`
- SEO basics:
  - `robots.txt`, `sitemap.xml`, `favicon.svg` существуют
  - на service pages есть `title`, `meta description`, `canonical`

## 3. Issues found

### P1: must fix before traffic
1. **`prodazha-spectehniki.html` не соответствует финальному CTA/content шаблону service pages**:
   - в hero CTA отсутствует кнопка `Написать в MAX` (`/api/contact-max`)
   - отсутствует обязательный блок `hero__note`
   - отсутствует секция/маркер `Риск покупателя`

Это ломает консистентность конверсии и контентной структуры между service pages.

### P2: should fix soon
1. `favicon.svg` явно подключён в `index.html`, но на части проверенных внутренних страниц явной ссылки на favicon нет.
   - технически файл существует
   - рекомендуется унифицировать подключение favicon на всех ключевых страницах

2. В рамках общего SEO baseline не на всех НЕ-service страницах из чек-листа присутствуют `meta description`/`canonical` (например `404.html` без description; `thanks.html`, `method.html`, `privacy.html` без canonical).
   - это не блокер для service rollout, но желателен cleanup.

### P3: optional improvement
1. Добавить автоматизированный линтер/скрипт QA по паттернам CTA и nav для service pages, чтобы не допускать расхождений между однотипными лендингами.

## 4. CTA and link audit
- На целевых service pages массово подтверждены корректные CTA-ссылки:
  - `index.html#request`
  - `/api/contact-telegram`
  - `/api/contact-max`
- Подозрительные/устаревшие формулировки CTA типа:
  - `на реализуемость`
  - `Проверить актив`
  - `Проверить объект`
  - `Проверить склад`
  - `Проверить базу`
  - `Проверить оборудование`
  в целевых обновлённых service pages (кроме legacy-контекста вне scope) не обнаружены.
- Найдено расхождение на `prodazha-spectehniki.html` (нет MAX CTA и часть структуры отличается от остальных service pages).

## 5. CSS contrast and button audit
По код-ревью `seo.css`:
- блок `Service page hero CTA buttons` присутствует и применяет button-like стиль для `.page-link`.
- `.page-links` использует flex + wrap, mobile stacking реализован через media query.
- блок `Mixed surface contrast fixes` присутствует.
- Дополнительные правила подтверждают читаемость:
  - тёмные секции: светлый текст
  - светлые карточки внутри `.section.dark`: тёмный текст
  - `.pricing .featured`: светлый текст
  - `#assets .asset-grid article`: светлый текст
  - `.section.dark .timeline li`: тёмный текст

Итог: по коду стили CTA/contrast выглядят корректно и соответствуют задаче.

## 6. Form/API audit
Подтверждено:
- Главная форма: `POST /api/lead`
- Telegram CTA используют `/api/contact-telegram`
- MAX CTA используют `/api/contact-max` на целевых обновлённых service pages и на thanks page
- Исключение: `prodazha-spectehniki.html` в hero CTA не содержит `Написать в MAX` (несоответствие P1)

## 7. Recommended next actions
1. **P1 (срочно):** привести `prodazha-spectehniki.html` к общему service-page шаблону:
   - добавить `hero__note`
   - добавить блок/секцию `Риск покупателя`
   - добавить CTA `Написать в MAX` → `/api/contact-max`
2. **P1 (срочно):** после правки прогнать повторный QA ровно по этому же чек-листу только для изменённой страницы + smoke по всем service pages.
3. **P2:** унифицировать favicon link на ключевых внутренних страницах.
4. **P2:** сделать SEO cleanup (description/canonical) для `thanks.html`, `privacy.html`, `method.html`, `404.html` по принятой SEO-политике проекта.
5. **P3:** добавить простой QA-скрипт (регекс-проверки nav/CTA/links/content-маркеров) и использовать перед релизом.

---

Validation:
- Создан только файл `final-service-pages-qa-audit.md`.
- Production файлы не изменялись.
- CSS/HTML/JS/functions не редактировались.
