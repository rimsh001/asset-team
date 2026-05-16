<?php

declare(strict_types=1);

function bot_load_config(): array
{
    $configPath = __DIR__ . '/config.php';
    if (!file_exists($configPath)) {
        http_response_code(500);
        echo 'Bot config.php is missing. Copy config.php.example to config.php on the server and fill tokens.';
        exit;
    }

    $config = require $configPath;
    if (!is_array($config)) {
        http_response_code(500);
        echo 'Bot config.php must return an array.';
        exit;
    }

    return $config;
}

function bot_read_json(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        $data = [];
    }

    bot_log('incoming', [
        'uri' => $_SERVER['REQUEST_URI'] ?? '',
        'method' => $_SERVER['REQUEST_METHOD'] ?? '',
        'raw' => $raw,
        'json' => $data,
    ]);

    return $data;
}

function bot_log(string $name, array $payload): void
{
    $dir = __DIR__ . '/logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    $line = json_encode([
        'time' => date('c'),
        'name' => $name,
        'payload' => $payload,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($line !== false) {
        @file_put_contents($dir . '/bot.log', $line . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}

function bot_http_post_json(string $url, array $payload, array $headers = []): array
{
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        $body = '{}';
    }

    $defaultHeaders = [
        'Content-Type: application/json',
        'Accept: application/json',
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_HTTPHEADER => array_merge($defaultHeaders, $headers),
        CURLOPT_POSTFIELDS => $body,
    ]);

    $response = curl_exec($ch);
    $error = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = [
        'status' => $status,
        'error' => $error,
        'response' => $response,
    ];

    bot_log('http_post_json', [
        'url' => preg_replace('/access_token=[^&]+/', 'access_token=***', $url),
        'status' => $status,
        'error' => $error,
        'response' => $response,
    ]);

    return $result;
}

function bot_text_for_start(): string
{
    return "Здравствуйте. Вы обратились в A&A Asset Team.\n\n" .
        "Мы помогаем собственникам и компаниям реализовывать зависшие и непрофильные активы бизнеса: базы, склады, коммерческую недвижимость, оборудование, спецтехнику, складские остатки и ТМЦ.\n\n" .
        "Напишите в ответ:\n" .
        "1. Что нужно реализовать\n" .
        "2. Город / регион\n" .
        "3. Ориентировочную цену\n" .
        "4. Есть ли ссылка на объявление, фото или документы\n\n" .
        "После этого мы посмотрим ситуацию и подскажем следующий шаг.";
}

function bot_text_for_received(): string
{
    return "Спасибо, получили сообщение.\n\n" .
        "Если это заявка на разбор актива, добавьте, пожалуйста:\n" .
        "— тип актива;\n" .
        "— регион;\n" .
        "— цену;\n" .
        "— ссылку на объявление / фото / документы;\n" .
        "— удобный контакт для связи.\n\n" .
        "Мы вернёмся с ответом после первичного просмотра.";
}

function bot_format_admin_notice(string $source, ?string $chatId, ?string $userName, string $text, array $raw): string
{
    $userLine = $userName ? "Пользователь: {$userName}\n" : '';
    $chatLine = $chatId ? "Chat ID: {$chatId}\n" : '';

    return "Новая заявка / сообщение из {$source}\n\n" .
        $userLine .
        $chatLine .
        "Текст:\n{$text}\n\n" .
        "Время: " . date('d.m.Y H:i:s') . "\n";
}

function bot_send_email(array $config, string $subject, string $body): void
{
    $to = trim((string)($config['lead_email'] ?? ''));
    if ($to === '') {
        return;
    }

    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: A&A Asset Team <info@aateam.ru>',
    ];

    @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\r\n", $headers));
}

function telegram_api(array $config, string $method, array $payload): array
{
    $token = trim((string)($config['telegram_bot_token'] ?? ''));
    if ($token === '' || str_contains($token, 'PASTE_')) {
        bot_log('telegram_missing_token', []);
        return ['status' => 0, 'error' => 'Missing Telegram token', 'response' => null];
    }

    return bot_http_post_json("https://api.telegram.org/bot{$token}/{$method}", $payload);
}

function telegram_send_message(array $config, string $chatId, string $text): array
{
    return telegram_api($config, 'sendMessage', [
        'chat_id' => $chatId,
        'text' => $text,
        'disable_web_page_preview' => true,
    ]);
}

function telegram_extract_message(array $update): array
{
    $message = $update['message'] ?? $update['edited_message'] ?? $update['callback_query']['message'] ?? [];
    $from = $update['message']['from'] ?? $update['callback_query']['from'] ?? [];
    $text = (string)($update['message']['text'] ?? $update['callback_query']['data'] ?? '');
    $chatId = isset($message['chat']['id']) ? (string)$message['chat']['id'] : null;

    $nameParts = array_filter([
        $from['first_name'] ?? '',
        $from['last_name'] ?? '',
        isset($from['username']) ? '@' . $from['username'] : '',
    ]);

    return [
        'chat_id' => $chatId,
        'text' => trim($text),
        'user_name' => trim(implode(' ', $nameParts)) ?: null,
    ];
}

function max_send_message(array $config, string $chatId, string $text): array
{
    $token = trim((string)($config['max_bot_token'] ?? ''));
    if ($token === '' || str_contains($token, 'PASTE_')) {
        bot_log('max_missing_token', []);
        return ['status' => 0, 'error' => 'Missing MAX token', 'response' => null];
    }

    $template = (string)($config['max_send_message_url_template'] ?? '');
    if ($template === '') {
        bot_log('max_missing_url_template', []);
        return ['status' => 0, 'error' => 'Missing MAX send message URL template', 'response' => null];
    }

    $url = str_replace(
        ['{token}', '{chat_id}'],
        [rawurlencode($token), rawurlencode($chatId)],
        $template
    );

    return bot_http_post_json($url, ['text' => $text]);
}

function max_extract_message(array $update): array
{
    $text = '';
    $chatId = null;
    $userName = null;

    if (isset($update['message']) && is_array($update['message'])) {
        $message = $update['message'];
        $text = (string)($message['body']['text'] ?? $message['text'] ?? '');
        $chatId = isset($message['recipient']['chat_id']) ? (string)$message['recipient']['chat_id'] : $chatId;
        $chatId = isset($message['chat_id']) ? (string)$message['chat_id'] : $chatId;
        $chatId = isset($message['chat']['id']) ? (string)$message['chat']['id'] : $chatId;

        if (isset($message['sender']) && is_array($message['sender'])) {
            $sender = $message['sender'];
            $userName = trim((string)($sender['name'] ?? $sender['username'] ?? $sender['user_id'] ?? '')) ?: null;
        }
    }

    $text = $text !== '' ? $text : (string)($update['text'] ?? $update['body']['text'] ?? '');
    $chatId = $chatId ?: (isset($update['chat_id']) ? (string)$update['chat_id'] : null);
    $chatId = $chatId ?: (isset($update['chat']['id']) ? (string)$update['chat']['id'] : null);
    $chatId = $chatId ?: (isset($update['recipient']['chat_id']) ? (string)$update['recipient']['chat_id'] : null);

    return [
        'chat_id' => $chatId,
        'text' => trim($text),
        'user_name' => $userName,
    ];
}

function bot_ok(): void
{
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
