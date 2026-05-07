# Аудит PR и codex-веток (rimsh001/asset-team)

Дата аудита: 2026-05-07 (UTC)

## Ограничения среды

- В локальном git-клоне отсутствует remote origin (локально недоступны ссылки на GitHub-репозиторий).
- В среде отсутствует GitHub CLI (`gh` не установлен).
- Прямой запрос к GitHub API через `curl` возвращает `403 CONNECT tunnel failed`.
- Поэтому проверить live-статусы PR #1-#12 и удалённые ветки программно из этой среды не удалось.

## Что проверено локально (без изменения кода)

- В репозитории есть `README.md`.
- В репозитории есть `robots.txt`.
- В репозитории есть `sitemap.xml`.
- В репозитории есть `index.html`.
- В `index.html` присутствует meta `yandex-verification`.
- `robots.txt` соответствует целевому содержимому:
  - `User-agent: *`
  - `Allow: /`
  - `Disallow: /api/`
  - `Disallow: /forms.html`
  - `Disallow: /thanks.html`
  - `Sitemap: https://aateam.ru/sitemap.xml`
- `sitemap.xml` содержит URL сайта `https://aateam.ru/`.
- Присутствует файл `yandex_c42ada3ebda0897f.html`.

## Предварительная классификация по предоставленному контексту (требует подтверждения в GitHub UI)

### Группа A — можно удалить сразу (после подтверждения статуса PR/merge в GitHub)

- `codex/audit-and-prepare-static-site-for-deployment` (PR #11 merged в `main`).
- `codex/update-robots.txt-for-indexing-rules` (PR #12 closed без merge; изменения влиты через PR #11).
- `codex/clean-and-standardize-repository-structure` (PR #10 closed без merge; рискованный перенос структуры, не нужен).
- `codex/add-yandex-verification-meta-tag-hd3rec` (PR #9 closed без merge; meta уже в `main`).
- `codex/add-yandex-verification-meta-tag` (PR #8 closed без merge; meta уже в `main`).

### Группа B — сначала закрыть PR, потом удалить ветку (если дифф подтверждает устаревание/дубли)

- `codex/add-yandex-webmaster-verification-file` (PR #7 open):
  - Если подтверждение Яндекса уже стабильно через meta и файл не нужен — закрыть PR #7 как устаревший.
- `codex/add-follow-up-commit-to-pr-#3` (PR #4 open):
  - Закрыть, если дублирует/конфликтует с текущим `main`, особенно по `index.html`, `style.css`, `robots.txt`, `functions/_middleware.js`.
- `codex/add-follow-up-commit-to-pr-#3-branch` (PR #5 open):
  - Закрыть, если дублирует #4/#6 или устарел.
- `codex/add-follow-up-commit-to-pr-#3-qgiep4` (PR #6 open):
  - Закрыть, если дублирует #4/#5 или устарел.

### Группа C — не трогать

- `main`.
- Любые ветки с уникальными актуальными изменениями, не присутствующими в `main` (определяется только после проверки диффов PR в GitHub).

## Безопасный план очистки (чек-лист для GitHub UI)

1. Открыть список PR #1–#12 и зафиксировать: state, merged, head/base, files changed.
2. Для PR #4/#5/#6/#7 сравнить вкладку **Files changed** с текущим `main`:
   - если изменения дублируются/устарели/рискованны — закрыть PR.
3. При закрытии PR #4/#5/#6/#7 оставить комментарий:
   - "Закрываю как устаревший/дублирующий. Актуальные изменения уже внесены в main через PR #11 или текущую основную ветку. Ветка может быть удалена после закрытия PR."
4. Удалить ветки из Группы A.
5. Удалить ветки из Группы B после фактического закрытия соответствующих PR.
6. Повторно проверить `main`:
   - `README.md`, `robots.txt`, `sitemap.xml`, `index.html`, meta `yandex-verification`.
7. Пост-проверка сайта `https://aateam.ru`:
   - HTTP 200 для главной,
   - корректная загрузка CSS/JS,
   - отсутствие 404 по критическим страницам,
   - `robots.txt` и `sitemap.xml` доступны и корректны.

