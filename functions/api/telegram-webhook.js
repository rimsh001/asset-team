const ASSET_TYPES = [
  'производственная база',
  'склад',
  'промышленный участок',
  'коммерческая недвижимость',
  'оборудование',
  'спецтехника',
  'складские остатки',
  'неликвидные ТМЦ',
  'имущество после закрытия направлений',
  'проблемный актив бизнеса'
];

const RESPONSE_SCHEMA = {
  name: 'telegram_asset_lead_agent_response',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'is_lead',
      'status',
      'client_reply',
      'should_send_client_reply',
      'should_create_card',
      'manager_summary',
      'lead_card'
    ],
    properties: {
      is_lead: { type: 'boolean' },
      status: {
        type: 'string',
        enum: ['новая', 'требуется уточнение', 'целевая', 'нецелевая', 'передана Андрею', 'закрыта']
      },
      should_send_client_reply: { type: 'boolean' },
      client_reply: { type: 'string' },
      should_create_card: { type: 'boolean' },
      manager_summary: { type: 'string' },
      lead_card: {
        type: 'object',
        additionalProperties: false,
        required: [
          'asset_type',
          'location',
          'contact_role',
          'task_description',
          'selling_period',
          'current_price',
          'documents_status',
          'photos_status',
          'listing_url',
          'main_problem',
          'ai_assessment',
          'recommended_next_step'
        ],
        properties: {
          asset_type: { type: 'string' },
          location: { type: 'string' },
          contact_role: { type: 'string' },
          task_description: { type: 'string' },
          selling_period: { type: 'string' },
          current_price: { type: 'string' },
          documents_status: { type: 'string' },
          photos_status: { type: 'string' },
          listing_url: { type: 'string' },
          main_problem: { type: 'string' },
          ai_assessment: { type: 'string' },
          recommended_next_step: { type: 'string' }
        }
      }
    }
  },
  strict: true
};

function systemPrompt(managerName) {
  return `
Ты — AI-агент-менеджер компании, которая помогает собственникам бизнеса реализовывать зависшее, непрофильное и сложное имущество.

Компания работает с активами:
${ASSET_TYPES.map((item) => `- ${item};`).join('\n')}

Твоя задача — принять обращение клиента в Telegram, квалифицировать заявку, задать короткие уточняющие вопросы и подготовить внутреннюю карточку для ${managerName || 'Андрея'}.

Стиль общения с клиентом:
- коротко;
- делово;
- уверенно;
- без канцелярита;
- без длинных текстов;
- не более 5–7 вопросов за один ответ.

Запрещено:
- обещать продажу;
- гарантировать цену;
- давать юридические заключения;
- называть точную рыночную стоимость без анализа;
- спорить с клиентом;
- раскрывать внутреннюю логику компании.

Если данных мало — задай клиенту вопросы: что за актив, где находится, цена, срок продажи, документы/фото, кто обращается.
Если данных достаточно — сформируй карточку и предложи передать заявку Андрею.

Ответ всегда возвращай строго в JSON без markdown.
`;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function getText(update) {
  return update?.message?.text || update?.edited_message?.text || '';
}

function getMessage(update) {
  return update?.message || update?.edited_message || null;
}

function getUser(from = {}) {
  const fullName = `${from.first_name || ''} ${from.last_name || ''}`.trim();
  return {
    id: from.id || '',
    fullName,
    username: from.username ? `@${from.username}` : ''
  };
}

async function callOpenAI(env, payload) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        { role: 'system', content: systemPrompt(env.COMPANY_MANAGER_NAME || 'Андрей') },
        { role: 'user', content: JSON.stringify(payload, null, 2) }
      ],
      temperature: 0.2,
      text: {
        format: {
          type: 'json_schema',
          ...RESPONSE_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const raw = data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
  if (!raw) throw new Error('OpenAI response has no output_text');
  return JSON.parse(raw);
}

async function sendTelegramMessage(env, chatId, text, replyToMessageId) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_to_message_id: replyToMessageId || undefined,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage error: ${response.status} ${await response.text()}`);
  }
}

function formatManagerCard({ user, status, leadCard, managerSummary }) {
  return [
    '📌 НОВАЯ ЗАЯВКА ИЗ TELEGRAM',
    '',
    `Статус: ${status}`,
    `Клиент: ${user.fullName || 'не указано'} ${user.username || ''}`.trim(),
    '',
    `Тип актива: ${leadCard.asset_type || 'не указано'}`,
    `Локация: ${leadCard.location || 'не указано'}`,
    `Кто обратился: ${leadCard.contact_role || 'не указано'}`,
    `Суть задачи: ${leadCard.task_description || 'не указано'}`,
    `Срок продажи: ${leadCard.selling_period || 'не указано'}`,
    `Цена: ${leadCard.current_price || 'не указано'}`,
    `Документы: ${leadCard.documents_status || 'не указано'}`,
    `Фото: ${leadCard.photos_status || 'не указано'}`,
    `Ссылка: ${leadCard.listing_url || 'не указано'}`,
    '',
    `Проблема: ${leadCard.main_problem || 'не указано'}`,
    `Оценка AI: ${leadCard.ai_assessment || 'не указано'}`,
    `Следующий шаг: ${leadCard.recommended_next_step || 'не указано'}`,
    '',
    managerSummary ? `Комментарий AI: ${managerSummary}` : ''
  ].filter(Boolean).join('\n');
}

async function getGoogleAccessToken(env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsignedJwt));
  const jwt = `${unsignedJwt}.${arrayBufferToBase64Url(signature)}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google token error: ${tokenResponse.status} ${await tokenResponse.text()}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function base64Url(input) {
  return btoa(unescape(encodeURIComponent(input))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function arrayBufferToBase64Url(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToArrayBuffer(pem) {
  const clean = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function appendToGoogleSheets(env, row) {
  if (!env.GOOGLE_SHEET_ID) return;
  const accessToken = await getGoogleAccessToken(env);
  if (!accessToken) return;

  const tab = env.GOOGLE_SHEET_TAB || 'Leads';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(tab)}!A:R:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ values: [row] })
  });

  if (!response.ok) {
    throw new Error(`Google Sheets append error: ${response.status} ${await response.text()}`);
  }
}

function buildSheetRow({ date, user, chatId, status, leadCard, text }) {
  return [
    date,
    user.fullName || '',
    user.username || '',
    String(chatId),
    status || '',
    leadCard.asset_type || '',
    leadCard.location || '',
    leadCard.contact_role || '',
    leadCard.task_description || '',
    leadCard.selling_period || '',
    leadCard.current_price || '',
    leadCard.documents_status || '',
    leadCard.photos_status || '',
    leadCard.listing_url || '',
    leadCard.main_problem || '',
    leadCard.ai_assessment || '',
    leadCard.recommended_next_step || '',
    text || ''
  ];
}

async function handleStart(env, message, text) {
  const chatId = message.chat.id;
  const hello = [
    'Здравствуйте. Я AI-агент A&A Asset Team.',
    '',
    'Помогу собрать первичную информацию по активу для разбора.',
    '',
    'Напишите, пожалуйста, одним сообщением:',
    '1. Что хотите продать?',
    '2. Где находится актив?',
    '3. Какая ориентировочная цена?',
    '4. Сколько времени продаётся?',
    '5. Есть ли фото, документы или ссылка на объявление?',
    '',
    'После этого я подготовлю заявку для Андрея.'
  ].join('\n');

  await sendTelegramMessage(env, chatId, hello, message.message_id);
  return jsonResponse({ ok: true, command: 'start' });
}

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.OPENAI_API_KEY) {
    return jsonResponse({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN or OPENAI_API_KEY' }, 200);
  }

  const update = await request.json();
  const message = getMessage(update);
  const text = getText(update).trim();

  if (!message || !text) {
    return jsonResponse({ ok: true, skipped: true, reason: 'empty message' });
  }

  if (message.from?.is_bot) {
    return jsonResponse({ ok: true, skipped: true, reason: 'bot message ignored' });
  }

  if (text.startsWith('/start')) {
    return handleStart(env, message, text);
  }

  if (text.startsWith('/')) {
    return jsonResponse({ ok: true, skipped: true, reason: 'command ignored' });
  }

  const user = getUser(message.from);
  const chatId = message.chat.id;
  const date = new Date().toISOString();

  try {
    const aiResult = await callOpenAI(env, {
      instruction: 'Проанализируй новое сообщение клиента в Telegram. Определи, заявка ли это. Если заявка — подготовь короткий ответ клиенту и/или карточку заявки.',
      new_message: text,
      telegram_user: user,
      telegram_chat: {
        id: chatId,
        title: message.chat.title || '',
        type: message.chat.type
      },
      manager_name: env.COMPANY_MANAGER_NAME || 'Андрей'
    });

    if (aiResult.should_send_client_reply && aiResult.client_reply) {
      await sendTelegramMessage(env, chatId, aiResult.client_reply, message.message_id);
    }

    if (aiResult.should_create_card) {
      const managerCard = formatManagerCard({
        user,
        status: aiResult.status,
        leadCard: aiResult.lead_card,
        managerSummary: aiResult.manager_summary
      });

      await sendTelegramMessage(env, env.MANAGER_CHAT_ID || chatId, managerCard);
      await appendToGoogleSheets(env, buildSheetRow({
        date,
        user,
        chatId,
        status: aiResult.status,
        leadCard: aiResult.lead_card,
        text
      }));
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('Telegram webhook processing error:', error.message);
    return jsonResponse({ ok: false, error: error.message, handled_without_retry: true }, 200);
  }
}

export async function onRequestGet() {
  return jsonResponse({ ok: true, service: 'telegram-ai-agent-cloudflare-pages' });
}
