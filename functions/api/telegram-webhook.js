const KNOWLEDGE = `
A&A Asset Team: «Превращаем зависшие активы бизнеса в деньги».
Работаем с продажей сложного и зависшего имущества бизнеса: производственные базы, склады, ангары, промышленные участки, коммерческая недвижимость, оборудование, спецтехника, складские остатки и неликвидные ТМЦ.

Важно: мы не занимаемся арендой и подбором арендаторов. Если клиент спрашивает про аренду, корректно объясни, что наш профиль — продажа и реализация активов, но можно разобрать, имеет ли смысл готовить объект к продаже.

Подход: не просто размещаем объявление, а разбираем актив как сделку: кто может купить, что мешает покупке, какие риски видит покупатель, какие документы нужны, как упаковать объект, где искать целевой спрос и как вести переговоры.

Почему активы зависают: цена не объяснена рынку, непонятен целевой покупатель, слабые фото, нет технического описания, документы не собраны, объект размещен не на тех площадках, продавец ждет случайного звонка, нет прямого поиска покупателей, не сняты риски покупателя, переговоры сводятся к торгу.

Производственная база: важны земля, строения, назначение земли, коммуникации, отопление, электричество, вода, канализация, подъезд, состояние зданий, документы, кадастровые номера, ограничения.
Склад/ангар: важны площадь, высота, ворота, полы, отопление, подъезд фур, охрана, электричество, документы, состояние.
Оборудование/спецтехника: марка, модель, год, состояние, комплектность, фото, видео работы, документы, демонтаж, погрузка, доставка.
ТМЦ/неликвиды: список позиций, объем, состояние, цена по балансу, минимальная партия, возможность продажи частями.

Маршрут работы: первичный разбор → сбор материалов → диагностика цены, упаковки и спроса → стратегия продажи → упаковка объекта → поиск покупателей → переговоры → договор.
`;

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
  return {
    id: from.id || '',
    fullName: `${from.first_name || ''} ${from.last_name || ''}`.trim(),
    username: from.username ? `@${from.username}` : ''
  };
}

function normalize(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е');
}

function sessionKey(chatId) {
  return `telegram-lead:${chatId}`;
}

async function loadSession(env, chatId) {
  if (!env.CHAT_MEMORY) return { lead: {}, messages: [], managerNotified: false };
  const raw = await env.CHAT_MEMORY.get(sessionKey(chatId));
  if (!raw) return { lead: {}, messages: [], managerNotified: false };
  try {
    return JSON.parse(raw);
  } catch {
    return { lead: {}, messages: [], managerNotified: false };
  }
}

async function saveSession(env, chatId, session) {
  if (!env.CHAT_MEMORY) return;
  await env.CHAT_MEMORY.put(sessionKey(chatId), JSON.stringify(session), { expirationTtl: 60 * 60 * 24 * 14 });
}

function detectAssetType(text) {
  const t = normalize(text);
  if (t.includes('база')) return 'производственная база';
  if (t.includes('склад') || t.includes('ангар')) return 'склад / ангар';
  if (t.includes('участ') || t.includes('земл')) return 'земельный участок';
  if (t.includes('оборуд')) return 'оборудование';
  if (t.includes('спецтех') || t.includes('погруз') || t.includes('кран') || t.includes('экскават')) return 'спецтехника';
  if (t.includes('тмц') || t.includes('остат') || t.includes('неликвид')) return 'ТМЦ / складские остатки';
  if (t.includes('помещ') || t.includes('офис') || t.includes('недвиж')) return 'коммерческая недвижимость';
  return '';
}

function extractPatch(text) {
  const t = normalize(text);
  const patch = {};
  const assetType = detectAssetType(text);
  if (assetType) patch.asset_type = assetType;
  if (t.includes('прод')) patch.goal = 'продажа';
  if (t.includes('консульт')) patch.goal = 'консультация по продаже / стратегии реализации';
  if (t.includes('собственник')) patch.role = 'собственник';
  if (t.includes('представитель')) patch.role = 'представитель';
  if (t.includes('фото')) patch.photos = 'есть / упомянуты';
  if (t.includes('документ')) patch.documents = 'документы упомянуты';

  const area = text.match(/\d+[\d\s,.]*(?:м2|м²|кв\.?\s*м|сот|га)/i)?.[0];
  if (area) patch.area = area;

  const price = text.match(/\d+[\d\s,.]*(?:млн|тыс|руб|₽)/i)?.[0];
  if (price) patch.price = price;

  const period = text.match(/(?:\d+\s*(?:год|года|лет|месяц|месяца|месяцев)|полгода)/i)?.[0];
  if (period) patch.selling_period = period;

  const url = text.match(/https?:\/\/\S+/)?.[0];
  if (url) patch.url = url;

  const locations = [
    ['москва', 'Москва'],
    ['московская область', 'Московская область'],
    ['ангарск', 'Ангарск'],
    ['иркутск', 'Иркутск'],
    ['санкт-петербург', 'Санкт-Петербург'],
    ['спб', 'Санкт-Петербург']
  ];
  for (const [needle, label] of locations) {
    if (t.includes(needle)) patch.location = label;
  }

  return patch;
}

function mergeLead(lead, patch) {
  return { ...(lead || {}), ...(patch || {}) };
}

function missingFields(lead = {}) {
  const missing = [];
  if (!lead.asset_type) missing.push('что именно продается');
  if (!lead.location) missing.push('где находится объект');
  if (!lead.area) missing.push('площадь / объем');
  if (!lead.price) missing.push('ориентировочная цена');
  if (!lead.selling_period) missing.push('сколько времени продается');
  if (!lead.documents) missing.push('что с документами');
  if (!lead.photos && !lead.url) missing.push('есть ли фото или ссылка на объявление');
  if (!lead.role) missing.push('вы собственник или представитель');
  return missing;
}

function hasAssetContext(lead = {}, text = '') {
  return Boolean(lead.asset_type || detectAssetType(text));
}

function buildManagerCard({ user, lead, lastText }) {
  return [
    '📌 НОВАЯ ЗАЯВКА ИЗ TELEGRAM-БОТА',
    '',
    `Клиент: ${user.fullName || 'не указано'} ${user.username || ''}`.trim(),
    `Тип актива: ${lead.asset_type || 'не указано'}`,
    `Локация: ${lead.location || 'не указано'}`,
    `Площадь / объем: ${lead.area || 'не указано'}`,
    `Цена: ${lead.price || 'не указано'}`,
    `Срок продажи: ${lead.selling_period || 'не указано'}`,
    `Фото / ссылка: ${lead.photos || lead.url || 'не указано'}`,
    `Документы: ${lead.documents || 'не указано'}`,
    `Кто обратился: ${lead.role || 'не указано'}`,
    '',
    'Следующий шаг: связаться с клиентом, запросить материалы и провести первичный разбор.',
    '',
    `Последнее сообщение: ${lastText}`
  ].join('\n');
}

function fallbackReply(text, session) {
  const t = normalize(text);
  const lead = session.lead || {};
  const missing = missingFields(lead);

  if (t.includes('аренд') || t.includes('сдам') || t.includes('сдать')) {
    return 'Арендой мы не занимаемся. Наш профиль — продажа и реализация сложных активов. Можем посмотреть объект именно с точки зрения продажи: насколько он ликвиден, что мешает покупателю, какие материалы нужны и какой маршрут реализации выбрать.';
  }

  if (t.includes('как работает')) {
    return 'Работаем так: сначала собираем вводные по объекту, затем смотрим цену, документы, упаковку, целевого покупателя и причины, почему актив завис. После первичного разбора можно понять формат: консультация, подготовка к продаже или сопровождение реализации.';
  }

  if (t.includes('договор')) {
    return 'Договор обсуждается после первичного разбора. Сначала нужно понять объект, объем работы и формат сопровождения: разбор, упаковка, поиск покупателя или сопровождение реализации.';
  }

  if (t.includes('сколько') || t.includes('стоим') || t.includes('комисс')) {
    return 'Стоимость зависит от объекта и формата работы. Сначала нужно понять тип имущества, цену, документы, срок продажи и сложность поиска покупателя. После этого можно предметно обсуждать условия.';
  }

  if (hasAssetContext(lead, text)) {
    if (missing.length === 0) {
      return 'Данных достаточно для первичной фиксации. Передаю информацию на разбор. Следующий шаг — посмотреть материалы по объекту: фото, документы или ссылку на объявление, если сможете прислать.';
    }
    return `Принял, дополнил данные по объекту. Осталось уточнить:\n${missing.slice(0, 3).map((item, i) => `${i + 1}. ${item}?`).join('\n')}`;
  }

  return 'Понял. Уточните, пожалуйста, что именно нужно реализовать: база, склад, помещение, оборудование, техника или ТМЦ?';
}

function systemPrompt(managerName) {
  return `
Ты — AI-оператор по разбору активов для A&A Asset Team.
Общайся как живой первичный менеджер, а не как анкета.

${KNOWLEDGE}

Учитывай уже собранные данные. Не задавай повторно вопрос, если клиент уже ответил. Если клиент пишет коротко — это продолжение диалога. Не предлагай аренду: компания ей не занимается. Веди к продаже/реализации, первичному разбору, материалам, созвону и договору. Ответ — обычный текст для Telegram, до 700 символов.
`;
}

async function askOpenAI(env, { text, session, user }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        { role: 'system', content: systemPrompt(env.COMPANY_MANAGER_NAME || 'Андрей') },
        { role: 'user', content: JSON.stringify({ current_message: text, collected_data: session.lead, missing_fields: missingFields(session.lead), recent_history: session.messages.slice(-8), telegram_user: user }, null, 2) }
      ],
      temperature: 0.45,
      max_output_tokens: 600
    })
  });
  if (!response.ok) throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text || '';
}

async function sendTelegram(env, chatId, text, replyToMessageId) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_to_message_id: replyToMessageId || undefined, disable_web_page_preview: true })
  });
  if (!response.ok) throw new Error(`Telegram error ${response.status}: ${await response.text()}`);
}

async function handleStart(env, message) {
  const chatId = message.chat.id;
  await saveSession(env, chatId, { lead: {}, messages: [], managerNotified: false });
  const text = [
    'Здравствуйте. Я AI-оператор по разбору активов.',
    '',
    'Помогу быстро собрать информацию по вашему имуществу и понять следующий шаг для продажи или реализации.',
    '',
    'Напишите коротко, что нужно реализовать: база, склад, помещение, оборудование, техника, ТМЦ или другой актив. Можно по частям — я буду вести диалог и не буду спрашивать одно и то же повторно.'
  ].join('\n');
  await sendTelegram(env, chatId, text, message.message_id);
  return jsonResponse({ ok: true });
}

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN) return jsonResponse({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN' }, 200);

  const update = await request.json();
  const message = getMessage(update);
  const text = getText(update).trim();
  if (!message || !text) return jsonResponse({ ok: true, skipped: true });
  if (message.from?.is_bot) return jsonResponse({ ok: true, skipped: true, reason: 'bot message' });
  if (text.startsWith('/start')) return handleStart(env, message);
  if (text.startsWith('/')) return jsonResponse({ ok: true, skipped: true, reason: 'command' });

  const chatId = message.chat.id;
  const user = getUser(message.from);

  try {
    const session = await loadSession(env, chatId);
    session.lead = mergeLead(session.lead, extractPatch(text));
    session.messages = [...(session.messages || []), { role: 'client', text, at: new Date().toISOString() }].slice(-20);

    let reply = '';
    if (env.OPENAI_API_KEY) {
      try {
        reply = await askOpenAI(env, { text, session, user });
      } catch (error) {
        console.error('OpenAI fallback:', error.message);
      }
    }
    if (!reply) reply = fallbackReply(text, session);

    await sendTelegram(env, chatId, reply.trim(), message.message_id);
    session.messages = [...session.messages, { role: 'bot', text: reply, at: new Date().toISOString() }].slice(-20);

    if (hasAssetContext(session.lead, text) && !session.managerNotified && (session.lead.asset_type || session.lead.location || session.lead.price)) {
      await sendTelegram(env, env.MANAGER_CHAT_ID || chatId, buildManagerCard({ user, lead: session.lead, lastText: text }));
      session.managerNotified = true;
    }

    await saveSession(env, chatId, session);
    return jsonResponse({ ok: true, memory: Boolean(env.CHAT_MEMORY) });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return jsonResponse({ ok: false, error: error.message }, 200);
  }
}

export async function onRequestGet() {
  return jsonResponse({ ok: true, mode: 'stateful-dialog-v5', memory: 'requires Cloudflare KV binding CHAT_MEMORY' });
}
