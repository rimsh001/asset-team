<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

function max_finish_webhook(): void
{
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
        return;
    }

    if (ob_get_level() > 0) {
        @ob_flush();
    }

    @flush();
}

function max_find_first_value(array $data, array $keys): ?string
{
    foreach ($data as $key => $value) {
        if (in_array((string)$key, $keys, true) && is_scalar($value) && trim((string)$value) !== '') {
            return trim((string)$value);
        }
        if (is_array($value)) {
            $found = max_find_first_value($value, $keys);
            if ($found !== null) return $found;
        }
    }
    return null;
}

function max_extract_sender_user_id(array $update): ?string
{
    $paths = [
        ['message', 'sender', 'user_id'],
        ['message', 'sender', 'id'],
        ['sender', 'user_id'],
        ['sender', 'id'],
        ['user', 'user_id'],
        ['user', 'id'],
    ];

    foreach ($paths as $path) {
        $value = $update;
        foreach ($path as $key) {
            if (!is_array($value) || !array_key_exists($key, $value)) {
                $value = null;
                break;
            }
            $value = $value[$key];
        }
        if (is_scalar($value) && trim((string)$value) !== '') return trim((string)$value);
    }

    return max_find_first_value($update, ['user_id', 'sender_id', 'from_id']);
}


function max_extract_message_unique_id(array $update): string
{
    $paths = [
        ['message', 'body', 'mid'],
        ['message', 'body', 'seq'],
        ['message', 'mid'],
        ['body', 'mid'],
        ['mid'],
        ['message', 'timestamp'],
    ];

    foreach ($paths as $path) {
        $value = $update;
        foreach ($path as $key) {
            if (!is_array($value) || !array_key_exists($key, $value)) {
                $value = null;
                break;
            }
            $value = $value[$key];
        }

        if (is_scalar($value) && trim((string)$value) !== '') {
            return trim((string)$value);
        }
    }

    return '';
}



function max_collect_urls_from_value($value, array &$urls): void
{
    if (is_string($value)) {
        if (preg_match_all('/https?:\/\/[^\s"\']+/ui', $value, $matches)) {
            foreach ($matches[0] as $url) $urls[] = rtrim($url, ".,;)]");
        }
        return;
    }

    if (is_array($value)) {
        foreach ($value as $child) max_collect_urls_from_value($child, $urls);
    }
}

function max_collect_attachments(array $data): array
{
    $items = [];

    foreach ($data as $key => $value) {
        if ((string)$key === 'attachments' && is_array($value)) {
            foreach ($value as $item) {
                if (is_array($item)) $items[] = $item;
            }
        }

        if (is_array($value)) {
            foreach (max_collect_attachments($value) as $item) $items[] = $item;
        }
    }

    return $items;
}

function max_attachment_label(array $attachment): string
{
    $type = trim((string)($attachment['type'] ?? $attachment['attachment_type'] ?? 'вложение'));
    $name = trim((string)($attachment['name'] ?? $attachment['filename'] ?? $attachment['file_name'] ?? ''));

    $urls = [];
    max_collect_urls_from_value($attachment, $urls);
    $urls = array_values(array_unique($urls));

    $line = $type !== '' ? $type : 'вложение';
    if ($name !== '') $line .= ': ' . $name;
    if ($urls) $line .= ' — ' . implode(' ', array_slice($urls, 0, 3));

    return $line;
}

function max_extract_attachment_lines(array $update): array
{
    $attachments = max_collect_attachments($update);
    $lines = [];

    foreach ($attachments as $attachment) {
        $line = max_attachment_label($attachment);
        if (trim($line) !== '') $lines[] = $line;
    }

    return array_values(array_unique($lines));
}

function max_update_has_attachments(array $update): bool
{
    return count(max_extract_attachment_lines($update)) > 0;
}


function max_normalize(string $text): string
{
    return str_replace('ё', 'е', mb_strtolower($text, 'UTF-8'));
}

function max_default_session(): array
{
    return [
        'lead' => [],
        'messages' => [],
        'early_notice_sent' => false,
        'full_notice_sent' => false,
        'notified_fields' => [],
        'last_notice_hash' => '',
        'created_at' => date('c'),
        'updated_at' => date('c'),
    ];
}

function max_session_path(string $chatId): string
{
    $dir = __DIR__ . '/sessions/max';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    return $dir . '/' . hash('sha256', $chatId) . '.json';
}

function max_load_session(string $chatId): array
{
    $path = max_session_path($chatId);
    if (!is_file($path)) return max_default_session();

    $raw = file_get_contents($path);
    $data = is_string($raw) ? json_decode($raw, true) : null;
    return is_array($data) ? array_replace_recursive(max_default_session(), $data) : max_default_session();
}

function max_save_session(string $chatId, array $session): void
{
    $session['updated_at'] = date('c');
    @file_put_contents(max_session_path($chatId), json_encode($session, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
}

function max_add_client_message(array $session, string $text): array
{
    $messages = is_array($session['messages'] ?? null) ? $session['messages'] : [];
    $messages[] = ['role' => 'client', 'text' => $text, 'at' => date('c')];
    $session['messages'] = array_slice($messages, -20);
    return $session;
}

function max_detect_asset_type(string $text): string
{
    $t = max_normalize($text);
    if (preg_match('/производствен|промышленн|\bбаз[ауы]?\b/u', $t)) return 'производственная база';
    if (preg_match('/склад|ангар/u', $t)) return 'склад / ангар';
    if (preg_match('/земл|участ/u', $t)) return 'земельный участок';
    if (preg_match('/оборуд|станок|линия/u', $t)) return 'оборудование';
    if (preg_match('/спецтех|погруз|кран|экскават|трактор|авто/u', $t)) return 'спецтехника';
    if (preg_match('/складск.*остат|остатк|партия товара/u', $t)) return 'складские остатки / ТМЦ';
    if (preg_match('/неликвид|тмц/u', $t)) return 'неликвидные ТМЦ';
    if (preg_match('/помещен|недвиж|торговая площад|коммерческ/u', $t)) return 'коммерческая недвижимость';
    if (preg_match('/имуществ.*закрыт|закрытие направления|активы после/u', $t)) return 'имущество после закрытия направления';
    return '';
}

function max_pick_first_match(string $text, string $pattern): string
{
    return preg_match($pattern, $text, $m) ? trim((string)$m[0]) : '';
}

function max_extract_url(string $text): string
{
    if (!preg_match('/https?:\/\/\S+/ui', $text, $m)) return '';
    return rtrim($m[0], " \t\n\r\0\x0B.,;)]");
}

function max_extract_area(string $text): string
{
    $areas = [];
    if (preg_match_all('/\b\d+[\d\s]*(?:[,.]\d+)?\s*(?:м2|м²|кв\.?\s*м|сотк(?:а|и|ок)?|сот|га|гектар(?:а|ов)?)\b/ui', $text, $matches)) {
        foreach ($matches[0] as $area) $areas[] = trim(preg_replace('/\s+/u', ' ', $area) ?? $area);
    }
    if (preg_match('/(?:ploschad|площад)[^\d]{0,20}(\d{2,7})[_\s-]?m(?:_|\b)/ui', $text, $m)) {
        $areas[] = $m[1] . ' м² (из ссылки)';
    } elseif (preg_match('/_(\d{3,7})_m(?:_|\b)/i', $text, $m)) {
        $areas[] = $m[1] . ' м² (из ссылки)';
    }
    return implode(', ', array_values(array_unique(array_filter($areas))));
}

function max_extract_price(string $text): string
{
    return max_pick_first_match($text, '/\b\d+[\d\s]*(?:[,.]\d+)?\s*(?:млн|миллион(?:а|ов)?|тыс|руб(?:\.|лей|ля|ль)?|₽|р\b)/ui');
}

function max_extract_selling_period(string $text): string
{
    return max_pick_first_match($text, '/(?:\b\d+\s*(?:дн(?:я|ей)?|недел(?:я|и|ь)?|месяц(?:а|ев)?|год(?:а)?|лет)\b|полгода|с\s+\d{4}\s*г(?:ода)?)/ui');
}

function max_extract_contact(string $text): string
{
    $contacts = [];
    if (preg_match('/(?:\+7|7|8)\D{0,3}\(?\d{3}\)?\D{0,3}\d{3}\D{0,3}\d{2}\D{0,3}\d{2}/u', $text, $m)) $contacts[] = trim($m[0]);
    if (preg_match('/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/u', $text, $m)) $contacts[] = trim($m[0]);
    if (preg_match('/@[a-zA-Z0-9_]{4,}/u', $text, $m)) $contacts[] = trim($m[0]);
    return implode(', ', array_values(array_unique($contacts)));
}

function max_extract_location(string $text): string
{
    $t = max_normalize($text);
    $parts = [];
    if (preg_match('/\bмо\b|московск(?:ая|ой)\s+обл/u', $t)) $parts[] = 'МО';
    if (preg_match('/(?:деревня|д\.|село|с\.|пос[её]лок|п\.|пгт|город|г\.)\s+([А-ЯЁA-Z][А-ЯЁа-яёA-Za-z\-]+)/u', $text, $m)) $parts[] = trim($m[0]);

    $knownLocations = [
        'мисаилово' => 'деревня Мисайлово',
        'мисайлово' => 'деревня Мисайлово',
        'видное' => 'Видное',
        'москва' => 'Москва',
        'санкт-петербург' => 'Санкт-Петербург',
        'спб' => 'Санкт-Петербург',
        'иркутск' => 'Иркутск',
        'ангарск' => 'Ангарск',
    ];
    foreach ($knownLocations as $needle => $label) if (str_contains($t, $needle)) $parts[] = $label;
    if (str_contains($t, 'avito.ru/vidnoe')) $parts[] = 'Видное';
    return implode(', ', array_values(array_unique(array_filter($parts))));
}

function max_has_negative_documents(string $text): bool
{
    $t = max_normalize($text);
    return (bool)preg_match('/(нет|без|отсутств)[^\n,.]{0,40}документ|документ(?:ов|ы)?[^\n,.]{0,40}(нет|отсутств)/u', $t);
}

function max_has_negative_materials(string $text): bool
{
    $t = max_normalize($text);
    return (bool)preg_match('/(нет|без|отсутств)[^\n,.]{0,50}(фото|ссылк|объявлен|видео)|(фото|ссылк|объявлен|видео)[^\n,.]{0,50}(нет|отсутств)/u', $t);
}

function max_extract_documents_status(string $text): string
{
    $t = max_normalize($text);
    if (max_has_negative_documents($text)) return 'документов нет / нужно уточнить';
    if (preg_match('/документ|свидетельств|выписк|кадастр|техпаспорт|право/u', $t)) return 'документы упомянуты';
    return '';
}

function max_extract_materials_status(string $text): string
{
    $t = max_normalize($text);
    $url = max_extract_url($text);
    if (max_has_negative_materials($text)) return 'фото / ссылки нет';
    if ($url !== '') return 'есть ссылка на объявление';
    if (preg_match('/фото|видео|снимк|изображен|авито|циан|объявлен/u', $t)) return 'есть фото / ссылка или объявление';
    return '';
}

function max_extract_role(string $text): string
{
    $t = max_normalize($text);
    if (preg_match('/\bсобственник\b|мой объект|моя база|мой склад/u', $t)) return 'собственник';
    if (preg_match('/представител|агент|брокер|посредник|по поручению/u', $t)) return 'представитель';
    return '';
}

function max_extract_patch(string $text): array
{
    $map = [
        'asset_type' => max_detect_asset_type($text),
        'location' => max_extract_location($text),
        'area' => max_extract_area($text),
        'price' => max_extract_price($text),
        'selling_period' => max_extract_selling_period($text),
        'url' => max_has_negative_materials($text) ? '' : max_extract_url($text),
        'contact' => max_extract_contact($text),
        'documents' => max_extract_documents_status($text),
        'materials' => max_extract_materials_status($text),
        'role' => max_extract_role($text),
    ];

    $normalized = max_normalize($text);
    if (str_contains($normalized, 'прод')) $map['goal'] = 'продажа / реализация';
    if (preg_match('/жду звонка|позвоните|свяжитесь|наберите|готов обсудить/u', $normalized)) $map['call_intent'] = 'клиент ожидает связь';

    $patch = [];
    foreach ($map as $key => $value) if (is_string($value) && trim($value) !== '') $patch[$key] = trim($value);
    return $patch;
}

function max_merge_lead(array $lead, array $patch): array
{
    foreach ($patch as $key => $value) {
        if ($value === '') continue;
        if (in_array($key, ['documents', 'materials', 'photos', 'url'], true)) {
            $lead[$key] = $value;
            continue;
        }
        if (($lead[$key] ?? '') === '') {
            $lead[$key] = $value;
            continue;
        }
        if (in_array($key, ['area', 'location', 'contact'], true) && !str_contains((string)$lead[$key], (string)$value)) {
            $lead[$key] = trim((string)$lead[$key] . ', ' . $value, ', ');
        }
    }
    return $lead;
}

function max_core_missing_fields(array $lead): array
{
    $missing = [];
    if (($lead['asset_type'] ?? '') === '') $missing[] = 'что именно продаётся';
    if (($lead['location'] ?? '') === '') $missing[] = 'где находится объект';
    if (($lead['area'] ?? '') === '') $missing[] = 'площадь / объём';
    if (($lead['price'] ?? '') === '') $missing[] = 'ориентировочная цена';
    if (($lead['selling_period'] ?? '') === '') $missing[] = 'сколько времени продаётся';
    if (($lead['role'] ?? '') === '') $missing[] = 'вы собственник или представитель';
    return $missing;
}

function max_admin_missing_fields(array $lead): array
{
    $missing = max_core_missing_fields($lead);
    if (($lead['documents'] ?? '') === '') $missing[] = 'документы не уточнены';
    if (($lead['materials'] ?? '') === '' && ($lead['url'] ?? '') === '' && ($lead['photos'] ?? '') === '') $missing[] = 'фото / ссылка не уточнены';
    return $missing;
}

function max_has_asset_context(array $lead, string $text): bool
{
    return (($lead['asset_type'] ?? '') !== '') || max_detect_asset_type($text) !== '' || max_extract_url($text) !== '';
}

function max_should_notify_early(array $lead, string $text): bool
{
    if (!max_has_asset_context($lead, $text)) return false;
    $strongSignals = array_filter([$lead['location'] ?? '', $lead['area'] ?? '', $lead['price'] ?? '', $lead['url'] ?? '']);
    return (($lead['asset_type'] ?? '') !== '') && count($strongSignals) >= 1;
}

function max_is_full_lead_ready(array $lead): bool
{
    return (($lead['asset_type'] ?? '') !== '')
        && (($lead['location'] ?? '') !== '')
        && (($lead['area'] ?? '') !== '')
        && (($lead['price'] ?? '') !== '')
        && (($lead['selling_period'] ?? '') !== '')
        && (($lead['role'] ?? '') !== '');
}

function max_compact_history(array $messages): string
{
    $clientMessages = array_values(array_filter($messages, static fn($message) => ($message['role'] ?? '') === 'client'));
    $clientMessages = array_slice($clientMessages, -5);
    if (!$clientMessages) return 'не указано';
    $lines = [];
    foreach ($clientMessages as $index => $message) $lines[] = ($index + 1) . ') ' . trim((string)($message['text'] ?? ''));
    return implode("\n", $lines);
}

function max_mark_current_fields_notified(array $session): array
{
    $notified = is_array($session['notified_fields'] ?? null) ? $session['notified_fields'] : [];
    foreach (($session['lead'] ?? []) as $key => $value) if (is_string($value) && trim($value) !== '') $notified[$key] = true;
    $session['notified_fields'] = $notified;
    return $session;
}

function max_detect_supplement_fields(array $session, array $prevLead, array $nextLead, string $text): array
{
    if (!($session['early_notice_sent'] ?? false) && !($session['full_notice_sent'] ?? false)) return [];
    $notified = is_array($session['notified_fields'] ?? null) ? $session['notified_fields'] : [];
    $fields = [];
    foreach (['asset_type', 'location', 'area', 'price', 'selling_period', 'url', 'contact', 'documents', 'materials', 'role', 'goal'] as $field) {
        $wasEmpty = trim((string)($prevLead[$field] ?? '')) === '';
        $isFilled = trim((string)($nextLead[$field] ?? '')) !== '';
        if ($wasEmpty && $isFilled && empty($notified[$field])) $fields[] = $field;
    }
    if (preg_match('/жду звонка|позвоните|свяжитесь|наберите|готов обсудить/u', max_normalize($text)) && empty($notified['call_intent'])) $fields[] = 'call_intent';
    return array_values(array_unique($fields));
}

function max_human_field(string $field): string
{
    $labels = [
        'asset_type' => 'тип актива', 'location' => 'локация', 'area' => 'площадь / объём', 'price' => 'цена',
        'selling_period' => 'срок продажи', 'url' => 'ссылка', 'contact' => 'контакт', 'documents' => 'документы',
        'materials' => 'фото / ссылка', 'photos' => 'фото / объявление', 'role' => 'роль клиента', 'goal' => 'цель обращения', 'call_intent' => 'ожидает связь',
    ];
    return $labels[$field] ?? $field;
}

function max_format_lead_summary(array $lead): string
{
    $materials = ($lead['url'] ?? '') ?: (($lead['materials'] ?? '') ?: (($lead['photos'] ?? '') ?: 'не указано'));
    return implode("\n", [
        'Тип актива: ' . (($lead['asset_type'] ?? '') ?: 'не указано'),
        'Локация: ' . (($lead['location'] ?? '') ?: 'не указано'),
        'Площадь / объём: ' . (($lead['area'] ?? '') ?: 'не указано'),
        'Цена: ' . (($lead['price'] ?? '') ?: 'не указано'),
        'Срок продажи: ' . (($lead['selling_period'] ?? '') ?: 'не указано'),
        'Фото / ссылка: ' . $materials,
        'Документы: ' . (($lead['documents'] ?? '') ?: 'не указано'),
        'Кто обратился: ' . (($lead['role'] ?? '') ?: 'не указано'),
        'Контакт: ' . (($lead['contact'] ?? '') ?: 'MAX-чат'),
    ]);
}

function max_build_client_reply(array $session, string $text): string
{
    if (!empty($session['operator_mode']) || !empty($session['bot_paused'])) return '';
    if (!empty($session['operator_mode'])) return '';
    $lead = is_array($session['lead'] ?? null) ? $session['lead'] : [];
    $missing = max_core_missing_fields($lead);

    if (preg_match('/\bаренд|сдам|сдать/u', max_normalize($text))) {
        return 'Арендой мы не занимаемся. Наш профиль — продажа и реализация сложных активов. Можем посмотреть объект с точки зрения продажи: цена, документы, упаковка, целевой покупатель и маршрут реализации.';
    }
    if (!max_has_asset_context($lead, $text)) {
        return "Здравствуйте. Чтобы запустить первичный разбор, напишите одним сообщением:\n\n1. Что продаётся / какой актив\n2. Город или регион\n3. Площадь или объём\n4. Ориентировочную цену\n5. Сколько времени продаётся\n\nДля связи достаточно этого чата в MAX.";
    }
    if (max_is_full_lead_ready($lead)) {
        if (!empty($session['full_notice_sent'])) {
            return "Спасибо, дополнил карточку объекта и передал информацию в рабочую группу A&A Asset Team.\n\nЕсли появятся ещё материалы — фото, документы, ссылка или уточнения по цене — отправьте их сюда.";
        }

        return "Спасибо. Карточку объекта собрал и передал в рабочую группу A&A Asset Team.\n\nСледующий шаг — специалист посмотрит вводные и вернётся с уточнениями по документам, материалам, цене, упаковке и маршруту реализации.";
    }

    $questionLines = [];
    foreach (array_slice($missing, 0, 3) as $index => $item) $questionLines[] = ($index + 1) . '. ' . $item . '?';
    return "Принял, уже можно начать первичный разбор. Я передал вводные в рабочую группу и продолжаю добирать карточку.\n\nУточните, пожалуйста:\n" . implode("\n", $questionLines) . "\n\nМожно ответить коротко в этом чате.";
}

function max_operator_question(string $missing): string
{
    $map = [
        'что именно продаётся' => 'что именно продаётся?',
        'где находится объект' => 'где находится объект?',
        'площадь / объём' => 'какая площадь или объём объекта?',
        'ориентировочная цена' => 'какая ориентировочная цена?',
        'сколько времени продаётся' => 'сколько времени объект продаётся?',
        'вы собственник или представитель' => 'вы собственник или представитель?',
        'документы не уточнены' => 'какие документы есть по объекту?',
        'фото / ссылка не уточнены' => 'есть ли фото, видео или ссылка на объявление?',
    ];
    return $map[$missing] ?? ($missing . '?');
}

function max_format_operator_hint(?string $chatId, array $lead): string
{
    if (!$chatId) return 'MAX user ID не найден, ответить командой /max пока нельзя.';
    $missing = max_admin_missing_fields($lead);
    $question = max_operator_question($missing[0] ?? 'документы не уточнены');
    return '/max ' . $chatId . ' Приняли заявку. Начинаем первичный разбор. Уточните, пожалуйста: ' . $question;
}

function max_format_admin_notice(string $title, array $incoming, string $text, array $update, array $session, array $extraLines = []): string
{
    $lead = is_array($session['lead'] ?? null) ? $session['lead'] : [];
    $chatId = $incoming['chat_id'] ?? null;
    $userName = $incoming['user_name'] ?? null;
    $userId = max_extract_sender_user_id($update);
    $username = max_find_first_value($update, ['username', 'login', 'nick']);
    $missing = max_admin_missing_fields($lead);

    $replyId = $userId ?: $chatId;
    $dialogChatId = max_find_first_value($update, ['chat_id']);
    if ($dialogChatId === $replyId) $dialogChatId = null;

    $lines = [$title, ''];
    if ($userName) $lines[] = 'Пользователь: ' . $userName;
    if ($username) {
        $usernameClean = ltrim($username, '@');
        $lines[] = 'MAX username: @' . $usernameClean;
        $lines[] = 'Профиль MAX: https://max.ru/' . $usernameClean;
    }
    if ($replyId) $lines[] = 'MAX user ID для ответа: ' . $replyId;
    if ($dialogChatId) $lines[] = 'MAX dialog/chat ID: ' . $dialogChatId;
    $lines[] = '';
    $lines[] = 'Карточка лида:';
    $lines[] = max_format_lead_summary($lead);
    $lines[] = '';
    $lines[] = 'Что можно уточнить дополнительно: ' . ($missing ? implode(', ', $missing) : 'ключевые поля собраны');
    if ($extraLines) {
        $lines[] = '';
        foreach ($extraLines as $line) $lines[] = $line;
    }
    $lines[] = '';
    $lines[] = 'Ответ клиенту:';
    $lines[] = 'Нажмите кнопку «💬 Ответить клиенту» под этой карточкой, затем отправляйте сообщения командой /to текст.';
    $lines[] = '';
    $lines[] = 'Текст клиента:';
    $lines[] = $text !== '' ? $text : '[без текста]';
    $lines[] = '';
    $lines[] = 'История последних сообщений:';
    $lines[] = max_compact_history(is_array($session['messages'] ?? null) ? $session['messages'] : []);
    $lines[] = '';
    $lines[] = 'Время: ' . date('d.m.Y H:i:s');
    return implode("\n", $lines);
}

function max_notice_hash(string $title, array $lead, string $text): string
{
    return hash('sha256', $title . '|' . json_encode($lead, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '|' . $text);
}


function max_send_telegram_notice_threaded(array $config, string $telegramLeadsChatId, string $notice, array &$session): void
{
    $threadMessageId = (int)($session['telegram_thread_message_id'] ?? 0);

    $clientIdForButton = trim((string)($session['client_chat_id'] ?? ''));
    $payload = [
        'chat_id' => $telegramLeadsChatId,
        'text' => $notice,
        'disable_web_page_preview' => true,
    ];

    if ($clientIdForButton !== '') {
        $payload['reply_markup'] = [
            'inline_keyboard' => [
                [
                    [
                        'text' => '💬 Ответить клиенту',
                        'callback_data' => 'reply_client|max|' . $clientIdForButton,
                    ],
                ],
            ],
        ];
    }

    if ($threadMessageId > 0) {
        $payload['reply_to_message_id'] = $threadMessageId;
        $payload['allow_sending_without_reply'] = true;
    }

    $result = telegram_api($config, 'sendMessage', $payload);

    bot_log('max_telegram_notice_threaded', [
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
}


function max_notify_manager_if_needed(array $config, string $telegramLeadsChatId, array $incoming, string $text, array $update, array &$session, array $prevLead): void
{
    if ($telegramLeadsChatId === '' || str_contains($telegramLeadsChatId, 'PASTE_')) return;
    $lead = is_array($session['lead'] ?? null) ? $session['lead'] : [];
    $title = null;
    $extra = [];
    $attachmentLines = max_extract_attachment_lines($update);
    if ($attachmentLines) {
        $extra[] = 'Вложения клиента:';
        foreach ($attachmentLines as $line) $extra[] = '- ' . $line;
    }

    if (!empty($session['operator_mode']) || !empty($session['bot_paused'])) {
        $title = '💬 СООБЩЕНИЕ КЛИЕНТА ИЗ MAX';
        $extra[] = 'Режим live-чата: оператор подключён.';
    } elseif (max_is_full_lead_ready($lead) && !($session['full_notice_sent'] ?? false)) {
        $title = '✅ ПОЛНАЯ ЗАЯВКА ИЗ MAX';
        $session['full_notice_sent'] = true;
        $session['early_notice_sent'] = true;
    } elseif (max_should_notify_early($lead, $text) && !($session['early_notice_sent'] ?? false)) {
        $title = '🟡 РАННИЙ ЛИД ИЗ MAX';
        $extra[] = 'Статус: клиент обозначил актив, бот продолжает добирать основные поля карточки.';
        $session['early_notice_sent'] = true;
    } else {
        $fields = max_detect_supplement_fields($session, $prevLead, $lead, $text);
        if ($fields || $attachmentLines) {
            $title = '📎 ДОПОЛНЕНИЕ К ЗАЯВКЕ ИЗ MAX';
            if ($fields) {
                $extra[] = 'Новые данные: ' . implode(', ', array_map('max_human_field', $fields));
                foreach ($fields as $field) $session['notified_fields'][$field] = true;
            }
        }
    }
    if ($title === null) return;
    $hash = max_notice_hash($title, $lead, $text);
    if (($session['last_notice_hash'] ?? '') === $hash) return;
    max_send_telegram_notice_threaded($config, $telegramLeadsChatId, max_format_admin_notice($title, $incoming, $text, $update, $session, $extra), $session);
    $session['last_notice_hash'] = $hash;
    $session = max_mark_current_fields_notified($session);
}

function max_parse_operator_command(string $text): ?array
{
    if (!preg_match('/^\/(?:max|replymax)(?:@[A-Za-z0-9_]+)?\s+(-?\d+)\s+(.+)$/us', trim($text), $matches)) return null;
    $clientChatId = trim($matches[1]);
    $message = trim($matches[2]);
    if ($clientChatId === '' || $message === '') return null;
    return ['chat_id' => $clientChatId, 'message' => $message];
}

function max_is_operator_chat(array $config, ?string $chatId): bool
{
    $adminChatId = trim((string)($config['max_admin_chat_id'] ?? ''));
    return $adminChatId !== '' && !str_contains($adminChatId, 'PASTE_') && $chatId !== null && (string)$chatId === $adminChatId;
}

function max_handle_operator_command(array $config, string $operatorChatId, array $command): void
{
    max_finish_webhook();
    $result = max_send_message($config, $command['chat_id'], $command['message']);
    $status = (int)($result['status'] ?? 0);
    if ($status >= 200 && $status < 300) {
        max_send_message($config, $operatorChatId, 'Ответ отправлен клиенту в MAX чат ' . $command['chat_id'] . '.');
        return;
    }
    max_send_message($config, $operatorChatId, 'Не удалось отправить ответ клиенту в MAX чат ' . $command['chat_id'] . '. Статус: ' . $status . '. Проверьте bot/logs/bot.log.');
}

$config = bot_load_config();

$secret = trim((string)($config['max_webhook_secret'] ?? ''));
if ($secret !== '') {
    $headerSecret = $_SERVER['HTTP_X_MAX_WEBHOOK_SECRET'] ?? $_SERVER['HTTP_X_BOT_WEBHOOK_SECRET'] ?? $_SERVER['HTTP_X_WEBHOOK_SECRET'] ?? '';
    if (!hash_equals($secret, (string)$headerSecret)) {
        bot_log('max_invalid_secret', ['received' => $headerSecret ? 'present' : 'missing']);
        http_response_code(403);
        max_finish_webhook();
        exit;
    }
}

$update = bot_read_json();
$incoming = max_extract_message($update);
$chatId = $incoming['chat_id'];
$text = $incoming['text'];

if ($chatId === null || $chatId === '') {
    bot_log('max_missing_chat_id', ['update' => $update, 'note' => 'MAX webhook payload format may differ.']);
    max_finish_webhook();
    exit;
}

$operatorCommand = max_parse_operator_command($text);
if ($operatorCommand && max_is_operator_chat($config, $chatId)) {
    max_handle_operator_command($config, $chatId, $operatorCommand);
    exit;
}

$normalizedText = max_normalize(trim($text));
if ($normalizedText === '/start' || $normalizedText === 'start' || $normalizedText === 'начать' || $normalizedText === '') {
    $session = max_default_session();
    max_save_session($chatId, $session);
    max_finish_webhook();
    max_send_message($config, $chatId, bot_text_for_start());
    exit;
}

$session = max_load_session($chatId);
$session['source'] = 'max';
$session['client_chat_id'] = (string)$chatId;


// FORCE MAX live-chat forward.
// If an operator is connected to this MAX client, every client message must go to Telegram group.
$maxLiveOperatorConnected = !empty($session['operator_mode']) || !empty($session['bot_paused']);

if (!$maxLiveOperatorConnected) {
    $operatorsDir = __DIR__ . '/sessions/operators';
    if (is_dir($operatorsDir)) {
        foreach (glob($operatorsDir . '/*.json') ?: [] as $operatorFile) {
            $rawOperator = file_get_contents($operatorFile);
            $operatorState = is_string($rawOperator) ? json_decode($rawOperator, true) : null;

            if (!is_array($operatorState)) continue;

            if (($operatorState['source'] ?? '') === 'max'
                && (string)($operatorState['client_chat_id'] ?? '') === (string)$chatId) {
                $maxLiveOperatorConnected = true;
                break;
            }
        }
    }
}

if ($maxLiveOperatorConnected) {
    $attachmentLinesLive = max_extract_attachment_lines($update);
    $messageForHistoryLive = $text !== ''
        ? $text
        : ($attachmentLinesLive ? '[вложение MAX: ' . implode('; ', $attachmentLinesLive) . ']' : '[без текста]');

    $liveUnique = max_extract_message_unique_id($update);
    $liveFingerprint = hash(
        'sha256',
        ($liveUnique !== '' ? $liveUnique : json_encode($update, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) . '|' . $messageForHistoryLive
    );

    $processedLive = is_array($session['processed_live_message_ids'] ?? null)
        ? $session['processed_live_message_ids']
        : [];

    if (in_array($liveFingerprint, $processedLive, true)) {
        bot_log('max_force_live_duplicate_ignored', [
            'chat_id' => $chatId,
            'text' => $messageForHistoryLive,
            'fingerprint' => $liveFingerprint,
        ]);

        max_save_session($chatId, $session);
        max_finish_webhook();
        exit;
    }

    $processedLive[] = $liveFingerprint;
    $session['processed_live_message_ids'] = array_slice(array_values(array_unique($processedLive)), -100);

    $session['source'] = 'max';
    $session['client_chat_id'] = (string)$chatId;
    $session['operator_mode'] = true;
    $session['bot_paused'] = true;

    $session = max_add_client_message($session, $messageForHistoryLive);

    $telegramLeadsChatIdLive = trim((string)($config['telegram_leads_chat_id'] ?? ''));
    if ($telegramLeadsChatIdLive === '') {
        $telegramLeadsChatIdLive = trim((string)($config['telegram_admin_chat_id'] ?? ''));
    }

    $extraLive = [
        'Режим live-чата: оператор подключён.',
        'Ответ клиенту: используйте /to текст сообщения',
    ];

    if ($attachmentLinesLive) {
        $extraLive[] = 'Вложения клиента:';
        foreach ($attachmentLinesLive as $line) {
            $extraLive[] = '- ' . $line;
        }
    }

    if ($telegramLeadsChatIdLive !== '' && !str_contains($telegramLeadsChatIdLive, 'PASTE_')) {
        max_send_telegram_notice_threaded(
            $config,
            $telegramLeadsChatIdLive,
            max_format_admin_notice(
                '💬 СООБЩЕНИЕ КЛИЕНТА ИЗ MAX',
                $incoming,
                $messageForHistoryLive,
                $update,
                $session,
                $extraLive
            ),
            $session
        );
    }

    bot_log('max_force_live_client_message_forwarded', [
        'chat_id' => $chatId,
        'text' => $messageForHistoryLive,
        'telegram_chat_id' => $telegramLeadsChatIdLive,
    ]);

    max_save_session($chatId, $session);
    max_finish_webhook();
    exit;
}



// Live-chat incoming route.
// If operator is connected, every client message from MAX must go to Telegram group.
// Bot should not auto-answer the client in this mode.
if (!empty($session['operator_mode']) || !empty($session['bot_paused'])) {
    $attachmentLinesLive = max_extract_attachment_lines($update);
    $messageForHistoryLive = $text !== '' ? $text : ($attachmentLinesLive ? '[вложение MAX: ' . implode('; ', $attachmentLinesLive) . ']' : '[без текста]');

    $uniqueBaseLive = max_extract_message_unique_id($update);
    $fingerprintLive = hash(
        'sha256',
        ($uniqueBaseLive !== '' ? $uniqueBaseLive : json_encode($update, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) . '|' . $messageForHistoryLive
    );

    $processedLive = is_array($session['processed_live_message_ids'] ?? null) ? $session['processed_live_message_ids'] : [];

    if (in_array($fingerprintLive, $processedLive, true)) {
        bot_log('max_live_duplicate_message_ignored', [
            'chat_id' => $chatId,
            'fingerprint' => $fingerprintLive,
            'text' => $messageForHistoryLive,
        ]);

        max_save_session($chatId, $session);
        max_finish_webhook();
        exit;
    }

    $processedLive[] = $fingerprintLive;
    $session['processed_live_message_ids'] = array_slice(array_values(array_unique($processedLive)), -100);

    $session = max_add_client_message($session, $messageForHistoryLive);

    $telegramLeadsChatIdLive = trim((string)($config['telegram_leads_chat_id'] ?? ''));
    if ($telegramLeadsChatIdLive === '') {
        $telegramLeadsChatIdLive = trim((string)($config['telegram_admin_chat_id'] ?? ''));
    }

    $extraLive = ['Режим live-чата: оператор подключён.'];
    if ($attachmentLinesLive) {
        $extraLive[] = 'Вложения клиента:';
        foreach ($attachmentLinesLive as $line) {
            $extraLive[] = '- ' . $line;
        }
    }

    if ($telegramLeadsChatIdLive !== '' && !str_contains($telegramLeadsChatIdLive, 'PASTE_')) {
        max_send_telegram_notice_threaded(
            $config,
            $telegramLeadsChatIdLive,
            max_format_admin_notice('💬 СООБЩЕНИЕ КЛИЕНТА ИЗ MAX', $incoming, $messageForHistoryLive, $update, $session, $extraLive),
            $session
        );
    }

    bot_log('max_live_client_message_forwarded', [
        'chat_id' => $chatId,
        'text' => $messageForHistoryLive,
        'telegram_chat_id' => $telegramLeadsChatIdLive,
    ]);

    max_save_session($chatId, $session);
    max_finish_webhook();
    exit;
}


$messageUniqueId = max_extract_message_unique_id($update);
if ($messageUniqueId !== '') {
    $processedMessageIds = is_array($session['processed_message_ids'] ?? null) ? $session['processed_message_ids'] : [];

    if (in_array($messageUniqueId, $processedMessageIds, true)) {
        bot_log('max_duplicate_message_ignored', [
            'chat_id' => $chatId,
            'message_id' => $messageUniqueId,
        ]);
        max_finish_webhook();
        exit;
    }

    $processedMessageIds[] = $messageUniqueId;
    $session['processed_message_ids'] = array_slice(array_values(array_unique($processedMessageIds)), -100);
}

$attachmentLines = max_extract_attachment_lines($update);
$messageForHistory = $text !== '' ? $text : ($attachmentLines ? '[вложение MAX: ' . implode('; ', $attachmentLines) . ']' : '[без текста]');
$session = max_add_client_message($session, $messageForHistory);
$prevLead = is_array($session['lead'] ?? null) ? $session['lead'] : [];
$patch = max_extract_patch($text);
if ($attachmentLines) {
    $patch['materials'] = 'есть вложения MAX';
    $attachmentText = max_normalize(implode(' ', $attachmentLines));
    if (preg_match('/file|document|pdf|doc|xls|документ|файл/u', $attachmentText)) {
        $patch['documents'] = 'документы приложены';
    }
}
$session['lead'] = max_merge_lead($prevLead, $patch);
$replyText = max_build_client_reply($session, $text);

$telegramLeadsChatId = trim((string)($config['telegram_leads_chat_id'] ?? ''));
if ($telegramLeadsChatId === '') $telegramLeadsChatId = trim((string)($config['telegram_admin_chat_id'] ?? ''));

max_notify_manager_if_needed($config, $telegramLeadsChatId, $incoming, $text !== '' ? $text : '[без текста]', $update, $session, $prevLead);
$isFullReadyAfter = max_is_full_lead_ready(is_array($session['lead'] ?? null) ? $session['lead'] : []);
if ($isFullReadyAfter && !empty($session['client_full_reply_sent'])) {
    $followupReplyCount = (int)($session['client_followup_auto_reply_count'] ?? 0);
    if ($followupReplyCount >= 1) {
        $replyText = '';
    } else {
        $session['client_followup_auto_reply_count'] = $followupReplyCount + 1;
    }
} elseif ($isFullReadyAfter) {
    $session['client_full_reply_sent'] = true;
    $session['client_followup_auto_reply_count'] = 0;
} else {
    $session['client_full_reply_sent'] = false;
    $session['client_followup_auto_reply_count'] = 0;
}

max_save_session($chatId, $session);

max_finish_webhook();
if ($replyText !== '') {
    max_send_message($config, $chatId, $replyText);
}
