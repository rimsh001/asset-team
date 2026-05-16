<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

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
        bot_ok();
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
    bot_ok();
    exit;
}

$normalizedText = mb_strtolower(trim($text));

if ($normalizedText === '/start' || $normalizedText === 'start' || $normalizedText === 'начать' || $normalizedText === '') {
    max_send_message($config, $chatId, bot_text_for_start());
    bot_ok();
    exit;
}

max_send_message($config, $chatId, bot_text_for_received());

$adminNotice = bot_format_admin_notice('MAX', $chatId, $userName, $text !== '' ? $text : '[без текста]', $update);
bot_send_email($config, 'Новая заявка из MAX — A&A Asset Team', $adminNotice);

$adminChatId = trim((string)($config['max_admin_chat_id'] ?? ''));
if ($adminChatId !== '' && !str_contains($adminChatId, 'PASTE_')) {
    max_send_message($config, $adminChatId, $adminNotice);
}

bot_ok();
