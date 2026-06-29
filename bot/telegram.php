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

function telegram_fast_post_json(string $url, array $payload, array $headers = []): array
{
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        $body = '{}';
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 1,
        CURLOPT_TIMEOUT => 2,
        CURLOPT_NOSIGNAL => true,
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json', 'Accept: application/json'], $headers),
        CURLOPT_POSTFIELDS => $body,
    ]);

    $response = curl_exec($ch);
    $error = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    bot_log('telegram_fast_post_json', [
        'url' => bot_mask_url($url),
        'status' => $status,
        'error' => $error,
        'response' => $response,
    ]);

    return ['status' => $status, 'error' => $error, 'response' => $response];
}

function telegram_max_send_message_fast(array $config, string $maxChatId, string $text): array
{
    $token = trim((string)($config['max_bot_token'] ?? ''));
    if ($token === '' || str_contains($token, 'PASTE_')) {
        bot_log('max_missing_token', []);
        return ['status' => 0, 'error' => 'Missing MAX token', 'response' => null];
    }

    $apiBase = rtrim((string)($config['max_api_base'] ?? 'https://platform-api.max.ru'), '/');
    $template = (string)($config['max_send_message_url_template'] ?? '');
    $attempts = [];

    if ($template !== '') {
        $url = str_replace(['{token}', '{chat_id}'], [rawurlencode($token), rawurlencode($maxChatId)], $template);
        $headers = str_contains($template, '{token}') ? [] : ['Authorization: ' . $token];
        $attempts[] = ['configured_template', $url, ['text' => $text], $headers];
    }

    $attempts[] = ['platform_query_chat_id', $apiBase . '/messages?chat_id=' . rawurlencode($maxChatId), ['text' => $text], ['Authorization: ' . $token]];

    $lastResult = ['status' => 0, 'error' => 'MAX send attempts were not executed', 'response' => null];
    foreach (array_slice($attempts, 0, 2) as $attempt) {
        [$name, $url, $payload, $headers] = $attempt;
        $result = telegram_fast_post_json($url, $payload, $headers);
        $lastResult = $result;

        bot_log('telegram_max_send_fast_attempt', [
            'attempt' => $name,
            'url' => bot_mask_url($url),
            'status' => $result['status'],
            'error' => $result['error'],
            'response' => $result['response'],
        ]);

        if ($result['status'] >= 200 && $result['status'] < 300) {
            return $result;
        }
    }

    return $lastResult;
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

    $sendResult = telegram_max_send_message_fast($config, $maxChatId, $messageToClient);
    $status = (int)($sendResult['status'] ?? 0);

    if ($status >= 200 && $status < 300) {
        telegram_send_message($config, $chatId, "Ответ отправлен в MAX чат {$maxChatId}.");
    } else {
        $errorText = trim((string)($sendResult['error'] ?? ''));
        $responseText = trim((string)($sendResult['response'] ?? ''));
        $details = $errorText !== '' ? $errorText : $responseText;
        $details = $details !== '' ? "\nДетали: " . mb_substr($details, 0, 500) : '';
        telegram_send_message($config, $chatId, "Не удалось отправить ответ в MAX чат {$maxChatId}. Статус: {$status}.{$details}");
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
