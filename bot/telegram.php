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


function telegram_group_session_path(string $clientChatId): string
{
    $dir = __DIR__ . '/sessions/telegram';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    return $dir . '/' . hash('sha256', $clientChatId) . '.json';
}

function telegram_group_load_session(string $clientChatId): array
{
    $path = telegram_group_session_path($clientChatId);
    if (!is_file($path)) return [];

    $raw = file_get_contents($path);
    $data = is_string($raw) ? json_decode($raw, true) : null;

    return is_array($data) ? $data : [];
}

function telegram_group_save_session(string $clientChatId, array $session): void
{
    $session['updated_at'] = date('c');
    @file_put_contents(
        telegram_group_session_path($clientChatId),
        json_encode($session, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function telegram_send_admin_notice_threaded(array $config, string $telegramLeadsChatId, string $clientChatId, string $notice): void
{
    $session = telegram_group_load_session($clientChatId);
    $threadMessageId = (int)($session['telegram_thread_message_id'] ?? 0);

    $payload = [
        'chat_id' => $telegramLeadsChatId,
        'text' => $notice,
        'disable_web_page_preview' => true,
    ];

    if ($threadMessageId > 0) {
        $payload['reply_to_message_id'] = $threadMessageId;
        $payload['allow_sending_without_reply'] = true;
    }

    $result = telegram_api($config, 'sendMessage', $payload);

    bot_log('telegram_admin_notice_threaded', [
        'client_chat_id' => $clientChatId,
        'telegram_chat_id' => $telegramLeadsChatId,
        'thread_message_id' => $threadMessageId,
        'status' => $result['status'] ?? 0,
        'error' => $result['error'] ?? '',
        'response' => $result['response'] ?? null,
    ]);

    if ($threadMessageId <= 0 && (int)($result['status'] ?? 0) >= 200 && (int)($result['status'] ?? 0) < 300) {
        $data = json_decode((string)($result['response'] ?? ''), true);
        $messageId = $data['result']['message_id'] ?? null;
        if ($messageId) {
            $session['telegram_thread_message_id'] = (int)$messageId;
        }
    }

    telegram_group_save_session($clientChatId, $session);
}




function telegram_copy_client_media_to_admin_threaded(array $config, string $telegramLeadsChatId, string $clientChatId, array $update, ?string $userName): void
{
    if (!telegram_update_has_media($update)) return;

    $message = telegram_update_message($update);
    $messageId = (int)($message['message_id'] ?? 0);
    if ($messageId <= 0) return;

    $session = telegram_group_load_session($clientChatId);
    $threadMessageId = (int)($session['telegram_thread_message_id'] ?? 0);

    $caption = "📎 " . telegram_media_label($update) . " от клиента Telegram\n\n" .
        ($userName ? "Пользователь: {$userName}\n" : '') .
        "Chat ID: {$clientChatId}\n" .
        "Время: " . date('d.m.Y H:i:s');

    $result = telegram_copy_message(
        $config,
        $telegramLeadsChatId,
        $clientChatId,
        $messageId,
        $threadMessageId > 0 ? $threadMessageId : null,
        $caption
    );

    bot_log('telegram_copy_client_media_to_admin_threaded', [
        'client_chat_id' => $clientChatId,
        'telegram_chat_id' => $telegramLeadsChatId,
        'message_id' => $messageId,
        'thread_message_id' => $threadMessageId,
        'status' => $result['status'] ?? 0,
        'error' => $result['error'] ?? '',
        'response' => $result['response'] ?? null,
    ]);
}


function telegram_format_history(array $messages): string
{
    $items = array_slice($messages, -5);
    $lines = [];
    foreach ($items as $i => $item) {
        $text = trim((string)($item['text'] ?? ''));
        if ($text === '') continue;
        $lines[] = ($i + 1) . ') ' . $text;
    }
    return $lines ? implode("\n", $lines) : 'нет истории';
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
$hasClientMedia = telegram_update_has_media($update);

if (preg_match('/^\/(?:max|replymax)(?:@[A-Za-z0-9_]+)?\s+(-?\d+)\s+(.+)$/us', $trimmedText, $matches)) {
    $maxChatId = trim($matches[1]);
    $messageToClient = trim($matches[2]);

    if ($messageToClient === '') {
        telegram_reply_via_webhook($chatId, "Не вижу текст ответа. Формат:\n/max MAX_USER_ID текст сообщения клиенту");
        exit;
    }

    telegram_reply_via_webhook($chatId, "Отправляю ответ клиенту в MAX…");

    $sendResult = telegram_max_send_message_fast($config, $maxChatId, $messageToClient);
    $status = (int)($sendResult['status'] ?? 0);

    if ($status >= 200 && $status < 300) {
        telegram_send_message($config, $chatId, "Ответ отправлен в MAX user ID {$maxChatId}.");
    } else {
        $errorText = trim((string)($sendResult['error'] ?? ''));
        $responseText = trim((string)($sendResult['response'] ?? ''));
        $details = $errorText !== '' ? $errorText : $responseText;
        $details = $details !== '' ? "\nДетали: " . mb_substr($details, 0, 500) : '';
        telegram_send_message($config, $chatId, "Не удалось отправить ответ в MAX user ID {$maxChatId}. Статус: {$status}.{$details}");
    }

    bot_log('telegram_max_reply_command', [
        'operator_chat_id' => $chatId,
        'operator_user' => $userName,
        'max_chat_id' => $maxChatId,
        'status' => $status,
    ]);

    exit;
}

if ($normalizedText === '/start' || $normalizedText === 'start' || ($normalizedText === '' && !$hasClientMedia)) {
    telegram_reply_via_webhook($chatId, bot_text_for_start());
    exit;
}

$clientSession = telegram_group_load_session((string)$chatId);

$messages = is_array($clientSession['messages'] ?? null) ? $clientSession['messages'] : [];
$messageTextForSession = $trimmedText !== '' ? $trimmedText : ($hasClientMedia ? '[' . telegram_media_label($update) . ']' : '[без текста]');
$messages[] = [
    'text' => $messageTextForSession,
    'at' => date('c'),
];
$clientSession['messages'] = array_slice($messages, -20);

$messageHasLead = (bool)preg_match('/база|склад|ангар|помещен|недвиж|земл|участ|оборуд|станок|техник|спецтех|тмц|остат|кран|погруз|авто|актив/u', $normalizedText)
    && (bool)preg_match('/\d+\s*(млн|тыс|руб|₽|р\b)|цена|стоим/u', $normalizedText);

$hadLeadBefore = !empty($clientSession['lead_ready']);

if ($messageHasLead) {
    $clientSession['lead_ready'] = true;
    $clientSession['lead_text'] = $trimmedText;
}

$hasEnoughData = $messageHasLead || !empty($clientSession['lead_ready']);
$isSupplement = $hadLeadBefore && !$messageHasLead;

if ($hasEnoughData) {
    if ($isSupplement) {
        $replyText = $hasClientMedia
            ? "Спасибо, получил вложение и добавил его к заявке. Передал в рабочую группу A&A Asset Team."
            : "Спасибо, дополнил заявку и передал информацию в рабочую группу A&A Asset Team.";

        $autoReplyCountAfterLead = (int)($clientSession['auto_reply_count_after_lead'] ?? 0);
        if ($autoReplyCountAfterLead >= 1) {
            $replyText = '';
        } else {
            $clientSession['auto_reply_count_after_lead'] = $autoReplyCountAfterLead + 1;
        }
    } else {
        $replyText = "Спасибо. Заявку получил и передал в рабочую группу A&A Asset Team.\n\nЕсли есть фото, документы или ссылка на объявление — отправьте их следующим сообщением.";
        $clientSession['auto_reply_count_after_lead'] = 0;
    }
} else {
    $replyText = "Принял. Чтобы передать заявку в работу, добавьте одним сообщением:\n\n1. Что продаётся / какой актив\n2. Город или регион\n3. Желаемую цену\n4. Есть ли фото, документы или ссылка\n5. Удобный контакт для связи";
}

if ($replyText !== '') {
    telegram_reply_via_webhook($chatId, $replyText);
} else {
    bot_ok();
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
}

if ($isSupplement) {
    $newDataText = $hasClientMedia
        ? "Новое вложение: " . telegram_media_label($update) . "\nКомментарий:\n" . ($text !== '' ? $text : '[без текста]')
        : "Новое сообщение:\n" . ($text !== '' ? $text : '[без текста]');

    $adminNotice = "📎 ДОПОЛНЕНИЕ К ЗАЯВКЕ ИЗ Telegram\n\n" .
        ($userName ? "Пользователь: {$userName}\n" : '') .
        "Chat ID: {$chatId}\n\n" .
        $newDataText . "\n\n" .
        "История последних сообщений:\n" . telegram_format_history($clientSession['messages']) . "\n\n" .
        "Время: " . date('d.m.Y H:i:s') . "\n";
} else {
    $adminNotice = bot_format_admin_notice('Telegram', $chatId, $userName, $messageTextForSession, $update);
}

telegram_group_save_session((string)$chatId, $clientSession);

$telegramLeadsChatId = trim((string)($config['telegram_leads_chat_id'] ?? ''));
if ($telegramLeadsChatId === '') {
    $telegramLeadsChatId = trim((string)($config['telegram_admin_chat_id'] ?? ''));
}

if ($telegramLeadsChatId !== '' && !str_contains($telegramLeadsChatId, 'PASTE_')) {
    telegram_send_admin_notice_threaded($config, $telegramLeadsChatId, (string)$chatId, $adminNotice);
    if ($hasClientMedia) {
        telegram_copy_client_media_to_admin_threaded($config, $telegramLeadsChatId, (string)$chatId, $update, $userName);
    }
}
