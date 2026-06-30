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

    $apiBase = rtrim((string)($config['max_api_base'] ?? 'https://platform-api2.max.ru'), '/');
        if ($apiBase === 'https://platform-api.max.ru') {
            $apiBase = 'https://platform-api2.max.ru';
        }
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

    telegram_maybe_send_operator_intro($config, $source, $clientId);

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



function telegram_client_session_file_for_source(string $source, string $clientId): string
{
    $source = $source === 'telegram' ? 'telegram' : 'max';
    $dir = __DIR__ . '/sessions/' . $source;
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    return $dir . '/' . hash('sha256', $clientId) . '.json';
}

function telegram_load_client_session_for_source(string $source, string $clientId): array
{
    $file = telegram_client_session_file_for_source($source, $clientId);
    if (!is_file($file)) return [];

    $raw = file_get_contents($file);
    $data = is_string($raw) ? json_decode($raw, true) : null;

    return is_array($data) ? $data : [];
}

function telegram_save_client_session_for_source(string $source, string $clientId, array $session): void
{
    $file = telegram_client_session_file_for_source($source, $clientId);

    $session['source'] = $source === 'telegram' ? 'telegram' : 'max';
    $session['client_chat_id'] = $clientId;
    $session['updated_at'] = date('c');

    @file_put_contents(
        $file,
        json_encode($session, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function telegram_maybe_send_operator_intro(array $config, string $source, string $clientId): array
{
    $source = $source === 'telegram' ? 'telegram' : 'max';
    $session = telegram_load_client_session_for_source($source, $clientId);

    $session['source'] = $source;
    $session['client_chat_id'] = $clientId;
    $session['operator_mode'] = true;
    $session['bot_paused'] = true;
    $session['operator_started_at'] = $session['operator_started_at'] ?? date('c');

    // Главное: приветствие оператора клиенту отправляем только один раз.
    if (!empty($session['operator_intro_sent_at'])) {
        telegram_save_client_session_for_source($source, $clientId, $session);

        bot_log('telegram_operator_intro_skipped', [
            'source' => $source,
            'client_id' => $clientId,
            'operator_intro_sent_at' => $session['operator_intro_sent_at'],
        ]);

        return ['status' => 200, 'error' => '', 'response' => 'operator intro already sent'];
    }

    $intro = 'Оператор A&A Asset Team подключился к вашему обращению. Можно продолжить общение здесь.';

    if ($source === 'telegram') {
        $result = telegram_send_message($config, $clientId, $intro);
    } else {
        $result = telegram_max_send_message_fast($config, $clientId, $intro);
    }

    $status = (int)($result['status'] ?? 0);

    if ($status >= 200 && $status < 300) {
        $session['operator_intro_sent_at'] = date('c');
    }

    telegram_save_client_session_for_source($source, $clientId, $session);

    bot_log('telegram_operator_intro_sent_once', [
        'source' => $source,
        'client_id' => $clientId,
        'status' => $status,
        'error' => $result['error'] ?? '',
        'response' => $result['response'] ?? null,
    ]);

    return $result;
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



if (!function_exists('telegram_close_operator_chat_by_button_v1')) {
    function telegram_close_operator_chat_by_button_v1(array $config, string $source, string $clientId, string $operatorId = ''): void
    {
        $source = $source === 'telegram' ? 'telegram' : 'max';

        $clientDir = __DIR__ . '/sessions/' . $source;
        if (!is_dir($clientDir)) @mkdir($clientDir, 0755, true);

        $clientFile = $clientDir . '/' . hash('sha256', $clientId) . '.json';

        $session = [];
        if (is_file($clientFile)) {
            $raw = file_get_contents($clientFile);
            $decoded = is_string($raw) ? json_decode($raw, true) : null;
            if (is_array($decoded)) $session = $decoded;
        }

        $session['source'] = $source;
        $session['client_chat_id'] = $clientId;
        $session['operator_mode'] = false;
        $session['bot_paused'] = false;
        $session['operator_closed_at'] = date('c');
        $session['updated_at'] = date('c');

        @file_put_contents(
            $clientFile,
            json_encode($session, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
            LOCK_EX
        );

        $operatorsDir = __DIR__ . '/sessions/operators';
        if (is_dir($operatorsDir)) {
            foreach (glob($operatorsDir . '/*.json') ?: [] as $operatorFile) {
                $rawOperator = file_get_contents($operatorFile);
                $operatorState = is_string($rawOperator) ? json_decode($rawOperator, true) : null;

                if (!is_array($operatorState)) continue;

                $sameClient = (string)($operatorState['source'] ?? '') === $source
                    && (string)($operatorState['client_chat_id'] ?? '') === (string)$clientId;

                $sameOperator = $operatorId !== ''
                    && (string)($operatorState['operator_id'] ?? '') === (string)$operatorId;

                if ($sameClient || $sameOperator) {
                    @unlink($operatorFile);
                }
            }
        }

        bot_log('telegram_close_operator_chat_by_button', [
            'source' => $source,
            'client_id' => $clientId,
            'operator_id' => $operatorId,
        ]);
    }
}



if (!function_exists('telegram_notify_client_chat_closed_v1')) {
    function telegram_notify_client_chat_closed_v1(array $config, string $source, string $clientId): array
    {
        $source = $source === 'telegram' ? 'telegram' : 'max';

        $text = 'Чат с оператором завершён. Если у вас появятся дополнительные вопросы — просто напишите здесь, мы продолжим общение.';

        if ($source === 'telegram') {
            return telegram_send_message($config, $clientId, $text);
        }

        return telegram_max_send_message_fast($config, $clientId, $text);
    }
}



if (!function_exists('telegram_answer_callback_fast_v1')) {
    function telegram_answer_callback_fast_v1(string $callbackQueryId, string $text = ''): void
    {
        static $alreadyAnswered = false;

        if ($alreadyAnswered || $callbackQueryId === '') {
            return;
        }

        $alreadyAnswered = true;

        bot_log('telegram_callback_fast_answer', [
            'callback_query_id' => $callbackQueryId !== '' ? 'present' : 'missing',
            'text' => $text,
        ]);

        if (!headers_sent()) {
            header('Content-Type: application/json; charset=UTF-8');
        }

        echo json_encode([
            'method' => 'answerCallbackQuery',
            'callback_query_id' => $callbackQueryId,
            'text' => $text,
            'show_alert' => false,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        // Закрываем webhook-ответ Telegram сразу.
        // Дальше PHP продолжит отправлять сообщения в группу / клиенту уже фоном.
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
            return;
        }

        if (ob_get_level() > 0) {
            @ob_flush();
        }

        @flush();
    }
}



if (!function_exists('telegram_max_find_first_value_v1')) {
    function telegram_max_find_first_value_v1($value, array $keys): string
    {
        if (!is_array($value)) return '';

        foreach ($value as $key => $child) {
            if (in_array((string)$key, $keys, true) && is_scalar($child) && trim((string)$child) !== '') {
                return trim((string)$child);
            }

            if (is_array($child)) {
                $found = telegram_max_find_first_value_v1($child, $keys);
                if ($found !== '') return $found;
            }
        }

        return '';
    }
}

if (!function_exists('telegram_extract_file_for_max_v1')) {
    function telegram_extract_file_for_max_v1(array $update): array
    {
        $message = telegram_update_message($update);

        if (isset($message['document']) && is_array($message['document'])) {
            $doc = $message['document'];
            return [
                'file_id' => trim((string)($doc['file_id'] ?? '')),
                'file_name' => trim((string)($doc['file_name'] ?? 'document.pdf')) ?: 'document.pdf',
                'mime_type' => trim((string)($doc['mime_type'] ?? 'application/octet-stream')) ?: 'application/octet-stream',
                'kind' => 'file',
            ];
        }

        if (isset($message['photo']) && is_array($message['photo'])) {
            $photos = $message['photo'];
            $photo = end($photos);
            if (is_array($photo)) {
                return [
                    'file_id' => trim((string)($photo['file_id'] ?? '')),
                    'file_name' => 'photo_' . date('Ymd_His') . '.jpg',
                    'mime_type' => 'image/jpeg',
                    'kind' => 'file',
                ];
            }
        }

        if (isset($message['video']) && is_array($message['video'])) {
            $video = $message['video'];
            return [
                'file_id' => trim((string)($video['file_id'] ?? '')),
                'file_name' => trim((string)($video['file_name'] ?? 'video.mp4')) ?: 'video.mp4',
                'mime_type' => trim((string)($video['mime_type'] ?? 'video/mp4')) ?: 'video/mp4',
                'kind' => 'file',
            ];
        }

        return [];
    }
}

if (!function_exists('telegram_safe_filename_v1')) {
    function telegram_safe_filename_v1(string $name): string
    {
        $name = basename($name);
        $name = preg_replace('/[^A-Za-zА-Яа-яЁё0-9._-]+/u', '_', $name) ?? 'file';
        $name = trim($name, '._-');
        return $name !== '' ? $name : 'file';
    }
}

if (!function_exists('telegram_download_telegram_file_for_max_v1')) {
    function telegram_download_telegram_file_for_max_v1(array $config, string $fileId, string $fileName): array
    {
        $token = trim((string)($config['telegram_bot_token'] ?? ''));
        if ($token === '' || str_contains($token, 'PASTE_')) {
            return ['ok' => false, 'error' => 'Missing Telegram token'];
        }

        $getFile = telegram_api($config, 'getFile', ['file_id' => $fileId]);
        $status = (int)($getFile['status'] ?? 0);

        if ($status < 200 || $status >= 300) {
            return ['ok' => false, 'error' => 'Telegram getFile failed: ' . (($getFile['response'] ?? '') ?: ($getFile['error'] ?? ''))];
        }

        $data = json_decode((string)($getFile['response'] ?? ''), true);
        $filePath = trim((string)($data['result']['file_path'] ?? ''));

        if ($filePath === '') {
            return ['ok' => false, 'error' => 'Telegram file_path missing'];
        }

        $dir = __DIR__ . '/tmp/max_uploads';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);

        $safeName = telegram_safe_filename_v1($fileName);
        $localPath = $dir . '/' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $safeName;

        $url = 'https://api.telegram.org/file/bot' . $token . '/' . $filePath;

        $ips = [
            '149.154.166.110',
            '149.154.167.220',
            '149.154.167.99',
            '149.154.167.50',
            '149.154.167.51',
            '149.154.167.91',
        ];

        $downloadAttempts = [];

        foreach ($ips as $ip) {
            $downloadAttempts[] = [
                'name' => 'telegram_ip_' . $ip,
                'cmd' => 'curl -4 -L -sS --retry 0 --connect-timeout 5 --max-time 12 --http1.1 --tlsv1.2 '
                    . '--resolve ' . escapeshellarg('api.telegram.org:443:' . $ip) . ' '
                    . '-o ' . escapeshellarg($localPath) . ' '
                    . escapeshellarg($url) . ' 2>&1',
            ];
        }

        $downloadAttempts[] = [
            'name' => 'direct_dns',
            'cmd' => 'curl -4 -L -sS --retry 0 --connect-timeout 5 --max-time 12 --http1.1 --tlsv1.2 '
                . '-o ' . escapeshellarg($localPath) . ' '
                . escapeshellarg($url) . ' 2>&1',
        ];

        $lastOutput = '';

        foreach ($downloadAttempts as $attempt) {
            if (is_file($localPath)) {
                @unlink($localPath);
            }

            $output = (string)shell_exec($attempt['cmd']);
            $lastOutput = $output;

            bot_log('telegram_file_download_attempt_for_max', [
                'attempt' => $attempt['name'],
                'file_name' => $safeName,
                'exists' => is_file($localPath),
                'size' => is_file($localPath) ? filesize($localPath) : 0,
                'output' => mb_substr($output, 0, 500),
            ]);

            if (is_file($localPath) && filesize($localPath) > 0) {
                bot_log('telegram_file_downloaded_for_max', [
                    'file_id' => 'present',
                    'file_name' => $safeName,
                    'size' => filesize($localPath),
                    'attempt' => $attempt['name'],
                ]);

                return [
                    'ok' => true,
                    'path' => $localPath,
                    'file_name' => $safeName,
                ];
            }
        }

        return ['ok' => false, 'error' => 'Telegram file download failed: ' . $lastOutput];
    }
}

if (!function_exists('telegram_max_json_request_v1')) {
    function telegram_max_json_request_v1(string $method, string $url, ?array $payload, array $headers = []): array
    {
        $ch = curl_init($url);

        $httpHeaders = array_merge(['Accept: application/json'], $headers);

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $httpHeaders,
        ]);

        if ($payload !== null) {
            $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body === false ? '{}' : $body);
            $httpHeaders[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_HTTPHEADER, $httpHeaders);
        }

        $response = curl_exec($ch);
        $error = curl_error($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        bot_log('telegram_max_json_request_v1', [
            'method' => $method,
            'url' => bot_mask_url($url),
            'status' => $status,
            'error' => $error,
            'response' => $response,
        ]);

        return ['status' => $status, 'error' => $error, 'response' => $response];
    }
}

if (!function_exists('telegram_max_upload_multipart_v1')) {
    function telegram_max_upload_multipart_v1(string $uploadUrl, string $path, string $fileName, string $mimeType, array $headers = []): array
    {
        foreach (['data', 'file'] as $fieldName) {
            $ch = curl_init($uploadUrl);

            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_TIMEOUT => 60,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_HTTPHEADER => array_merge(['Accept: application/json'], $headers),
                CURLOPT_POSTFIELDS => [
                    $fieldName => new CURLFile($path, $mimeType ?: 'application/octet-stream', $fileName),
                ],
            ]);

            $response = curl_exec($ch);
            $error = curl_error($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            bot_log('telegram_max_upload_multipart_v1', [
                'field' => $fieldName,
                'upload_url' => bot_mask_url($uploadUrl),
                'file_name' => $fileName,
                'status' => $status,
                'error' => $error,
                'response' => $response,
            ]);

            if ($status >= 200 && $status < 300) {
                return ['status' => $status, 'error' => $error, 'response' => $response];
            }
        }

        return ['status' => 0, 'error' => 'MAX upload attempts failed', 'response' => null];
    }
}

if (!function_exists('telegram_max_send_file_native_v1')) {
    function telegram_max_send_file_native_v1(array $config, string $maxUserId, string $path, string $fileName, string $mimeType, string $caption = ''): array
    {
        $token = trim((string)($config['max_bot_token'] ?? ''));
        if ($token === '' || str_contains($token, 'PASTE_')) {
            return ['status' => 0, 'error' => 'Missing MAX token', 'response' => null];
        }

        $apiBase = rtrim((string)($config['max_api_base'] ?? 'https://platform-api.max.ru'), '/');
        $headers = ['Authorization: ' . $token];

        $uploadUrl = '';
        $uploadUrlAttempts = [
            ['POST', $apiBase . '/uploads?type=file', []],
            ['GET',  $apiBase . '/uploads?type=file', null],
            ['POST', $apiBase . '/uploads?type=photo', []],
            ['GET',  $apiBase . '/uploads?type=photo', null],
        ];

        foreach ($uploadUrlAttempts as $attempt) {
            [$method, $url, $payload] = $attempt;
            $result = telegram_max_json_request_v1($method, $url, $payload, $headers);
            $status = (int)($result['status'] ?? 0);

            if ($status >= 200 && $status < 300) {
                $json = json_decode((string)($result['response'] ?? ''), true);
                $uploadUrl = telegram_max_find_first_value_v1($json, ['url', 'upload_url', 'uploadUrl', 'href']);

                if ($uploadUrl !== '') break;
            }
        }

        if ($uploadUrl === '') {
            return ['status' => 0, 'error' => 'MAX upload URL not received', 'response' => null];
        }

        $uploadResult = telegram_max_upload_multipart_v1($uploadUrl, $path, $fileName, $mimeType);
        $uploadStatus = (int)($uploadResult['status'] ?? 0);

        if ($uploadStatus < 200 || $uploadStatus >= 300) {
            $uploadResult = telegram_max_upload_multipart_v1($uploadUrl, $path, $fileName, $mimeType, $headers);
            $uploadStatus = (int)($uploadResult['status'] ?? 0);
        }

        if ($uploadStatus < 200 || $uploadStatus >= 300) {
            return ['status' => $uploadStatus, 'error' => 'MAX file upload failed: ' . ($uploadResult['error'] ?? ''), 'response' => $uploadResult['response'] ?? null];
        }

        $uploadJson = json_decode((string)($uploadResult['response'] ?? ''), true);
        $fileToken = telegram_max_find_first_value_v1($uploadJson, ['token', 'file_token', 'attachment_token']);

        if ($fileToken === '') {
            return ['status' => 0, 'error' => 'MAX file token not found after upload', 'response' => $uploadResult['response'] ?? null];
        }

        $caption = trim($caption);
        if ($caption === '') {
            $caption = 'Направляем файл.';
        }

        // Для отправки файла используем тот же принцип, что и для обычного текста:
        // сообщение пользователю отправляется через user_id, не через chat_id.
        // В payload передаём JSON, полученный после загрузки файла в MAX.
        $payloadFromUpload = is_array($uploadJson) ? $uploadJson : [];
        if (!isset($payloadFromUpload['token']) || trim((string)$payloadFromUpload['token']) === '') {
            $payloadFromUpload['token'] = $fileToken;
        }

        $payload = [
            'text' => $caption,
            'attachments' => [
                [
                    'type' => 'file',
                    'payload' => $payloadFromUpload,
                ],
            ],
        ];

        $url = $apiBase . '/messages?user_id=' . rawurlencode($maxUserId);
        $last = ['status' => 0, 'error' => 'MAX send file attempts not executed', 'response' => null];

        // MAX может обрабатывать файл несколько секунд после загрузки.
        foreach ([0, 2, 5, 10] as $delaySeconds) {
            if ($delaySeconds > 0) {
                sleep($delaySeconds);
            }

            $result = telegram_fast_post_json($url, $payload, $headers);
            $last = $result;
            $status = (int)($result['status'] ?? 0);
            $responseText = (string)($result['response'] ?? '');

            bot_log('telegram_max_send_file_attempt_v1', [
                'url' => bot_mask_url($url),
                'file_name' => $fileName,
                'delay_seconds' => $delaySeconds,
                'status' => $status,
                'error' => $result['error'] ?? '',
                'response' => $responseText,
            ]);

            if ($status >= 200 && $status < 300) {
                return $result;
            }

            if (!str_contains($responseText, 'attachment.not.ready')
                && !str_contains($responseText, 'file.not.processed')
                && !str_contains($responseText, 'not.ready')) {
                break;
            }
        }

        return $last;
    }
}

if (!function_exists('telegram_send_attached_file_to_max_from_update_v1')) {
    function telegram_send_attached_file_to_max_from_update_v1(array $config, array $update, string $maxUserId, string $caption = ''): array
    {
        $file = telegram_extract_file_for_max_v1($update);

        if (!$file || trim((string)($file['file_id'] ?? '')) === '') {
            return ['status' => 0, 'error' => 'No Telegram file found in message', 'response' => null];
        }

        $download = telegram_download_telegram_file_for_max_v1(
            $config,
            (string)$file['file_id'],
            (string)$file['file_name']
        );

        if (empty($download['ok'])) {
            return ['status' => 0, 'error' => (string)($download['error'] ?? 'Telegram download failed'), 'response' => null];
        }

        $localPath = (string)$download['path'];
        $fileName = (string)($download['file_name'] ?? $file['file_name']);
        $mimeType = (string)($file['mime_type'] ?? 'application/octet-stream');

        $result = telegram_max_send_file_native_v1($config, $maxUserId, $localPath, $fileName, $mimeType, $caption);

        if (is_file($localPath)) {
            @unlink($localPath);
        }

        return $result;
    }
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


    if (preg_match('/^close_client\|(telegram|max)\|(-?\d+)$/', $callbackData, $closeMatch)) {
        $source = $closeMatch[1];
        $clientId = $closeMatch[2];

        telegram_close_operator_chat_by_button_v1($config, $source, $clientId, $operatorId);

        $notifyCloseResult = telegram_notify_client_chat_closed_v1($config, $source, $clientId);
        bot_log('telegram_close_button_notify_client', [
            'source' => $source,
            'client_id' => $clientId,
            'status' => $notifyCloseResult['status'] ?? 0,
            'error' => $notifyCloseResult['error'] ?? '',
            'response' => $notifyCloseResult['response'] ?? null,
        ]);

        telegram_answer_callback_fast_v1($callbackId, 'Чат закрыт');

        $telegramLeadsChatIdClose = trim((string)($config['telegram_leads_chat_id'] ?? ''));
        if ($telegramLeadsChatIdClose === '') {
            $telegramLeadsChatIdClose = trim((string)($config['telegram_admin_chat_id'] ?? ''));
        }

        $sourceLabel = $source === 'max' ? 'MAX' : 'Telegram';

        if ($telegramLeadsChatIdClose !== '') {
            telegram_api($config, 'sendMessage', [
                'chat_id' => $telegramLeadsChatIdClose,
                'text' => "✅ Live-чат с клиентом {$sourceLabel} {$clientId} закрыт.\n\nБот снова может отвечать клиенту автоматически.",
                'disable_web_page_preview' => true,
                'reply_markup' => [
                    'inline_keyboard' => [
                        [
                            [
                                'text' => '💬 Ответить клиенту',
                                'callback_data' => 'reply_client|' . $source . '|' . $clientId,
                            ],
                        ],
                    ],
                ],
            ]);
        }

        bot_ok();
        exit;
    }

    if (preg_match('/^reply_client\|(telegram|max)\|(-?\d+)$/', $callbackData, $cbMatch)) {
        $source = $cbMatch[1];
        $clientId = $cbMatch[2];

        // Answer callback so Telegram stops the button loading animation.
        telegram_answer_callback_fast_v1($callbackId, 'Оператор подключён');

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
            telegram_api($config, 'sendMessage', [
                'chat_id' => $telegramLeadsChatIdEarly,
                'text' => "💬 Оператор подключён к клиенту {$sourceLabel} {$clientId}.\n\nМожно писать клиенту обычным сообщением в этой группе. Команда /to остаётся запасным вариантом.\n\nЧтобы завершить live-чат, нажмите кнопку ниже.",
                'disable_web_page_preview' => true,
                'reply_markup' => [
                    'inline_keyboard' => [
                        [
                            [
                                'text' => '✅ Завершить чат',
                                'callback_data' => 'close_client|' . $source . '|' . $clientId,
                            ],
                        ],
                    ],
                ],
            ]);
        }

        telegram_maybe_send_operator_intro($config, $source, $clientId);

        bot_ok();
        exit;
    }

    telegram_answer_callback_fast_v1($callbackId, 'Кнопка не распознана');

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



// Send attached Telegram file to MAX by caption:
// /max 64541293
// /max 64541293 Текст к файлу
$telegramLeadsChatIdFileToMax = trim((string)($config['telegram_leads_chat_id'] ?? ''));
if ($telegramLeadsChatIdFileToMax === '') {
    $telegramLeadsChatIdFileToMax = trim((string)($config['telegram_admin_chat_id'] ?? ''));
}

if ($telegramLeadsChatIdFileToMax !== ''
    && (string)$chatId === (string)$telegramLeadsChatIdFileToMax
    && $hasClientMedia
    && preg_match('/^\/(?:max|replymax)(?:@[A-Za-z0-9_]+)?\s+(-?\d+)(?:\s+(.+))?$/us', $trimmedText, $fileMaxMatches)
) {
    $maxUserIdForFile = trim((string)$fileMaxMatches[1]);
    $captionForMaxFile = trim((string)($fileMaxMatches[2] ?? ''));

    telegram_reply_via_webhook((string)$chatId, "Отправляю файл клиенту в MAX user ID {$maxUserIdForFile}…");

    $fileSendResult = telegram_send_attached_file_to_max_from_update_v1($config, $update, $maxUserIdForFile, $captionForMaxFile);
    $fileSendStatus = (int)($fileSendResult['status'] ?? 0);

    bot_log('telegram_max_file_command_result_v1', [
        'max_user_id' => $maxUserIdForFile,
        'status' => $fileSendStatus,
        'error' => $fileSendResult['error'] ?? '',
        'response' => $fileSendResult['response'] ?? null,
    ]);

    if ($fileSendStatus >= 200 && $fileSendStatus < 300) {
        telegram_send_message($config, (string)$chatId, "✅ Файл отправлен клиенту в MAX user ID {$maxUserIdForFile}.");
    } else {
        $detailsFile = trim((string)($fileSendResult['error'] ?? ''));
        if ($detailsFile === '') {
            $detailsFile = trim((string)($fileSendResult['response'] ?? ''));
        }

        telegram_send_message(
            $config,
            (string)$chatId,
            "❌ Не удалось отправить файл в MAX user ID {$maxUserIdForFile}.\n" . mb_substr($detailsFile, 0, 900)
        );
    }

    exit;
}


// Plain operator live-chat messages.
// After operator pressed "💬 Ответить клиенту", ordinary group messages from this operator
// are sent to the active client without typing /to.
$telegramLeadsChatIdPlainChat = trim((string)($config['telegram_leads_chat_id'] ?? ''));
if ($telegramLeadsChatIdPlainChat === '') {
    $telegramLeadsChatIdPlainChat = trim((string)($config['telegram_admin_chat_id'] ?? ''));
}

if ($telegramLeadsChatIdPlainChat !== ''
    && (string)$chatId === (string)$telegramLeadsChatIdPlainChat
    && isset($update['message'])
    && is_array($update['message'])
) {
    $fromPlain = $update['message']['from'] ?? [];
    $operatorIdPlain = trim((string)($fromPlain['id'] ?? ''));
    $isBotPlain = !empty($fromPlain['is_bot']);

    $operatorsDirPlain = __DIR__ . '/sessions/operators';
    $operatorStateFilePlain = $operatorIdPlain !== ''
        ? $operatorsDirPlain . '/' . hash('sha256', $operatorIdPlain) . '.json'
        : '';

    if (!$isBotPlain && $operatorStateFilePlain !== '' && is_file($operatorStateFilePlain)) {
        $rawStatePlain = file_get_contents($operatorStateFilePlain);
        $statePlain = is_string($rawStatePlain) ? json_decode($rawStatePlain, true) : null;

        if (is_array($statePlain)) {
            $sourcePlain = trim((string)($statePlain['source'] ?? ''));
            $clientIdPlain = trim((string)($statePlain['client_chat_id'] ?? ''));

            // Команды не отправляем как обычный текст.
            if ($trimmedText !== '' && !str_starts_with($trimmedText, '/')) {
                if ($sourcePlain === 'telegram') {
                    $resultPlain = telegram_send_message($config, $clientIdPlain, $trimmedText);
                } else {
                    $resultPlain = telegram_max_send_message_fast($config, $clientIdPlain, $trimmedText);
                }

                $statusPlain = (int)($resultPlain['status'] ?? 0);

                bot_log('telegram_plain_operator_chat_send', [
                    'operator_id' => $operatorIdPlain,
                    'source' => $sourcePlain,
                    'client_id' => $clientIdPlain,
                    'text' => $trimmedText,
                    'status' => $statusPlain,
                    'error' => $resultPlain['error'] ?? '',
                    'response' => $resultPlain['response'] ?? null,
                ]);

                if ($statusPlain < 200 || $statusPlain >= 300) {
                    $detailsPlain = trim((string)($resultPlain['error'] ?? ''));
                    if ($detailsPlain === '') {
                        $detailsPlain = trim((string)($resultPlain['response'] ?? ''));
                    }

                    telegram_send_message(
                        $config,
                        (string)$chatId,
                        "❌ Не удалось отправить клиенту. Статус: {$statusPlain}.\n" . mb_substr($detailsPlain, 0, 700)
                    );
                }

                bot_ok();
                if (function_exists('fastcgi_finish_request')) {
                    fastcgi_finish_request();
                }
                exit;
            }
        }
    }
}




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

        if (!empty($sourceTo) && !empty($clientIdTo)) {
            $notifyCloseResult = telegram_notify_client_chat_closed_v1($config, $sourceTo, $clientIdTo);
            bot_log('telegram_close_command_notify_client', [
                'source' => $sourceTo,
                'client_id' => $clientIdTo,
                'status' => $notifyCloseResult['status'] ?? 0,
                'error' => $notifyCloseResult['error'] ?? '',
                'response' => $notifyCloseResult['response'] ?? null,
            ]);
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
