<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

function telegram_reply_via_webhook(string $chatId, string $text): void
{
    header('Content-Type: application/json; charset=UTF-8');

    echo json_encode([
        'method' => 'sendMessage',
        'chat_id' => $chatId,
        'text' => $text,
        'disable_web_page_preview' => true,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
        return;
    }

    if (ob_get_level() > 0) {
        @ob_flush();
    }

    @flush();
}

$config = bot_load_config();

$secret = trim((string)($config['telegram_webhook_secret'] ?? ''));
if ($secret !== '') {
    $headerSecret = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
    if (!hash_equals($secret, (string)$headerSecret)) {
        bot_log('telegram_invalid_secret', [
            'received' => $headerSecret ? 'present' : 'missing',
        ]);
        http_response_code(403);
        bot_ok();
        exit;
    }
}

$update = bot_read_json();
$incoming = telegram_extract_message($update);

$chatId = $incoming['chat_id'];
$text = $incoming['text'];
$userName = $incoming['user_name'];

if ($chatId === null || $chatId === '') {
    bot_log('telegram_missing_chat_id', ['update' => $update]);
    bot_ok();
    exit;
}

$trimmedText = trim($text);
$normalizedText = mb_strtolower($trimmedText);

if (preg_match('/^\/(?:max|replymax)(?:@[A-Za-z0-9_]+)?\s+(-?\d+)\s+(.+)$/us', $trimmedText, $matches)) {
    $maxChatId = trim($matches[1]);
    $messageToClient = trim($matches[2]);

    if ($messageToClient === '') {
        telegram_reply_via_webhook($chatId, "Не вижу текст ответа. Формат:\n/max MAX_CHAT_ID текст сообщения клиенту");
        exit;
    }

    telegram_reply_via_webhook($chatId, "Отправляю ответ клиенту в MAX…");

    $sendResult = max_send_message($config, $maxChatId, $messageToClient);
    $status = (int)($sendResult['status'] ?? 0);

    if ($status >= 200 && $status < 300) {
        telegram_send_message($config, $chatId, "Ответ отправлен в MAX чат {$maxChatId}.");
    } else {
        telegram_send_message($config, $chatId, "Не удалось отправить ответ в MAX чат {$maxChatId}. Статус: {$status}. Проверьте bot.log.");
    }

    bot_log('telegram_max_reply_command', [
        'operator_chat_id' => $chatId,
        'operator_user' => $userName,
        'max_chat_id' => $maxChatId,
        'status' => $status,
    ]);

    exit;
}

if ($normalizedText === '/start' || $normalizedText === 'start' || $normalizedText === '') {
    telegram_reply_via_webhook($chatId, bot_text_for_start());
    exit;
}

$hasEnoughData = (bool)preg_match('/база|склад|ангар|помещен|недвиж|земл|участ|оборуд|станок|техник|спецтех|тмц|остат|кран|погруз|авто|актив/u', $normalizedText)
    && (bool)preg_match('/\d+\s*(млн|тыс|руб|₽|р\b)|цена|стоим/u', $normalizedText);

if ($hasEnoughData) {
    $replyText = "Спасибо. Заявку получил и передал в рабочую группу A&A Asset Team.\n\nЕсли есть фото, документы или ссылка на объявление — отправьте их следующим сообщением.";
} else {
    $replyText = "Принял. Чтобы передать заявку в работу, добавьте одним сообщением:\n\n1. Что продаётся / какой актив\n2. Город или регион\n3. Желаемую цену\n4. Есть ли фото, документы или ссылка\n5. Удобный контакт для связи";
}

telegram_reply_via_webhook($chatId, $replyText);

$adminNotice = bot_format_admin_notice('Telegram', $chatId, $userName, $text !== '' ? $text : '[без текста]', $update);

$telegramLeadsChatId = trim((string)($config['telegram_leads_chat_id'] ?? ''));
if ($telegramLeadsChatId === '') {
    $telegramLeadsChatId = trim((string)($config['telegram_admin_chat_id'] ?? ''));
}

if ($telegramLeadsChatId !== '' && !str_contains($telegramLeadsChatId, 'PASTE_')) {
    telegram_send_message($config, $telegramLeadsChatId, $adminNotice);
}
