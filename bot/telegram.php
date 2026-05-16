<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

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

$normalizedText = mb_strtolower(trim($text));

if ($normalizedText === '/start' || $normalizedText === 'start' || $normalizedText === '') {
    telegram_send_message($config, $chatId, bot_text_for_start());
    bot_ok();
    exit;
}

telegram_send_message($config, $chatId, bot_text_for_received());

$adminNotice = bot_format_admin_notice('Telegram', $chatId, $userName, $text !== '' ? $text : '[без текста]', $update);
bot_send_email($config, 'Новая заявка из Telegram — A&A Asset Team', $adminNotice);

$adminChatId = trim((string)($config['telegram_admin_chat_id'] ?? ''));
if ($adminChatId !== '' && !str_contains($adminChatId, 'PASTE_')) {
    telegram_send_message($config, $adminChatId, $adminNotice);
}

bot_ok();
