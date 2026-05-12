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
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function normalize(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е');
}

function getMessage(update) { return update?.message || update?.edited_message || null; }
function getText(update) { return update?.message?.text || update?.edited_message?.text || ''; }
function getUser(from = {}) {
  return {
    id: from.id || '',
    fullName: `${from.first_name || ''} ${from.last_name || ''}`.trim() || from.username || '',
    username: from.username ? `@${from.username}` : ''
  };
}

function sessionKey(chatId) { return `telegram-lead:${chatId}`; }
function emptySession() {
  return { lead: {}, messages: [], earlyManagerNotified: false, fullManagerNotified: false, notifiedFields: {}, lastSupplementHash: '' };
}

async function loadSession(env, chatId) {
  if (!env.CHAT_MEMORY) return emptySession();
  const raw = await env.CHAT_MEMORY.get(sessionKey(chatId));
  if (!raw) return emptySession();
  try {
    const parsed = JSON.parse(raw);
    const legacyNotified = Boolean(parsed?.managerNotified);
    return {
      lead: parsed?.lead || {},
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
      earlyManagerNotified: Boolean(parsed?.earlyManagerNotified) || legacyNotified,
      fullManagerNotified: Boolean(parsed?.fullManagerNotified),
      notifiedFields: parsed?.notifiedFields || {},
      lastSupplementHash: parsed?.lastSupplementHash || ''
    };
  } catch {
    return emptySession();
  }
}

async function saveSession(env, chatId, session) {
  if (!env.CHAT_MEMORY) return;
  await env.CHAT_MEMORY.put(sessionKey(chatId), JSON.stringify(session), { expirationTtl: 60 * 60 * 24 * 14 });
}

function detectAssetType(text) {
  const t = normalize(text);
  if (t.includes('производствен') || t.includes('база')) return 'производственная база';
  if (t.includes('склад') || t.includes('ангар')) return 'склад / ангар';
  if (t.includes('участ') || t.includes('земл')) return 'земельный участок';
  if (t.includes('оборуд')) return 'оборудование';
  if (t.includes('спецтех') || t.includes('техник') || t.includes('погруз') || t.includes('кран') || t.includes('экскават')) return 'спецтехника';
  if ((t.includes('складск') && t.includes('остат')) || t.includes('остатки')) return 'складские остатки';
  if (t.includes('неликвид') || t.includes('тмц')) return 'неликвидные ТМЦ';
  if ((t.includes('имуществ') && t.includes('закрыт')) || t.includes('закрытие направления') || t.includes('активы после оптимизации')) return 'имущество после закрытия направления';
  if (t.includes('помещ') || t.includes('офис') || t.includes('недвиж')) return 'коммерческая недвижимость';
  return '';
}



const exactCategoryMap = {
  'база': 'производственная база',
  'склад': 'склад / ангар',
  'ангар': 'склад / ангар',
  'оборудование': 'оборудование',
  'техника': 'спецтехника',
  'спецтехника': 'спецтехника',
  'тмц': 'неликвидные ТМЦ',
  'неликвид': 'неликвидные ТМЦ',
  'остатки': 'складские остатки',
  'помещение': 'коммерческая недвижимость',
  'офис': 'коммерческая недвижимость',
  'коммерческая недвижимость': 'коммерческая недвижимость'
};

function detectExactCategory(text) {
  return exactCategoryMap[normalize(text).trim()] || '';
}

function detectLocation(text) {
  const t = normalize(text);
  if (t.includes('московская область') || t.includes('подмосков') || t.split(/[^а-яa-z0-9]+/).includes('мо')) return 'Московская область';
  if (t.includes('москва') || t.includes('москве') || t.includes('пресня') || t.split(/[^а-яa-z0-9]+/).includes('мск')) return 'Москва';
  if (t.includes('санкт-петербург') || t.includes('санкт петербург') || t.split(/[^а-яa-z0-9]+/).includes('спб')) return 'Санкт-Петербург';
  if (t.includes('ангарск')) return 'Ангарск';
  if (t.includes('иркутск')) return 'Иркутск';
  return '';
}

function extractPatch(text, lead = {}) {
  const t = normalize(text);
  const patch = {};
  const assetType = detectExactCategory(text) || detectAssetType(text);
  if (assetType) patch.asset_type = assetType;
  if (t.includes('прод')) patch.goal = 'продажа';
  if (t.includes('консульт')) patch.goal = 'консультация по продаже / стратегии реализации';

  if (t.includes('собственник') || t.includes('от собственника')) patch.role = 'собственник';
  if (t.includes('представитель') || t.includes('работаю от собственника')) patch.role = 'представитель';

  if (t.includes('фото нет')) patch.photos = 'фото нет';
  else if (t.includes('фото')) patch.photos = 'есть / упомянуты';
  if (t.includes('документ')) patch.documents = 'документы упомянуты';

  const loc = detectLocation(text);
  if (loc) patch.location = loc;

  const period = text.match(/(?:\d+\s*(?:год|года|лет|месяц|месяца|месяцев)|полгода)/i)?.[0];
  if (period) patch.selling_period = period;
  if (t.includes('не продавал') || t.includes('не продавался') || t.includes('еще не продавали') || t.includes('только готовим к продаже')) {
    patch.sale_status = 'не продавался ранее';
  }

  const area = text.match(/\d+[\d\s,.]*(?:м2|м²|кв\.?\s*м|сот|га)/i)?.[0];
  if (area) patch.area = area;

  const price = text.match(/\d+[\d\s,.]*(?:млн|тыс|руб|₽)/i)?.[0];
  if (price) patch.price = price;

  const numericTokens = [...text.matchAll(/\b\d{2,6}\b/g)].map((m) => m[0]);
  if (!patch.area && numericTokens.length && (lead.asset_type || patch.asset_type)) {
    const filtered = numericTokens.filter((n) => !(patch.price || '').includes(n));
    if (filtered[0]) patch.area = `${filtered[0]} м² / объем уточнить`;
  }

  const url = text.match(/https?:\/\/\S+/)?.[0];
  if (url) patch.url = url;
  const phone = text.match(/(?:\+7|7|8)\D{0,3}\(?\d{3}\)?\D{0,3}\d{3}\D{0,3}\d{2}\D{0,3}\d{2}/)?.[0];
  const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0];
  if (phone || email) patch.contact = [phone, email].filter(Boolean).join(', ');

  return patch;
}

function mergeLead(lead, patch) { return { ...(lead || {}), ...(patch || {}) }; }

function missingFields(lead = {}) {
  const missing = [];
  if (!lead.asset_type) missing.push('что именно нужно реализовать');
  if (!lead.location) missing.push('где находится объект');
  if (!lead.area) missing.push('какая площадь / объем / количество');
  if (!lead.price) missing.push('какая ориентировочная цена');
  if (!lead.selling_period && !lead.sale_status) missing.push('продавался ли объект ранее? Если да — сколько времени и где размещался');
  if (!lead.documents) missing.push('что с документами');
  if (!lead.photos && !lead.url) missing.push('есть ли фото или ссылка на объявление');
  if (!lead.role) missing.push('вы собственник или представитель');
  if (!lead.contact) missing.push('удобный контакт для связи');
  return missing;
}

function hasAssetContext(lead = {}, text = '') { return Boolean(lead.asset_type || detectAssetType(text)); }
function hasCallIntent(text = '') { const t = normalize(text); return ['жду звонка', 'позвоните', 'готов обсудить', 'жду связи', 'можно звонить', 'свяжитесь', 'наберите'].some((w) => t.includes(w)); }

function fallbackReply(text, session) {
  const t = normalize(text);
  const lead = session.lead || {};
  const missing = missingFields(lead);
  if (t.includes('аренд') || t.includes('сдам') || t.includes('сдать')) return 'Арендой мы не занимаемся. Наш профиль — продажа и реализация сложных активов. Можем посмотреть объект с точки зрения продажи: насколько он ликвиден, что мешает покупателю, какие материалы нужны и какой маршрут реализации выбрать.';
  if (hasCallIntent(text)) return lead.contact ? 'Принял. Передаю информацию на разбор. Специалист свяжется с вами по указанному контакту.' : 'Принял. Оставьте, пожалуйста, удобный телефон или другой контакт для связи — передам информацию специалисту.';
  if (hasAssetContext(lead, text)) {
    if (!missing.length) return 'Данных достаточно для первичной фиксации. Передаю информацию на разбор. Следующий шаг — посмотреть материалы по объекту: фото, документы или ссылку на объявление, если сможете прислать.';
    return `Принял, это ${lead.asset_type || detectAssetType(text)}.\n\nОсталось уточнить:\n${missing.slice(0, 3).map((item, i) => `${i + 1}. ${item}?`).join('\n')}`;
  }
  return `Понял. Уточните, пожалуйста, к какой категории относится актив:\n\n1. Производственная база\n2. Склад или ангар\n3. Коммерческая недвижимость\n4. Оборудование\n5. Спецтехника\n6. Складские остатки\n7. Неликвидные ТМЦ\n8. Имущество после закрытия направления\n\nМожно ответить коротко: например, «склад», «оборудование», «база» или описать объект своими словами.`;
}

const buildClarifyingReply = fallbackReply;
function systemPrompt() { return 'telegram-equals-max'; }

function isFullLeadReady(lead = {}) {
  return Boolean(lead.asset_type && lead.location && lead.area && lead.price && (lead.selling_period || lead.sale_status) && lead.role);
}
function shouldNotifyEarlyLead(lead = {}, text = '') { return Boolean(hasAssetContext(lead, text) && lead.asset_type && (lead.location || lead.price || lead.area || lead.url)); }
function buildMissingForFullLead(lead = {}) { const m = []; if (!lead.asset_type) m.push('тип актива'); if (!lead.location) m.push('локация'); if (!lead.area) m.push('площадь / объем'); if (!lead.price) m.push('цена'); if (!lead.selling_period && !lead.sale_status) m.push('статус продажи'); if (!lead.role) m.push('кто обратился'); return m; }
function buildRecentClientHistory(messages = []) { const c = (messages || []).filter((x) => x.role === 'client').slice(-5); return c.length ? c.map((x, i) => `${i + 1}) ${x.text}`).join('\n') : 'не указано'; }

function buildEarlyLeadCard({ user, lead, lastText, missingFullFields }) { return ['🟡 РАННИЙ ЛИД ИЗ TELEGRAM-БОТА', '', 'Клиент обозначил актив. Бот продолжает добирать данные. Полноценная заявка придет отдельным сообщением.', '', `Клиент: ${user.fullName || 'не указано'} ${user.username || ''}`.trim(), `Telegram user_id: ${user.id || 'не указано'}`, `Тип актива: ${lead.asset_type || 'не указано'}`, `Локация: ${lead.location || 'не указано'}`, `Площадь / объем: ${lead.area || 'не указано'}`, `Цена: ${lead.price || 'не указано'}`, `Статус продажи: ${lead.selling_period || lead.sale_status || 'не указано'}`, `Фото / ссылка: ${lead.photos || lead.url || 'не указано'}`, `Документы: ${lead.documents || 'не указано'}`, `Кто обратился: ${lead.role || 'не указано'}`, `Контакт: ${lead.contact || 'не указано'}`, '', `Последнее сообщение: ${lastText}`, `Не хватает до полной заявки: ${missingFullFields.length ? missingFullFields.join(', ') : 'ключевые поля собраны'}`].join('\n'); }
function buildFullLeadCard({ user, lead, lastText, recentHistory }) { return ['✅ ПОЛНАЯ ЗАЯВКА ИЗ TELEGRAM-БОТА', '', `Клиент: ${user.fullName || 'не указано'} ${user.username || ''}`.trim(), `Telegram user_id: ${user.id || 'не указано'}`, `Тип актива: ${lead.asset_type || 'не указано'}`, `Локация: ${lead.location || 'не указано'}`, `Площадь / объем: ${lead.area || 'не указано'}`, `Цена: ${lead.price || 'не указано'}`, `Статус продажи: ${lead.selling_period || lead.sale_status || 'не указано'}`, `Фото / ссылка: ${lead.photos || lead.url || 'не указано'}`, `Документы: ${lead.documents || 'не указано'}`, `Кто обратился: ${lead.role || 'не указано'}`, `Контакт: ${lead.contact || 'не указано'}`, '', `Последнее сообщение: ${lastText}`, '', 'Краткая история последних сообщений клиента:', recentHistory, '', 'Следующий шаг: связаться с клиентом, запросить материалы и провести первичный разбор.'].join('\n'); }
function buildSupplementCard({ user, lead, lastText, supplementLabel, fields }) { return [supplementLabel, '', `Клиент: ${user.fullName || 'не указано'} ${user.username || ''}`.trim(), `Telegram user_id: ${user.id || 'не указано'}`, `Новые данные: ${fields.join(', ')}`, fields.includes('contact') ? `Контакт: ${lead.contact || 'не указано'}` : '', fields.includes('url') ? `URL: ${lead.url || 'не указано'}` : '', fields.includes('documents') ? `Документы: ${lead.documents || 'не указано'}` : '', fields.includes('photos') ? `Фото: ${lead.photos || 'не указано'}` : '', fields.includes('call_intent') ? 'Клиент ожидает звонок/связь.' : '', '', 'Текущая карточка лида:', `Тип актива: ${lead.asset_type || 'не указано'}`, `Локация: ${lead.location || 'не указано'}`, `Площадь / объем: ${lead.area || 'не указано'}`, `Цена: ${lead.price || 'не указано'}`, `Статус продажи: ${lead.selling_period || lead.sale_status || 'не указано'}`, `Кто обратился: ${lead.role || 'не указано'}`, '', `Последнее сообщение: ${lastText}`].filter(Boolean).join('\n'); }
function detectSupplementFields(session, prevLead, nextLead, text) { if (!session.fullManagerNotified) return []; const fields = []; const n = session.notifiedFields || {}; if (!prevLead.contact && nextLead.contact && !n.contact) fields.push('contact'); if (!prevLead.url && nextLead.url && !n.url) fields.push('url'); if (!prevLead.documents && nextLead.documents && !n.documents) fields.push('documents'); if (!prevLead.photos && nextLead.photos && !n.photos) fields.push('photos'); if (hasCallIntent(text) && !n.call_intent && !n.contact) fields.push('call_intent'); return fields; }

async function sendTelegram(env, chatId, text, replyTo) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, reply_to_message_id: replyTo || undefined, disable_web_page_preview: true }) });
  if (!response.ok) throw new Error(`Telegram send error ${response.status}: ${await response.text()}`);
}
async function sendTelegramManager(env, text) { if (!env.MANAGER_CHAT_ID) return; await sendTelegram(env, env.MANAGER_CHAT_ID, text); }

async function notifyManagerIfNeeded(env, { session, user, text, supplementFields }) {
  if (isFullLeadReady(session.lead) && !session.fullManagerNotified) {
    await sendTelegramManager(env, buildFullLeadCard({ user, lead: session.lead, lastText: text, recentHistory: buildRecentClientHistory(session.messages) }));
    session.fullManagerNotified = true;
    session.earlyManagerNotified = true;
    return;
  }
  if (supplementFields.length) {
    const hash = supplementFields.slice().sort().join('|') + '|' + (session.lead.contact || '') + '|' + (session.lead.url || '');
    if (hash !== session.lastSupplementHash) {
      await sendTelegramManager(env, buildSupplementCard({ user, lead: session.lead, lastText: text, supplementLabel: '📎 ДОПОЛНЕНИЕ К ЗАЯВКЕ ИЗ TELEGRAM-БОТА', fields: supplementFields }));
      session.lastSupplementHash = hash;
      session.notifiedFields = { ...(session.notifiedFields || {}) };
      for (const f of supplementFields) session.notifiedFields[f] = true;
    }
  }
  if (shouldNotifyEarlyLead(session.lead, text) && !session.earlyManagerNotified) {
    await sendTelegramManager(env, buildEarlyLeadCard({ user, lead: session.lead, lastText: text, missingFullFields: buildMissingForFullLead(session.lead) }));
    session.earlyManagerNotified = true;
  }
}

function startGreeting() { return ['Здравствуйте. Я AI-оператор A&A Asset Team по первичному разбору активов бизнеса.', '', 'Помогу собрать ключевые данные по объекту и понять следующий шаг для продажи или реализации.', '', 'Мы работаем с зависшими и сложными активами:', '', '1. Производственные базы', '2. Склады и ангары', '3. Коммерческая недвижимость', '4. Оборудование', '5. Спецтехника', '6. Складские остатки', '7. Неликвидные ТМЦ', '8. Имущество после закрытия направлений', '', 'Напишите, что нужно реализовать: что за актив, где находится, примерная площадь или объем, цена и продавался ли объект ранее.'].join('\n'); }

export async function onRequestPost({ request, env }) {
  try {
    if (!env.TELEGRAM_BOT_TOKEN) return jsonResponse({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN' }, 200);
    const update = await request.json();
    const message = getMessage(update);
    const text = getText(update).trim();
    if (!message || !text || message.from?.is_bot) return jsonResponse({ ok: true, skipped: true });

    const chatId = message.chat.id;
    const user = getUser(message.from);
    if (text.startsWith('/start')) {
      await saveSession(env, chatId, emptySession());
      await sendTelegram(env, chatId, startGreeting(), message.message_id);
      return jsonResponse({ ok: true, event: 'command_start' });
    }

    const session = await loadSession(env, chatId);
    const prevLead = { ...(session.lead || {}) };
    const patch = extractPatch(text, session.lead);
    session.lead = mergeLead(session.lead, patch);
    session.messages = [...(session.messages || []), { role: 'client', text, at: new Date().toISOString() }].slice(-20);

    let reply = '';
    const patchKeys = ['asset_type', 'location', 'area', 'price', 'selling_period', 'sale_status', 'role', 'documents', 'photos', 'url', 'contact'];
    const hasLeadPatch = patchKeys.some((k) => Boolean(patch[k]));
    console.log('Telegram category detection:', JSON.stringify({ text, assetType: session.lead.asset_type || '', patch, leadAfter: session.lead, missing: missingFields(session.lead) }));
    if (!hasLeadPatch && env.OPENAI_API_KEY) {
      // fallback via model only when message does not update lead
    }
    reply = buildClarifyingReply(text, session);

    await sendTelegram(env, chatId, reply.trim(), message.message_id);
    session.messages = [...session.messages, { role: 'bot', text: reply, at: new Date().toISOString() }].slice(-20);

    const supplementFields = detectSupplementFields(session, prevLead, session.lead, text);
    await notifyManagerIfNeeded(env, { session, user, text, supplementFields });

    await saveSession(env, chatId, session);
    return jsonResponse({ ok: true, memory: Boolean(env.CHAT_MEMORY) });
  } catch (error) {
    console.error('Telegram webhook error:', error.message);
    return jsonResponse({ ok: false, error: 'telegram_webhook_error', handled_without_retry: true }, 200);
  }
}

export async function onRequestGet() {
  return jsonResponse({ ok: true, mode: 'stateful-dialog-v7-short-category-answers-fixed', memory: 'requires Cloudflare KV binding CHAT_MEMORY' });
}
