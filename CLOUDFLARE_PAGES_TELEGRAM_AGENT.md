# AI-агент Telegram для Cloudflare Pages

Этот проект использует не polling-бота, а Telegram webhook через Cloudflare Pages Functions.

## Что добавлено

```text
functions/
└── api/
    ├── telegram-webhook.js      # основной webhook Telegram
    └── set-telegram-webhook.js  # вспомогательная функция для установки webhook
```

После деплоя Cloudflare Pages endpoint будет доступен по адресу:

```text
https://ВАШ-ДОМЕН/api/telegram-webhook
```

## Переменные окружения в Cloudflare Pages

В Cloudflare откройте:

```text
Pages → ваш проект → Settings → Environment variables
```

Добавьте переменные:

```text
TELEGRAM_BOT_TOKEN
OPENAI_API_KEY
OPENAI_MODEL
COMPANY_MANAGER_NAME
MANAGER_CHAT_ID
GOOGLE_SHEET_ID
GOOGLE_SHEET_TAB
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
SET_WEBHOOK_SECRET
```

Минимально обязательные:

```text
TELEGRAM_BOT_TOKEN
OPENAI_API_KEY
```

Для Google Sheets дополнительно нужны:

```text
GOOGLE_SHEET_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
GOOGLE_SHEET_TAB
```

`GOOGLE_PRIVATE_KEY` вставляйте целиком. Если в Cloudflare ключ съезжает по строкам, замените переносы строк на `\n`.

## Важная настройка Telegram

Через `@BotFather` нужно отключить privacy mode:

```text
/setprivacy → выбрать бота → Disable
```

Иначе бот в группе не будет видеть обычные сообщения участников.

## Как установить webhook

После деплоя Pages откройте в браузере:

```text
https://ВАШ-ДОМЕН/api/set-telegram-webhook?url=https://ВАШ-ДОМЕН/api/telegram-webhook&secret=ВАШ_SECRET
```

`ВАШ_SECRET` — это значение переменной `SET_WEBHOOK_SECRET`.

Если `SET_WEBHOOK_SECRET` не задан, параметр `secret` не нужен.

## Проверка

1. Откройте:

```text
https://ВАШ-ДОМЕН/api/telegram-webhook
```

Должен прийти JSON:

```json
{
  "ok": true,
  "service": "telegram-ai-agent-cloudflare-pages"
}
```

2. Напишите в Telegram-группе:

```text
Нужно продать производственную базу в Московской области. Продаем больше года, звонков почти нет. Цена 85 млн.
```

Ожидаемо:

- бот задаст уточняющие вопросы;
- сформирует карточку заявки;
- при наличии Google Sheets сохранит строку в таблицу.

## Почему так, а не обычный Node.js bot

Cloudflare Pages не держит постоянный процесс. Поэтому обычный polling-бот на Telegraf здесь не подходит. Правильная схема для Pages:

```text
Telegram → webhook → Cloudflare Pages Function → OpenAI → ответ в Telegram → Google Sheets
```
