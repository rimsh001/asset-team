const ASSET_TYPES = [
  'производственная база',
  'склад',
  'ангар',
  'промышленный участок',
  'коммерческая недвижимость',
  'оборудование',
  'спецтехника',
  'складские остатки',
  'неликвидные ТМЦ',
  'имущество после закрытия направлений',
  'проблемный актив бизнеса'
];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function getMessage(update) {
  return update?.message || update?.edited_message || null;
}

function getText(update) {
  return update?.message?.text || update?.edited_message?.text || '';
}

function getUser(from = {}) {
  const fullName = `${from.first_name || ''} ${from.last_name || ''}`.trim();
  return {
    id: from.id || '',
    fullName,
    username: from.username ? `@${from.username}` : ''
  };
}

function normalizeText(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е');
}

function detectAssetType(text) {
  const value = normalizeText(text);
  if (value.includes('база')) return 'производственная база';
  if (value.includes('склад') || value.includes('ангар')) return 'склад / ангар';
  if (value.includes('участ')) return 'земельный участок';
  if (value.includes('оборуд')) return 'оборудование';
  if (value.includes('техник') || value.includes('погруз') || value.includes('кран') || value.includes('экскават')) return 'спецтехника';
  if (value.includes('тмц') || value.includes('остат') || value.includes('неликвид')) return 'складские остатки / ТМЦ';
  if (value.includes('недвиж') || value.includes('офис') || value.includes('помещ')) return 'коммерческая недвижимость';
  return 'не определено';
}

function isLikelyLead(text) {
  const value = normalizeText(text);
  const assetWords = ['база', 'склад', 'ангар', 'участ', 'оборуд', 'техник', 'погруз', 'кран', 'тмц', 'остат', 'неликвид', 'недвиж', 'офис', 'помещ', 'земля'];
  const saleWords = ['прод', 'реализ', 'покупател', 'не прода', 'завис', 'цена', 'млн', 'руб', '₽'];
  return assetWords.some((word) => value.includes(word)) && saleWords.some((word) => value.includes(word));
}

function isGeneralQuestion(text) {
  const value = normalizeText(text);
  return value.includes('?') || [
    'как вы работаете',
    'как работаете',
    'когда позвонят',
    'когда свяжутся',
    'сколько стоит',
    'какая комиссия',
    'что дальше',
    'что нужно',
    'какие документы',
    'как продать',
    'что делаете',
    'какие условия',
    'договор'
  ].some((phrase) => value.includes(phrase));
}

function leadCardFromText({ text, user, chatId }) {
  return {
    asset_type: detectAssetType(text),
    location: text.match(/(?:в|во|г\.?|город)\s+([А-Яа-яA-Za-z\-\s]{3,40})/)?.[1]?.trim() || 'требуется уточнить',
    contact_role: 'требуется уточнить: собственник / представитель / посредник',
    task_description: text,
    selling_period: text.match(/(?:\d+\s*(?:год|года|лет|месяц|месяца|месяцев)|полгода)/i)?.[0] || 'требуется уточнить',
    current_price: text.match(/\d+[\d\s,.]*(?:млн|тыс|руб|₽)/i)?.[0] || 'требуется уточнить',
    documents_status: normalizeText(text).includes('документ') ? 'упомянуты в сообщении' : 'требуется уточнить',
    photos_status: normalizeText(text).includes('фото') ? 'фото есть / упомянуты' : 'требуется уточнить',
    listing_url: text.match(/https?:\/\/\S+/)?.[0] || 'не указано',
    main_problem: normalizeText(text).includes('не прода') || normalizeText(text).includes('2 года') ? 'актив завис в продаже, требуется диагностика спроса, цены, упаковки и документов' : 'требуется уточнить причину обращения',
    ai_assessment: 'Заявка из Telegram-бота. Нужно уточнить параметры имущества, роль клиента, документы, фото/ссылку и реальную причину зависания продажи.',
    recommended_next_step: 'Связаться с клиентом, запросить материалы по объекту, провести первичный разбор и при наличии потенциала обсудить формат работы и договор.',
    telegram_user: `${user.fullName || ''} ${user.username || ''}`.trim(),
    chat_id: String(chatId)
  };
}

function systemPrompt(managerName) {
  return `
Ты — профессиональный AI-оператор по разбору активов для A&A Asset Team.

Позиционирование компании:
«Превращаем зависшие активы бизнеса в деньги».
Компания помогает собственникам продавать базы, склады, коммерческую недвижимость, оборудование, спецтехнику, складские остатки и неликвидные ТМЦ, которые долго не находят покупателя.

Твоя роль — не автоответчик и не простая форма заявки. Ты работаешь как сильный первичный менеджер уровня топ-менеджера: квалифицируешь клиента, понимаешь задачу, выявляешь деньги и риск, объясняешь логику работы, снимаешь базовые возражения и ведешь клиента к следующему шагу: материалы → первичный разбор → созвон → формат работы → договор.

Что ты знаешь и используешь в ответах:
- сложные активы редко не продаются только из-за цены;
- часто проблема в целевом покупателе, упаковке, фото, техническом описании, документах, площадках, переговорах и рисках покупателя;
- покупатель торгуется не только за скидку, а за снятие неопределенности и рисков;
- по производственным базам важны: земля, строения, коммуникации, отопление, электричество, подъезд, арендаторы, документы, назначение земли, ограничения;
- по складам важны: площадь, высота, ворота, отопление, полы, подъезд, локация, арендаторы, документы;
- по оборудованию важны: марка, модель, год, состояние, комплектность, фото/видео работы, документы, демонтаж/логистика;
- по неликвидам и ТМЦ важны: список позиций, объем, состояние, возможность продажи партиями, цена по балансу и целевая цена;
- до обещаний и договора сначала нужен первичный разбор.

Стиль:
- отвечай как живой деловой менеджер;
- коротко, уверенно, без канцелярита;
- не повторяй один и тот же шаблон;
- отвечай именно на вопрос клиента;
- если клиент дал данные — признай конкретику из его сообщения;
- если данных мало — задай 2–5 точных вопросов;
- если клиент спрашивает «когда позвонят» — объясни следующий шаг и попроси удобное время/контакт;
- если спрашивает «как работаете» — кратко опиши этапы;
- если спрашивает про договор — объясни, что договор обсуждается после первичного разбора и определения формата работы;
- если спрашивает цену/комиссию — скажи, что формат зависит от объекта и объема работы, точнее после разборa.

Ограничения:
- не обещай продажу;
- не гарантируй цену;
- не давай юридическое заключение;
- не называй точную рыночную стоимость без данных;
- не дави на клиента;
- не пиши, что ты искусственный интеллект, без необходимости.

В конце ответа всегда мягко веди к следующему шагу: прислать материалы, назначить удобное время для связи, уточнить роль клиента или передать заявку ${managerName || 'Андрею'}.
`;
}

async function callOpenAIText(env, { text, user, chat }) {
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
        {
          role: 'user',
          content: JSON.stringify({
            message_from_client: text,
            telegram_user: user,
            telegram_chat: chat,
            instruction: 'Ответь клиенту в Telegram как живой профессиональный первичный менеджер. Не используй markdown. Не пиши длинно.'
          }, null, 2)
        }
      ],
      temperature: 0.45,
      max_output_tokens: 650
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text || '';
}

function fallbackReply(text) {
  const value = normalizeText(text);

  if (value.includes('когда позвон')) {
    return 'Передам заявку на первичный разбор. Чтобы специалист связался без лишних уточнений, напишите, пожалуйста, удобное время для звонка и подтвердите номер телефона.';
  }

  if (value.includes('как работает')) {
    return 'Работа обычно идет так: сначала смотрим имущество и материалы, затем определяем, почему продажа зависла, кому актив может быть нужен, какие документы и упаковка нужны покупателю. После первичного разбора обсуждаем формат работы и условия договора.';
  }

  if (value.includes('договор')) {
    return 'Договор обсуждается после первичного разбора: нужно понять тип имущества, объем работы, документы, цену, сроки и вашу роль в продаже. После этого можно выбрать формат сопровождения и зафиксировать условия.';
  }

  if (value.includes('сколько') || value.includes('комисс')) {
    return 'Стоимость зависит от типа имущества и объема работы: разовый разбор, упаковка, поиск покупателя или полное сопровождение. Сначала нужно посмотреть объект и понять маршрут сделки, потом можно назвать формат и условия.';
  }

  if (isLikelyLead(text)) {
    return 'Принял информацию. По вашему имуществу уже можно делать первичный разбор: нужно понять состояние объекта, документы, цену, срок продажи и почему покупатель до сих пор не найден. Пришлите, пожалуйста, ссылку на объявление, фото или основные документы, если они есть.';
  }

  return 'Понял вас. Чтобы дать полезный следующий шаг, напишите, пожалуйста, что именно нужно реализовать, где находится имущество, какая ориентировочная цена и сколько времени оно уже продается.';
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

function formatManagerCard({ user, status, leadCard, sourceText }) {
  return [
    '📌 НОВАЯ ЗАЯВКА ИЗ TELEGRAM-БОТА',
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
    `Оценка: ${leadCard.ai_assessment || 'не указано'}`,
    `Следующий шаг: ${leadCard.recommended_next_step || 'не указано'}`,
    '',
    sourceText ? `Исходное сообщение: ${sourceText}` : ''
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

  if (!tokenResponse.ok) throw new Error(`Google token error: ${tokenResponse.status} ${await tokenResponse.text()}`);

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

  if (!response.ok) throw new Error(`Google Sheets append error: ${response.status} ${await response.text()}`);
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

async function handleStart(env, message) {
  const chatId = message.chat.id;
  const hello = [
    'Здравствуйте. Я AI-оператор по разбору активов.',
    '',
    'Помогу быстро собрать информацию по вашему имуществу и понять, какой следующий шаг нужен для его реализации.',
    '',
    'Напишите, пожалуйста, одним сообщением:',
    '1. Что хотите продать?',
    '2. Где находится имущество?',
    '3. Какая ориентировочная цена?',
    '4. Сколько времени продаётся?',
    '5. Есть ли фото, документы или ссылка на объявление?',
    '',
    'После вашего ответа я зафиксирую заявку и передам её на первичный разбор. Если имущество подходит под наш профиль, с вами свяжутся для уточнения деталей, формата работы и дальнейших условий.'
  ].join('\n');

  await sendTelegramMessage(env, chatId, hello, message.message_id);
  return jsonResponse({ ok: true, command: 'start' });
}

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return jsonResponse({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN' }, 200);
  }

  const update = await request.json();
  const message = getMessage(update);
  const text = getText(update).trim();

  if (!message || !text) return jsonResponse({ ok: true, skipped: true, reason: 'empty message' });
  if (message.from?.is_bot) return jsonResponse({ ok: true, skipped: true, reason: 'bot message ignored' });
  if (text.startsWith('/start')) return handleStart(env, message);
  if (text.startsWith('/')) return jsonResponse({ ok: true, skipped: true, reason: 'command ignored' });

  const user = getUser(message.from);
  const chatId = message.chat.id;
  const date = new Date().toISOString();
  const chat = { id: chatId, title: message.chat.title || '', type: message.chat.type };

  try {
    let clientReply = '';

    if (env.OPENAI_API_KEY) {
      try {
        clientReply = await callOpenAIText(env, { text, user, chat });
      } catch (aiError) {
        console.error('OpenAI fallback used:', aiError.message);
      }
    }

    if (!clientReply) clientReply = fallbackReply(text);
    await sendTelegramMessage(env, chatId, clientReply.trim(), message.message_id);

    if (isLikelyLead(text)) {
      const leadCard = leadCardFromText({ text, user, chatId });
      const managerCard = formatManagerCard({
        user,
        status: 'новая / требуется квалификация',
        leadCard,
        sourceText: text
      });

      await sendTelegramMessage(env, env.MANAGER_CHAT_ID || chatId, managerCard);
      await appendToGoogleSheets(env, buildSheetRow({
        date,
        user,
        chatId,
        status: 'новая / требуется квалификация',
        leadCard,
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
  return jsonResponse({ ok: true, service: 'telegram-ai-operator-cloudflare-pages', mode: 'live-manager-dialog' });
}
