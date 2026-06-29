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

    // Проверенный быстрый способ для ответа клиенту по MAX user_id.
    $attempts[] = [
        'platform_query_user_id',
        $apiBase . '/messages?user_id=' . rawurlencode($maxChatId),
        ['text' => $text],
        ['Authorization: ' . $token],
    ];

    if ($template !== '') {
        $url = str_replace(['{token}', '{chat_id}'], [rawurlencode($token), rawurlencode($maxChatId)], $template);
        $headers = str_contains($template, '{token}') ? [] : ['Authorization: ' . $token];
        $attempts[] = ['configured_template', $url, ['text' => $text], $headers];
    }

    $attempts[] = [
        'platform_query_chat_id',
        $apiBase . '/messages?chat_id=' . rawurlencode($maxChatId),
        ['text' => $text],
        ['Authorization: ' . $token],
    ];

    $lastResult = ['status' => 0, 'error' => 'MAX send attempts were not executed', 'response' => null];

    foreach ($attempts as $attempt) {
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
        'reply_markup' => [
            'inline_keyboard' => [
                [
                    [
                        'text' => '💬 Ответить клиенту',
                        'callback_data' => 'reply_client|telegram|' . $clientChatId,
                    ],
                ],
            ],
        ],
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

    if ((int)($result['status'] ?? 0) >= 200 && (int)($result['status'] ?? 0) < 300) {
        $data = json_decode((string)($result['response'] ?? ''), true);
        $messageId = (int)($data['result']['message_id'] ?? 0);

        if ($messageId > 0) {
            if ($threadMessageId <= 0) {
                $session['telegram_thread_message_id'] = $messageId;
            }

            $adminMessageIds = is_array($session['telegram_admin_message_ids'] ?? null) ? $session['telegram_admin_message_ids'] : [];
            $adminMessageIds[] = $messageId;
            $session['telegram_admin_message_ids'] = array_slice(array_values(array_unique(array_map('intval', $adminMessageIds))), -100);
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



function telegram_client_wants_operator(string $text): bool
{
    $t = mb_strtolower(trim($text), 'UTF-8');

    return (bool)preg_match(
        '/оператор|менеджер|специалист|человек|живой|связаться|связь|позвоните|позвонить|перезвоните|соедини|контакт|телефон|как с вами связаться/u',
        $t
    );
}

function telegram_live_reply_message_id(array $update): int
{
    $message = telegram_update_message($update);
    return (int)($message['reply_to_message']['message_id'] ?? 0);
}

function telegram_update_from_is_bot(array $update): bool
{
    $message = telegram_update_message($update);
    return !empty($message['from']['is_bot']);
}

function telegram_find_live_chat_by_group_message_id(int $messageId): ?array
{
    if ($messageId <= 0) return null;

    foreach (['telegram', 'max'] as $source) {
        $dir = __DIR__ . '/sessions/' . $source;
        if (!is_dir($dir)) continue;

        foreach (glob($dir . '/*.json') ?: [] as $file) {
            $raw = file_get_contents($file);
            $session = is_string($raw) ? json_decode($raw, true) : null;
            if (!is_array($session)) continue;

            $ids = [];

            $threadId = (int)($session['telegram_thread_message_id'] ?? 0);
            if ($threadId > 0) $ids[] = $threadId;

            if (is_array($session['telegram_admin_message_ids'] ?? null)) {
                foreach ($session['telegram_admin_message_ids'] as $id) {
                    $id = (int)$id;
                    if ($id > 0) $ids[] = $id;
                }
            }

            if (!in_array($messageId, array_values(array_unique($ids)), true)) continue;

            $clientChatId = trim((string)($session['client_chat_id'] ?? ''));
            if ($clientChatId === '') continue;

            return [
                'source' => $source,
                'client_chat_id' => $clientChatId,
                'file' => $file,
                'session' => $session,
            ];
        }
    }

    return null;
}

function telegram_save_live_chat_session(array $chat, string $operatorText): void
{
    $session = is_array($chat['session'] ?? null) ? $chat['session'] : [];

    $session['source'] = $chat['source'];
    $session['client_chat_id'] = $chat['client_chat_id'];
    $session['operator_mode'] = true;
    $session['bot_paused'] = true;
    $session['operator_started_at'] = $session['operator_started_at'] ?? date('c');
    $session['updated_at'] = date('c');

    $messages = is_array($session['messages'] ?? null) ? $session['messages'] : [];
    $messages[] = [
        'role' => 'operator',
        'text' => $operatorText !== '' ? $operatorText : '[вложение оператора]',
        'at' => date('c'),
    ];
    $session['messages'] = array_slice($messages, -30);

    @file_put_contents(
        (string)$chat['file'],
        json_encode($session, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function telegram_live_chat_control(array $config, string $operatorChatId, array $update, string $text): bool
{
    $command = mb_strtolower(trim($text), 'UTF-8');
    if (!preg_match('/^\/(?:close|pausebot|resume)(?:\s|$)/u', $command)) return false;

    $replyId = telegram_live_reply_message_id($update);
    $chat = telegram_find_live_chat_by_group_message_id($replyId);

    if (!$chat) {
        telegram_send_message($config, $operatorChatId, "Не нашёл клиента для этой карточки. Ответьте командой на карточку заявки или дополнение.");
        return true;
    }

    $session = is_array($chat['session'] ?? null) ? $chat['session'] : [];

    if (str_starts_with($command, '/close')) {
        $session['operator_mode'] = false;
        $session['bot_paused'] = false;
        $session['closed_at'] = date('c');
        $message = 'Чат закрыт. Бот снова может работать с клиентом автоматически.';
    } elseif (str_starts_with($command, '/resume')) {
        $session['operator_mode'] = false;
        $session['bot_paused'] = false;
        $message = 'Автоответы бота снова включены для этого клиента.';
    } else {
        $session['operator_mode'] = true;
        $session['bot_paused'] = true;
        $message = 'Автоответы бота поставлены на паузу. Оператор ведёт чат вручную.';
    }

    $session['updated_at'] = date('c');
    @file_put_contents(
        (string)$chat['file'],
        json_encode($session, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );

    telegram_send_message($config, $operatorChatId, $message);
    return true;
}

function telegram_handle_live_chat_operator_reply(array $config, string $operatorChatId, array $update, string $text): bool
{
    if (telegram_update_from_is_bot($update)) return false;

    
$telegramLeadsChatIdButtons = trim((string)($config['telegram_leads_chat_id'] ?? ''));
if ($telegramLeadsChatIdButtons === '') {
    $telegramLeadsChatIdButtons = trim((string)($config['telegram_admin_chat_id'] ?? ''));
}

if (($update['callback_query'] ?? null) && $telegramLeadsChatIdButtons !== '') {
    if (telegram_handle_reply_button_callback($config, $update, $telegramLeadsChatIdButtons)) {
        exit;
    }
}

if ($telegramLeadsChatIdButtons !== '' && (string)$chatId === (string)$telegramLeadsChatIdButtons) {
    if (telegram_handle_operator_to_command($config, $update, (string)$chatId, $trimmedText)) {
        exit;
    }
}


$telegramLeadsChatIdButtonsV2 = trim((string)($config['telegram_leads_chat_id'] ?? ''));
if ($telegramLeadsChatIdButtonsV2 === '') {
    $telegramLeadsChatIdButtonsV2 = trim((string)($config['telegram_admin_chat_id'] ?? ''));
}

if (($update['callback_query'] ?? null) && $telegramLeadsChatIdButtonsV2 !== '') {
    if (telegram_handle_reply_button_callback($config, $update, $telegramLeadsChatIdButtonsV2)) {
        bot_ok();
        exit;
    }
}

if ($telegramLeadsChatIdButtonsV2 !== '' && (string)$chatId === (string)$telegramLeadsChatIdButtonsV2) {
    if (telegram_handle_operator_to_command($config, $update, (string)$chatId, $trimmedText)) {
        bot_ok();
        exit;
    }
}

if (preg_match('/^\/(?:max|replymax)(?:@[A-Za-z0-9_]+)?\s+/us', trim($text))) {
        return false;
    }

    if (telegram_live_chat_control($config, $operatorChatId, $update, $text)) {
        return true;
    }

    $replyId = telegram_live_reply_message_id($update);
    if ($replyId <= 0) return false;

    $chat = telegram_find_live_chat_by_group_message_id($replyId);
    if (!$chat) return false;

    $source = (string)$chat['source'];
    $clientChatId = (string)$chat['client_chat_id'];
    $message = telegram_update_message($update);
    $messageId = (int)($message['message_id'] ?? 0);
    $hasMedia = telegram_update_has_media($update);
    $textToSend = trim($text);

    if ($source === 'telegram') {
        if ($hasMedia && $messageId > 0) {
            $result = telegram_copy_message($config, $clientChatId, $operatorChatId, $messageId);
        } else {
            if ($textToSend === '') return true;
            $result = telegram_api($config, 'sendMessage', [
                'chat_id' => $clientChatId,
                'text' => $textToSend,
                'disable_web_page_preview' => true,
            ]);
        }
    } else {
        if ($textToSend === '') {
            telegram_send_message($config, $operatorChatId, "Для MAX сейчас можно отправить только текст. Напишите ответ текстом в этом треде.");
            return true;
        }

        $result = telegram_max_send_message_fast($config, $clientChatId, $textToSend);
    }

    $status = (int)($result['status'] ?? 0);

    bot_log('telegram_live_chat_operator_reply', [
        'source' => $source,
        'client_chat_id' => $clientChatId,
        'operator_chat_id' => $operatorChatId,
        'status' => $status,
        'error' => $result['error'] ?? '',
        'response' => $result['response'] ?? null,
    ]);

    if ($status >= 200 && $status < 300) {
        telegram_save_live_chat_session($chat, $textToSend !== '' ? $textToSend : telegram_media_label($update));
        return true;
    }

    $details = trim((string)($result['error'] ?? ''));
    if ($details === '') $details = trim((string)($result['response'] ?? ''));
    $details = $details !== '' ? "\nДетали: " . mb_substr($details, 0, 500) : '';

    telegram_send_message($config, $operatorChatId, "Не удалось отправить сообщение клиенту. Статус: {$status}.{$details}");
    return true;
}


function telegram_answer_callback_query(array $config, string $callbackQueryId, string $text = ''): void
{
    if ($callbackQueryId === '') return;

    telegram_api($config, 'answerCallbackQuery', [
        'callback_query_id' => $callbackQueryId,
        'text' => $text,
        'show_alert' => false,
    ]);
}

function telegram_operator_id_from_update(array $update): string
{
    $from = $update['callback_query']['from'] ?? (telegram_update_message($update)['from'] ?? []);
    return trim((string)($from['id'] ?? '')) ?: 'unknown';
}

function telegram_operator_state_path(string $operatorId): string
{
    $dir = __DIR__ . '/sessions/operators';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    return $dir . '/' . hash('sha256', $operatorId) . '.json';
}

function telegram_operator_load_state(string $operatorId): array
{
    $path = telegram_operator_state_path($operatorId);
    if (!is_file($path)) return [];

    $raw = file_get_contents($path);
    $data = is_string($raw) ? json_decode($raw, true) : null;

    return is_array($data) ? $data : [];
}

function telegram_operator_save_state(string $operatorId, array $state): void
{
    $state['operator_id'] = $operatorId;
    $state['updated_at'] = date('c');

    @file_put_contents(
        telegram_operator_state_path($operatorId),
        json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function telegram_operator_clear_state(string $operatorId): void
{
    $path = telegram_operator_state_path($operatorId);
    if (is_file($path)) @unlink($path);
}

function telegram_find_client_session_for_operator(string $source, string $clientId): array
{
    $source = $source === 'telegram' ? 'telegram' : 'max';
    $path = __DIR__ . '/sessions/' . $source . '/' . hash('sha256', $clientId) . '.json';

    $session = [];
    if (is_file($path)) {
        $raw = file_get_contents($path);
        $data = is_string($raw) ? json_decode($raw, true) : null;
        if (is_array($data)) $session = $data;
    }

    $session['source'] = $source;
    $session['client_chat_id'] = $clientId;

    return [
        'source' => $source,
        'client_chat_id' => $clientId,
        'file' => $path,
        'session' => $session,
    ];
}

function telegram_set_client_operator_mode(array $client, bool $enabled): void
{
    $session = is_array($client['session'] ?? null) ? $client['session'] : [];

    $session['source'] = $client['source'];
    $session['client_chat_id'] = $client['client_chat_id'];
    $session['operator_mode'] = $enabled;
    $session['bot_paused'] = $enabled;
    $session['updated_at'] = date('c');

    if ($enabled) {
        $session['operator_started_at'] = $session['operator_started_at'] ?? date('c');
    } else {
        $session['operator_closed_at'] = date('c');
    }

    @file_put_contents(
        (string)$client['file'],
        json_encode($session, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function telegram_send_operator_text_to_client(array $config, string $source, string $clientId, string $text): array
{
    $text = trim($text);
    if ($text === '') {
        return ['status' => 0, 'error' => 'Empty message', 'response' => null];
    }

    if ($source === 'telegram') {
        return telegram_api($config, 'sendMessage', [
            'chat_id' => $clientId,
            'text' => $text,
            'disable_web_page_preview' => true,
        ]);
    }

    return telegram_max_send_message_fast($config, $clientId, $text);
}

function telegram_handle_reply_button_callback(array $config, array $update, string $operatorGroupChatId): bool
{
    $callback = $update['callback_query'] ?? null;
    if (!is_array($callback)) return false;

    $data = trim((string)($callback['data'] ?? ''));
    $callbackId = trim((string)($callback['id'] ?? ''));

    bot_log('telegram_callback_received', [
        'data' => $data,
        'from' => $callback['from'] ?? null,
    ]);

    if (!preg_match('/^reply_client\|(telegram|max)\|(-?\d+)$/', $data, $m)) {
        telegram_answer_callback_query($config, $callbackId, 'Кнопка не распознана');
        return false;
    }

    $source = $m[1];
    $clientId = $m[2];
    $operatorId = telegram_operator_id_from_update($update);

    $client = telegram_find_client_session_for_operator($source, $clientId);
    telegram_set_client_operator_mode($client, true);

    telegram_operator_save_state($operatorId, [
        'source' => $source,
        'client_chat_id' => $clientId,
        'started_at' => date('c'),
    ]);

    $sourceLabel = $source === 'max' ? 'MAX' : 'Telegram';

    telegram_answer_callback_query($config, $callbackId, 'Оператор подключён');

    telegram_send_message(
        $config,
        $operatorGroupChatId,
        "💬 Оператор подключён к клиенту {$sourceLabel} {$clientId}.\n\nТеперь отправляйте сообщения клиенту так:\n/to текст сообщения\n\nЗавершить чат:\n/close"
    );

    telegram_send_operator_text_to_client(
        $config,
        $source,
        $clientId,
        'Оператор A&A Asset Team подключился к вашему обращению. Можно продолжить общение здесь.'
    );

    return true;
}

function telegram_handle_operator_to_command(array $config, array $update, string $operatorGroupChatId, string $text): bool
{
    if (telegram_update_from_is_bot($update)) return true;

    $operatorId = telegram_operator_id_from_update($update);
    $trimmed = trim($text);

    if (preg_match('/^\/close(?:\s|$)/u', $trimmed)) {
        $state = telegram_operator_load_state($operatorId);

        if (!$state) {
            telegram_send_message($config, $operatorGroupChatId, 'У вас нет активного чата с клиентом.');
            return true;
        }

        $source = (string)($state['source'] ?? 'max');
        $clientId = (string)($state['client_chat_id'] ?? '');

        if ($clientId !== '') {
            $client = telegram_find_client_session_for_operator($source, $clientId);
            telegram_set_client_operator_mode($client, false);
        }

        telegram_operator_clear_state($operatorId);
        telegram_send_message($config, $operatorGroupChatId, 'Live-чат закрыт. Бот снова может отвечать клиенту автоматически.');
        return true;
    }

    if (!preg_match('/^\/(?:to|send)\s+(.+)$/us', $trimmed, $m)) {
        return false;
    }

    $state = telegram_operator_load_state($operatorId);
    if (!$state) {
        telegram_send_message($config, $operatorGroupChatId, "Сначала нажмите кнопку 💬 Ответить клиенту под карточкой заявки.");
        return true;
    }

    $source = (string)($state['source'] ?? '');
    $clientId = (string)($state['client_chat_id'] ?? '');
    $messageToClient = trim($m[1]);

    $result = telegram_send_operator_text_to_client($config, $source, $clientId, $messageToClient);
    $status = (int)($result['status'] ?? 0);

    bot_log('telegram_operator_to_client', [
        'source' => $source,
        'client_id' => $clientId,
        'status' => $status,
        'error' => $result['error'] ?? '',
        'response' => $result['response'] ?? null,
    ]);

    if ($status >= 200 && $status < 300) {
        return true;
    }

    $details = trim((string)($result['error'] ?? ''));
    if ($details === '') $details = trim((string)($result['response'] ?? ''));

    telegram_send_message(
        $config,
        $operatorGroupChatId,
        "Не удалось отправить сообщение клиенту. Статус: {$status}.\n" . mb_substr($details, 0, 500)
    );

    return true;
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

// Early callback handler for inline button "💬 Ответить клиенту".
// It must run before normal message/group logic.
if (isset($update['callback_query']) && is_array($update['callback_query'])) {
    $callback = $update['callback_query'];
    $callbackData = trim((string)($callback['data'] ?? ''));
    $callbackId = trim((string)($callback['id'] ?? ''));
    $operatorId = trim((string)($callback['from']['id'] ?? 'unknown'));

    bot_log('telegram_callback_early_received', [
        'data' => $callbackData,
        'operator_id' => $operatorId,
        'from' => $callback['from'] ?? null,
    ]);

    if (preg_match('/^reply_client\|(telegram|max)\|(-?\d+)$/', $callbackData, $cbMatch)) {
        $source = $cbMatch[1];
        $clientId = $cbMatch[2];

        // Answer callback so Telegram stops the button loading animation.
        if ($callbackId !== '') {
            telegram_api($config, 'answerCallbackQuery', [
                'callback_query_id' => $callbackId,
                'text' => 'Оператор подключён',
                'show_alert' => false,
            ]);
        }

        $dir = __DIR__ . '/sessions/operators';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);

        @file_put_contents(
            $dir . '/' . hash('sha256', $operatorId) . '.json',
            json_encode([
                'operator_id' => $operatorId,
                'source' => $source,
                'client_chat_id' => $clientId,
                'started_at' => date('c'),
                'updated_at' => date('c'),
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
            LOCK_EX
        );

        $clientDir = __DIR__ . '/sessions/' . $source;
        if (!is_dir($clientDir)) @mkdir($clientDir, 0755, true);
        $clientFile = $clientDir . '/' . hash('sha256', $clientId) . '.json';

        $clientSession = [];
        if (is_file($clientFile)) {
            $raw = file_get_contents($clientFile);
            $decoded = is_string($raw) ? json_decode($raw, true) : null;
            if (is_array($decoded)) $clientSession = $decoded;
        }

        $clientSession['source'] = $source;
        $clientSession['client_chat_id'] = $clientId;
        $clientSession['operator_mode'] = true;
        $clientSession['bot_paused'] = true;
        $clientSession['operator_started_at'] = $clientSession['operator_started_at'] ?? date('c');
        $clientSession['updated_at'] = date('c');

        @file_put_contents(
            $clientFile,
            json_encode($clientSession, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
            LOCK_EX
        );

        $telegramLeadsChatIdEarly = trim((string)($config['telegram_leads_chat_id'] ?? ''));
        if ($telegramLeadsChatIdEarly === '') {
            $telegramLeadsChatIdEarly = trim((string)($config['telegram_admin_chat_id'] ?? ''));
        }

        $sourceLabel = $source === 'max' ? 'MAX' : 'Telegram';

        if ($telegramLeadsChatIdEarly !== '') {
            telegram_send_message(
                $config,
                $telegramLeadsChatIdEarly,
                "💬 Оператор подключён к клиенту {$sourceLabel} {$clientId}.\n\nТеперь отправляйте сообщения клиенту так:\n/to текст сообщения\n\nЗавершить чат:\n/close"
            );
        }

        if ($source === 'max') {
            telegram_max_send_message_fast(
                $config,
                $clientId,
                'Оператор A&A Asset Team подключился к вашему обращению. Можно продолжить общение здесь.'
            );
        } else {
            telegram_send_message(
                $config,
                $clientId,
                'Оператор A&A Asset Team подключился к вашему обращению. Можно продолжить общение здесь.'
            );
        }

        bot_ok();
        exit;
    }

    if ($callbackId !== '') {
        telegram_api($config, 'answerCallbackQuery', [
            'callback_query_id' => $callbackId,
            'text' => 'Кнопка не распознана',
            'show_alert' => false,
        ]);
    }

    bot_ok();
    exit;
}

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
$wantsOperator = telegram_client_wants_operator($trimmedText);


// Emergency /to handler for operator live chat.
// Must run before old group handlers, otherwise /to is ignored.
$telegramLeadsChatIdToCommand = trim((string)($config['telegram_leads_chat_id'] ?? ''));
if ($telegramLeadsChatIdToCommand === '') {
    $telegramLeadsChatIdToCommand = trim((string)($config['telegram_admin_chat_id'] ?? ''));
}

if ($telegramLeadsChatIdToCommand !== '' && (string)$chatId === (string)$telegramLeadsChatIdToCommand) {
    $fromForTo = $update['message']['from'] ?? [];
    $operatorIdForTo = trim((string)($fromForTo['id'] ?? 'unknown'));

    $operatorsDirForTo = __DIR__ . '/sessions/operators';
    if (!is_dir($operatorsDirForTo)) @mkdir($operatorsDirForTo, 0755, true);

    $operatorStateFileForTo = $operatorsDirForTo . '/' . hash('sha256', $operatorIdForTo) . '.json';

    $sendToClient = static function (array $config, string $source, string $clientId, string $messageText): array {
        if ($source === 'telegram') {
            return telegram_send_message($config, $clientId, $messageText);
        }

        return telegram_max_send_message_fast($config, $clientId, $messageText);
    };

    $finishOperatorCommand = static function () {
        bot_ok();
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
        exit;
    };

    if (preg_match('/^\/(?:to|send)(?:@[A-Za-z0-9_]+)?\s+(.+)$/us', $trimmedText, $toMatches)) {
        $state = [];

        if (is_file($operatorStateFileForTo)) {
            $rawState = file_get_contents($operatorStateFileForTo);
            $decodedState = is_string($rawState) ? json_decode($rawState, true) : null;
            if (is_array($decodedState)) $state = $decodedState;
        }

        $sourceTo = trim((string)($state['source'] ?? ''));
        $clientIdTo = trim((string)($state['client_chat_id'] ?? ''));

        if ($sourceTo === '' || $clientIdTo === '') {
            telegram_send_message($config, (string)$chatId, "Сначала нажмите кнопку «💬 Ответить клиенту» под карточкой заявки, потом отправьте:\n/to текст сообщения");
            $finishOperatorCommand();
        }

        $messageToClient = trim($toMatches[1]);
        $resultTo = $sendToClient($config, $sourceTo, $clientIdTo, $messageToClient);
        $statusTo = (int)($resultTo['status'] ?? 0);

        bot_log('telegram_to_command_send', [
            'operator_id' => $operatorIdForTo,
            'source' => $sourceTo,
            'client_id' => $clientIdTo,
            'status' => $statusTo,
            'error' => $resultTo['error'] ?? '',
            'response' => $resultTo['response'] ?? null,
        ]);

        if ($statusTo >= 200 && $statusTo < 300) {
            telegram_send_message($config, (string)$chatId, "✅ Отправлено клиенту " . ($sourceTo === 'max' ? 'MAX' : 'Telegram') . " {$clientIdTo}.");
        } else {
            $detailsTo = trim((string)($resultTo['error'] ?? ''));
            if ($detailsTo === '') $detailsTo = trim((string)($resultTo['response'] ?? ''));
            telegram_send_message($config, (string)$chatId, "❌ Не удалось отправить клиенту. Статус: {$statusTo}.\n" . mb_substr($detailsTo, 0, 700));
        }

        $finishOperatorCommand();
    }

    // Запасной быстрый формат: /64541293 текст
    if (preg_match('/^\/(-?\d+)\s+(.+)$/us', $trimmedText, $directMatches)) {
        $clientIdTo = trim($directMatches[1]);
        $messageToClient = trim($directMatches[2]);
        $sourceTo = 'max';

        @file_put_contents(
            $operatorStateFileForTo,
            json_encode([
                'operator_id' => $operatorIdForTo,
                'source' => $sourceTo,
                'client_chat_id' => $clientIdTo,
                'started_at' => date('c'),
                'updated_at' => date('c'),
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
            LOCK_EX
        );

        $resultTo = telegram_max_send_message_fast($config, $clientIdTo, $messageToClient);
        $statusTo = (int)($resultTo['status'] ?? 0);

        bot_log('telegram_direct_max_id_send', [
            'operator_id' => $operatorIdForTo,
            'client_id' => $clientIdTo,
            'status' => $statusTo,
            'error' => $resultTo['error'] ?? '',
            'response' => $resultTo['response'] ?? null,
        ]);

        if ($statusTo >= 200 && $statusTo < 300) {
            telegram_send_message($config, (string)$chatId, "✅ Отправлено клиенту MAX {$clientIdTo}.");
        } else {
            $detailsTo = trim((string)($resultTo['error'] ?? ''));
            if ($detailsTo === '') $detailsTo = trim((string)($resultTo['response'] ?? ''));
            telegram_send_message($config, (string)$chatId, "❌ Не удалось отправить клиенту MAX {$clientIdTo}. Статус: {$statusTo}.\n" . mb_substr($detailsTo, 0, 700));
        }

        $finishOperatorCommand();
    }

    if (preg_match('/^\/close(?:@[A-Za-z0-9_]+)?(?:\s|$)/us', $trimmedText)) {
        if (is_file($operatorStateFileForTo)) {
            $rawState = file_get_contents($operatorStateFileForTo);
            $state = is_string($rawState) ? json_decode($rawState, true) : null;

            if (is_array($state)) {
                $sourceTo = trim((string)($state['source'] ?? ''));
                $clientIdTo = trim((string)($state['client_chat_id'] ?? ''));

                if ($sourceTo !== '' && $clientIdTo !== '') {
                    $clientFileTo = __DIR__ . '/sessions/' . $sourceTo . '/' . hash('sha256', $clientIdTo) . '.json';
                    if (is_file($clientFileTo)) {
                        $rawClient = file_get_contents($clientFileTo);
                        $clientSession = is_string($rawClient) ? json_decode($rawClient, true) : null;
                        if (is_array($clientSession)) {
                            $clientSession['operator_mode'] = false;
                            $clientSession['bot_paused'] = false;
                            $clientSession['operator_closed_at'] = date('c');
                            $clientSession['updated_at'] = date('c');

                            @file_put_contents(
                                $clientFileTo,
                                json_encode($clientSession, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
                                LOCK_EX
                            );
                        }
                    }
                }
            }

            @unlink($operatorStateFileForTo);
        }

        telegram_send_message($config, (string)$chatId, "Live-чат закрыт. Бот снова может отвечать клиенту автоматически.");
        $finishOperatorCommand();
    }
}



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


$telegramLeadsChatIdForLive = trim((string)($config['telegram_leads_chat_id'] ?? ''));
if ($telegramLeadsChatIdForLive === '') {
    $telegramLeadsChatIdForLive = trim((string)($config['telegram_admin_chat_id'] ?? ''));
}

if ($telegramLeadsChatIdForLive !== '' && (string)$chatId === (string)$telegramLeadsChatIdForLive) {
    if (telegram_handle_live_chat_operator_reply($config, (string)$chatId, $update, $trimmedText)) {
        exit;
    }

    // Обычные сообщения в рабочей группе без ответа на карточку игнорируем.
    bot_ok();
    exit;
}

if ($normalizedText === '/start' || $normalizedText === 'start' || ($normalizedText === '' && !$hasClientMedia)) {
    telegram_reply_via_webhook($chatId, bot_text_for_start());
    exit;
}

$clientSession = telegram_group_load_session((string)$chatId);
$clientSession['source'] = 'telegram';
$clientSession['client_chat_id'] = (string)$chatId;

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
$operatorMode = !empty($clientSession['operator_mode']);

if ($operatorMode) {
    $replyText = '';
} elseif ($hasEnoughData) {
    if ($wantsOperator) {
        $replyText = "Передал запрос оператору A&A Asset Team. Специалист посмотрит заявку и вернётся с ответом в этом чате.";
        $clientSession['operator_requested'] = true;
    } elseif ($isSupplement) {
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
    if ($wantsOperator) {
        $replyText = "Передал запрос оператору A&A Asset Team. Чтобы специалист быстрее разобрал обращение, напишите, пожалуйста, что нужно реализовать, город/регион и ориентировочную цену.";
        $clientSession['operator_requested'] = true;
    } else {
        $replyText = "Принял. Чтобы передать заявку в работу, добавьте одним сообщением:\n\n1. Что продаётся / какой актив\n2. Город или регион\n3. Желаемую цену\n4. Есть ли фото, документы или ссылка\n5. Удобный контакт для связи";
    }
}

if ($replyText !== '') {
    if ($replyText !== '') {
    telegram_reply_via_webhook($chatId, $replyText);
} else {
    bot_ok();
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
}
} else {
    bot_ok();
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
}

if ($operatorMode) {
    $newDataText = $hasClientMedia
        ? "Новое вложение: " . telegram_media_label($update) . "\nКомментарий:\n" . ($text !== '' ? $text : '[без текста]')
        : "Сообщение клиента:\n" . ($text !== '' ? $text : '[без текста]');

    $adminNotice = "💬 СООБЩЕНИЕ КЛИЕНТА ИЗ Telegram\n\n" .
        ($userName ? "Пользователь: {$userName}\n" : '') .
        "Chat ID: {$chatId}\n\n" .
        $newDataText . "\n\n" .
        "История последних сообщений:\n" . telegram_format_history($clientSession['messages']) . "\n\n" .
        "Время: " . date('d.m.Y H:i:s') . "\n";
} elseif ($wantsOperator) {
    $adminNotice = "🚨 КЛИЕНТ ПРОСИТ ОПЕРАТОРА\n\n" .
        ($userName ? "Пользователь: {$userName}\n" : '') .
        "Chat ID: {$chatId}\n\n" .
        "Сообщение клиента:\n" . ($text !== '' ? $text : '[без текста]') . "\n\n" .
        "История последних сообщений:\n" . telegram_format_history($clientSession['messages']) . "\n\n" .
        "Время: " . date('d.m.Y H:i:s') . "\n";
} elseif ($isSupplement) {
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
