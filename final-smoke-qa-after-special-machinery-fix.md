# Final Smoke QA After Special Machinery Fix

## 1. Summary
Все P1-блокеры из предыдущего QA по сервисным страницам закрыты. Критичных несоответствий в проверяемом скоупе не обнаружено.

## 2. Passed checks
- На `prodazha-spectehniki.html` подтверждены:
  - наличие `hero__note`;
  - hero CTA с тремя кнопками: «Оставить заявку», «Написать в Telegram», «Написать в MAX»;
  - корректные ссылки CTA: `index.html#request`, `/api/contact-telegram`, `/api/contact-max`;
  - наличие секции «Риск покупателя»;
  - наличие нижнего CTA «Оставить заявку на разбор спецтехники →»;
  - в футере используется «Направления».
- На всех 9 сервисных страницах подтверждены:
  - единый header nav: «Проблема / Метод / Активы / Направления / Стоимость / Заявка»;
  - отсутствуют ссылки на `trust.html` и `asset-review.html`;
  - в футере используется «Направления» (не «Услуги»);
  - hero CTA содержит «Оставить заявку», «Написать в Telegram», «Написать в MAX»;
  - отсутствуют неясные формулировки CTA из стоп-листа.
- По CSS подтверждено в `seo.css`:
  - есть секция `/* Service page hero CTA buttons */`;
  - есть секция `/* Mixed surface contrast fixes */`;
  - `.page-links` использует `display: flex`;
  - `.page-link` оформлен как кнопка (рамка, фон, паддинги, hover);
  - есть мобильный стек для CTA в media query (`max-width:680px`).
- По form/API подтверждено:
  - форма на `index.html` использует `method="POST" action="/api/lead"`;
  - Telegram CTA ведут на `/api/contact-telegram`;
  - MAX CTA ведут на `/api/contact-max`;
  - `thanks.html` содержит кнопки Telegram и MAX.

## 3. Remaining issues
- **P1: must fix before traffic**
  - Нет.
- **P2: should fix soon**
  - Нет в рамках текущего smoke-аудита сервисных страниц.
- **P3: optional improvement**
  - Вынести автоматизированную регрессионную проверку CTA/ссылок по сервисным страницам в pre-release чеклист, чтобы исключить ручные пропуски в будущих релизах.

## 4. Service page CTA audit
CTA-консистентность между всеми 9 сервисными страницами подтверждена:
- Hero-блоки имеют одинаковую структуру CTA (заявка + Telegram + MAX).
- Ссылки каналов единообразны и указывают на корректные API-эндпоинты.
- Нежелательные формулировки CTA на сервисных страницах не обнаружены.

## 5. CSS readiness audit
Готовность CSS для сервисных CTA подтверждена:
- присутствуют стили кнопочной группы в hero;
- присутствуют контраст-фиксы для смешанных поверхностей;
- mobile-адаптация CTA присутствует и соответствует ожиданию по стеку кнопок на малых ширинах.

## 6. Form/API audit
Подтверждено:
- Лид-форма: `POST /api/lead` (index);
- Контактные каналы CTA: `/api/contact-telegram`, `/api/contact-max`;
- Страница благодарности содержит оба канала (Telegram/MAX).

## 7. Final recommendation
Сайт **готов** к:
- live traffic;
- Yandex indexing;
- следующему этапу SEO cleanup (как плановой оптимизации, не как блокера запуска).

## Validation
- Создан только файл `final-smoke-qa-after-special-machinery-fix.md`.
- Производственные файлы (HTML/CSS/JS/functions и др. из запретного списка) не изменялись.
