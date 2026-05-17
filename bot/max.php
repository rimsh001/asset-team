<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

function max_finish_webhook(): void
{
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
        return;
    }

    if (ob_get_level() > 0) {
        @ob_flush();
    }

    @flush();
}

function max_find_first_value(array $data, array $keys): ?string
{
    foreach ($data as $key => $value) {
        if (in_array((string)$key, $keys, true) && is_scalar($value) && trim((string)$value) !== '') {
            return trim((string)$value);
        }

        if (is_array($value)) {
            $found = max_find_first_value($value, $keys);
            if ($found !== null) {
                return $found;
            }
        }
    }

    return null;
}

function max_extract_sender_user_id(array $update): ?string
{
    $paths = [
        ['message', 'sender', 'user_id'],
        ['message', 'sender', 'id'],
        ['sender', 'user_id'],
        ['sender', 'id'],
        ['user', 'user_id'],
        ['user', 'id'],
    ];

    foreach ($paths as $path) {
        $value = $update;
        foreach ($path as $key) {
            if (!is_array($value) || !array_key_exists($key, $value)) {
                $value = null;
                break;
            }
            $value = $value[$key];
        }

        if (is_scalar($value) && trim((string)$value) !== '') {
            return trim((string)$value);
        }
    }

    return max_find_first_value($update, ['user_id', 'sender_id', 'from_id']);
}

function max_format_admin_notice(array $incoming, string $text, array $update): string
{
    $chatId = $incoming['chat_id'] ?? null;
    $userName = $incoming['user_name'] ?? null;
    $userId = max_extract_sender_user_id($update);
    $username = max_find_first_value($update, ['username', 'login', 'nick']);

    $lines = [
        'Новая заявка из MAX',
        '',
    ];

    if ($userName) {
        $lines[] = 'Пользователь: ' . $userName;
    }

    if ($username) {
        $usernameClean = ltrim($username, '@');
        $lines[] = 'MAX username: @' . $usernameClean;
        $lines[] = 'Профиль MAX: https://max.ru/' . $usernameClean;
    }

    if ($userId) {
        $lines[] = 'MAX user ID: ' . $userId;
        $lines[] = 'Профиль по ID: https://max.ru/id' . $userId;
    }

    if ($chatId) {
        $lines[] = 'MAX Chat ID: ' . $chatId;
        $lines[] = 'Открыть чат MAX: https://max.ru/chat/' . $chatId;
    }

    $lines[] = '';
    $lines[] = 'Текст:';
    $lines[] = $text !== '' ? $text : '[без текста]';
    $lines[] = '';
    $lines[] = 'Время: ' . date('d.m.Y H:i:s');

    return implode("\n", $lines);
}

$config = bot_load_config();

$secret = trim((string)($config['max_webhook_secret'] ?? ''));
if ($secret !== '') {
    $headerSecret = $_SERVER['HTTP_X_MAX_WEBHOOK_SECRET']
        ?? $_SERVER['HTTP_X_BOT_WEBHOOK_SECRET']
        ?? $_SERVER['HTTP_X_WEBHOOK_SECRET']
        ?? '';

    if (!hash_equals($secret, (string)$headerSecret)) {
        bot_log('max_invalid_secret', [
            'received' => $headerSecret ? 'present' : 'missing',
        ]);
        http_response_code(403);
        max_finish_webhook();
        exit;
    }
}

$update = bot_read_json();
$incoming = max_extract_message($update);

$chatId = $incoming['chat_id'];
$text = $incoming['text'];

if ($chatId === null || $chatId === '') {
    bot_log('max_missing_chat_id', [
        'update' => $update,
        'note' => 'MAX webhook payload format may differ. Check bot/logs/bot.log and adjust max_extract_message() in bot/lib.php if needed.',
    ]);
    max_finish_webhook();
    exit;
}

$normalizedText = mb_strtolower(trim($text));

if ($normalizedText === '/start' || $normalizedText === 'start' || $normalizedText === 'начать' || $normalizedText === '') {
    max_finish_webhook();
    max_send_message($config, $chatId, bot_text_for_start());
    exit;
}

$hasEnoughData = (bool)preg_match('/база|склад|ангар|помещен|недвиж|земл|участ|оборуд|станок|техник|спецтех|тмц|остат|кран|погруз|авто|актив/u', $normalizedText)
    && (bool)preg_match('/\d+\s*(млн|тыс|руб|₽|р\b)|цена|стоим/u', $normalizedText);

$adminNotice = max_format_admin_notice($incoming, $text !== '' ? $text : '[без текста]', $update);

if ($hasEnoughData) {
    $replyText = "Спасибо. Заявку получил и передал в рабочую группу A&A Asset Team.\n\nДля связи мы используем ваш чат в MAX. Если есть фото, документы или ссылка на объявление — отправьте их следующим сообщением.";
} else {
    $replyText = "Принял. Чтобы передать заявку в работу, добавьте одним сообщением:\n\n1. Что продаётся / какой актив\n2. Город или регион\n3. Желаемую цену\n4. Есть ли фото, документы или ссылка\n\nДля связи достаточно этого чата в MAX.";
}

max_finish_webhook();

max_send_message($config, $chatId, $replyText);

$telegramLeadsChatId = trim((string)($config['telegram_leads_chat_id'] ?? ''));
if ($telegramLeadsChatId === '') {
    $telegramLeadsChatId = trim((string)($config['telegram_admin_chat_id'] ?? ''));
}

if ($telegramLeadsChatId !== '' && !str_contains($telegramLeadsChatId, 'PASTE_')) {
    telegram_send_message($config, $telegramLeadsChatId, $adminNotice);
}
