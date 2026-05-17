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

$hasEnoughData = (bool)preg_match('/база|склад|ангар|помещен|недвиж|земл|участ|оборуд|станок|техник|спецтех|тмц|остат|кран|погруз|авто|актив/u', $normalizedText)
    && (bool)preg_match('/\d+\s*(млн|тыс|руб|₽|р\b)|цена|стоим/u', $normalizedText);

if ($hasEnoughData) {
    max_send_message($config, $chatId, "Спасибо. Заявку получил и передал в рабочую группу A&A Asset Team.\n\nЕсли есть фото, документы или ссылка на объявление — отправьте их следующим сообщением.");
} else {
    max_send_message($config, $chatId, "Принял. Чтобы передать заявку в работу, добавьте одним сообщением:\n\n1. Что продаётся / какой актив\n2. Город или регион\n3. Желаемую цену\n4. Есть ли фото, документы или ссылка\n5. Удобный контакт для связи");
}

$adminNotice = bot_format_admin_notice('MAX', $chatId, $userName, $text !== '' ? $text : '[без текста]', $update);

$telegramLeadsChatId = trim((string)($config['telegram_leads_chat_id'] ?? ''));
if ($telegramLeadsChatId === '') {
    $telegramLeadsChatId = trim((string)($config['telegram_admin_chat_id'] ?? ''));
}

if ($telegramLeadsChatId !== '' && !str_contains($telegramLeadsChatId, 'PASTE_')) {
    telegram_send_message($config, $telegramLeadsChatId, $adminNotice);
}

bot_ok();
