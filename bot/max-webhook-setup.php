<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

$config = bot_load_config();

header('Content-Type: application/json; charset=UTF-8');

$setupKey = trim((string)($config['max_setup_key'] ?? ''));
$providedKey = trim((string)($_GET['key'] ?? ''));
$action = trim((string)($_GET['action'] ?? 'status'));

if ($setupKey === '') {
    http_response_code(403);
    echo json_encode([
        'ok' => false,
        'error' => 'max_setup_key is missing in bot/config.php',
        'fix' => "Add 'max_setup_key' => 'your_private_setup_key', to bot/config.php",
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (!hash_equals($setupKey, $providedKey)) {
    http_response_code(403);
    echo json_encode([
        'ok' => false,
        'error' => 'Invalid setup key',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$token = trim((string)($config['max_bot_token'] ?? ''));
if ($token === '' || str_contains($token, 'PASTE_')) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'max_bot_token is missing in bot/config.php',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$apiBase = rtrim((string)($config['max_api_base'] ?? 'https://botapi.tamtam.chat'), '/');
$subscriptionUrl = $apiBase . '/subscriptions?access_token=' . rawurlencode($token);
$webhookUrl = (string)($config['max_webhook_url'] ?? 'https://aateam.ru/bot/max.php');

function max_setup_http(string $method, string $url, ?array $payload = null): array
{
    $ch = curl_init($url);
    $headers = ['Accept: application/json'];

    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
    ];

    if ($payload !== null) {
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $options[CURLOPT_POSTFIELDS] = $body === false ? '{}' : $body;
        $options[CURLOPT_HTTPHEADER] = array_merge($headers, ['Content-Type: application/json']);
    }

    curl_setopt_array($ch, $options);
    $response = curl_exec($ch);
    $error = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode((string)$response, true);

    return [
        'status' => $status,
        'error' => $error,
        'response' => $decoded ?? $response,
    ];
}

if ($action === 'set') {
    $result = max_setup_http('POST', $subscriptionUrl, [
        'url' => $webhookUrl,
        'update_types' => ['message_created'],
    ]);

    bot_log('max_webhook_setup_set', [
        'status' => $result['status'],
        'error' => $result['error'],
        'response' => $result['response'],
        'webhook_url' => $webhookUrl,
    ]);

    echo json_encode([
        'ok' => $result['status'] >= 200 && $result['status'] < 300,
        'action' => 'set',
        'webhook_url' => $webhookUrl,
        'api_status' => $result['status'],
        'api_error' => $result['error'],
        'api_response' => $result['response'],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$result = max_setup_http('GET', $subscriptionUrl);

bot_log('max_webhook_setup_status', [
    'status' => $result['status'],
    'error' => $result['error'],
    'response' => $result['response'],
]);

echo json_encode([
    'ok' => $result['status'] >= 200 && $result['status'] < 300,
    'action' => 'status',
    'expected_webhook_url' => $webhookUrl,
    'api_status' => $result['status'],
    'api_error' => $result['error'],
    'api_response' => $result['response'],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
