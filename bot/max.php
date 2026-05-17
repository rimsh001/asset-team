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

function max_extract_phone(string $text, array $raw): ?string
{
    $search = $text . "\n" . json_encode($raw, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($search)) {
        $search = $text;
    }

    if (preg_match('/(?:\+7|8)[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/u', $search, $match)) {
        return trim($match[0]);
    }

    if (preg_match('/\b\d{10,11}\b/u', $search, $match)) {
        return trim($match[0]);
    }

    return null;
}

function max_format_admin_notice(array $incoming, string $text, array $update): array
{
    $chatId = $incoming['chat_id'] ?? null;
    $userName = $incoming['user_name'] ?? null;

    $userId = max_find_first_value($update, ['user_id', 'sender_id', 'from_id']);
    $username = max_find_first_value($update, ['username', 'login', 'nick']);
    $phone = max_extract_phone($text, $update);

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
    }

    if ($chatId) {
        $lines[] = 'MAX Chat ID: ' . $chatId;
    }

    if ($phone) {
        $lines[] = 'Телефон: ' . $phone;
        $hasContact = true;
    } else {
        $lines[] = 'Контакт: не указан. Бот попросил отправить телефон или ссылку для связи.';
        $hasContact = false;
    }

    $lines[] = '';
    $lines[] = 'Текст:';
    $lines[] = $text !== '' ? $text : '[без текста]';
    $lines[] = '';
    $lines[] = 'Время: ' . date('d.m.Y H:i:s');

    return [
        'text' => implode("\n", $lines),
        'has_contact' => $hasContact,
    ];
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
$userName = $incoming['user_name'];

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

$noticeData = max_format_admin_notice($incoming, $text !== '' ? $text : '[без текста]', $update);
$hasContact = (bool)$noticeData['has_contact'];

if ($hasEnoughData && $hasContact) {
    $replyText = "Спасибо. Заявку получил и передал в рабочую группу A&A Asset Team.\n\nЕсли есть фото, документы или ссылка на объявление — отправьте их следующим сообщением.";
} elseif ($hasEnoughData) {
    $replyText = "Спасибо. Заявку получил и передал в рабочую группу A&A Asset Team.\n\nЧтобы мы могли связаться с вами, отправьте следующим сообщением телефон, ссылку на профиль или другой удобный контакт.";
} else {
    $replyText = "Принял. Чтобы передать заявку в работу, добавьте одним сообщением:\n\n1. Что продаётся / какой актив\n2. Город или регион\n3. Желаемую цену\n4. Есть ли фото, документы или ссылка\n5. Телефон или другой контакт для связи";
}

max_finish_webhook();

max_send_message($config, $chatId, $replyText);

$telegramLeadsChatId = trim((string)($config['telegram_leads_chat_id'] ?? ''));
if ($telegramLeadsChatId === '') {
    $telegramLeadsChatId = trim((string)($config['telegram_admin_chat_id'] ?? ''));
}

if ($telegramLeadsChatId !== '' && !str_contains($telegramLeadsChatId, 'PASTE_')) {
    telegram_send_message($config, $telegramLeadsChatId, (string)$noticeData['text']);
}
