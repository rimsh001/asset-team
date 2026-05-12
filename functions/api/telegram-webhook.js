const KNOWLEDGE = `
A&A Asset Team: «Превращаем зависшие активы бизнеса в деньги».
Работаем с продажей сложного и зависшего имущества бизнеса: производственные базы, склады, ангары, промышленные участки, коммерческая недвижимость, оборудование, спецтехника, складские остатки и неликвидные ТМЦ.

Важно: мы не занимаемся арендой и подбором арендаторов. Если клиент спрашивает про аренду, корректно объясни, что наш профиль — продажа и реализация активов, но можно разобрать, имеет ли смысл готовить объект к продаже.

Подход: не просто размещаем объявление, а разбираем актив как сделку: кто может купить, что мешает покупке, какие риски видит покупатель, какие документы нужны, как упаковать объект, где искать целевой спрос и как вести переговоры.
`;

function jsonResponse(data, status = 200) { return new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8' } }); }
const normalize = (text) => String(text || '').toLowerCase().replace(/ё/g, 'е');
const getMessage = (u) => u?.message || u?.edited_message || null;
const getText = (u) => u?.message?.text || u?.edited_message?.text || '';
const getUser = (f = {}) => ({ id: f.id || '', fullName: `${f.first_name || ''} ${f.last_name || ''}`.trim(), username: f.username ? `@${f.username}` : '' });
const sessionKey = (chatId) => `telegram-lead:${chatId}`;

function emptySession() { return { lead: {}, messages: [], earlyManagerNotified: false, fullManagerNotified: false, notifiedFields: {}, lastSupplementHash: '' }; }
async function loadSession(env, chatId) { if (!env.CHAT_MEMORY) return emptySession(); const raw = await env.CHAT_MEMORY.get(sessionKey(chatId)); if (!raw) return emptySession(); try { const p = JSON.parse(raw); const legacy = Boolean(p?.managerNotified); return { lead: p?.lead || {}, messages: Array.isArray(p?.messages) ? p.messages : [], earlyManagerNotified: Boolean(p?.earlyManagerNotified) || legacy, fullManagerNotified: Boolean(p?.fullManagerNotified), notifiedFields: p?.notifiedFields || {}, lastSupplementHash: p?.lastSupplementHash || '' }; } catch { return emptySession(); } }
async function saveSession(env, chatId, session) { if (env.CHAT_MEMORY) await env.CHAT_MEMORY.put(sessionKey(chatId), JSON.stringify(session), { expirationTtl: 60 * 60 * 24 * 14 }); }

function detectAssetType(text) { const t = normalize(text); if (t.includes('производствен') || t.includes('база')) return 'производственная база'; if (t.includes('склад') || t.includes('ангар')) return 'склад / ангар'; if (t.includes('участ') || t.includes('земл')) return 'земельный участок'; if (t.includes('оборуд')) return 'оборудование'; if (t.includes('спецтех') || t.includes('техник') || t.includes('погруз') || t.includes('кран') || t.includes('экскават')) return 'спецтехника'; if ((t.includes('складск') && t.includes('остат')) || t.includes('остатки')) return 'складские остатки'; if (t.includes('неликвид') || t.includes('тмц')) return 'неликвидные ТМЦ'; if ((t.includes('имуществ') && t.includes('закрыт')) || t.includes('закрытие направления') || t.includes('активы после оптимизации')) return 'имущество после закрытия направления'; if (t.includes('помещ') || t.includes('офис') || t.includes('недвиж')) return 'коммерческая недвижимость'; return ''; }
function extractPatch(text, session = {}) { const t = normalize(text); const p = {}; const lead = session?.lead || {}; const at = detectAssetType(text); if (at) p.asset_type = at; if (t.includes('прод')) p.goal = 'продажа'; if (t.includes('консульт')) p.goal = 'консультация по продаже / стратегии реализации';
  if (/(^|\b)(я\s+)?собственник(\b|$)/.test(t)) p.role = 'собственник';
  if (/(^|\b)(я\s+)?представитель(\b|$)/.test(t) || t.includes('работаю от собственника')) p.role = 'представитель';
  if (t.includes('фото')) p.photos = 'есть / упомянуты'; if (t.includes('документ')) p.documents = 'документы упомянуты';
  const locationRules = [
    { re: /(^|\s)(москва|в москве|москве|мск)(\s|$)/, value: 'Москва' },
    { re: /(московская область|(^|\s)мо(\s|$)|подмосковье|подмосков)/, value: 'Московская область' },
    { re: /(^|\s)(спб|санкт[-\s]?петербург)(\s|$)/, value: 'Санкт-Петербург' },
    { re: /(^|\s)ангарск(\s|$)/, value: 'Ангарск' },
    { re: /(^|\s)иркутск(\s|$)/, value: 'Иркутск' }
  ];
  for (const rule of locationRules) { if (rule.re.test(t)) { p.location = rule.value; break; } }
  const period = text.match(/(?:\d+\s*(?:год|года|лет|месяц|месяца|месяцев)|полгода|уже\s*год|год\s*продается)/i)?.[0]; if (period && !lead.selling_period) p.selling_period = period;
  const areaWithUnits = text.match(/\d+[\d\s,.]*(?:м2|м²|кв\.?\s*м|сот|га)/i)?.[0];
  const price = text.match(/\d+[\d\s,.]*(?:млн|тыс|руб|₽)/i)?.[0] || text.match(/\b\d{1,3}(?:[\s,.]\d{3}){1,3}\b/)?.[0];
  if (price && !lead.price) p.price = price.trim();
  const numericTokens = [...text.matchAll(/\b\d{2,5}\b/g)].map((m) => m[0]);
  if (areaWithUnits) p.area = areaWithUnits.trim();
  if (!p.area && numericTokens.length && (lead.asset_type || p.asset_type) && (!lead.area || /площад|объем/.test(t))) {
    const filtered = numericTokens.filter((n) => !(p.price || '').includes(n));
    const areaNumber = filtered[0] || numericTokens[0];
    if (areaNumber) p.area = `${areaNumber} м² / объем уточнить`;
  }
  const url = text.match(/https?:\/\/\S+/)?.[0]; if (url) p.url = url;
  const phone = text.match(/(?:\+7|7|8)\D{0,3}\(?\d{3}\)?\D{0,3}\d{3}\D{0,3}\d{2}\D{0,3}\d{2}/)?.[0];
  const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0];
  if (phone || email) p.contact = [phone, email].filter(Boolean).join(', ');
  return p;
}

const mergeLead = (a, b) => ({ ...(a || {}), ...(b || {}) });
function missingFields(lead = {}) { const m = []; if (!lead.asset_type) m.push('что именно продается'); if (!lead.location) m.push('где находится объект'); if (!lead.area) m.push('площадь / объем'); if (!lead.price) m.push('ориентировочная цена'); if (!lead.selling_period) m.push('сколько времени продается'); if (!lead.documents) m.push('что с документами'); if (!lead.photos && !lead.url) m.push('есть ли фото или ссылка на объявление'); if (!lead.role) m.push('вы собственник или представитель'); if (!lead.contact) m.push('удобный контакт для связи'); return m; }
const hasAssetContext = (lead, text) => Boolean(lead.asset_type || detectAssetType(text));
const isFullLeadReady = (lead) => Boolean(lead.asset_type && lead.location && lead.area && lead.price && lead.selling_period && lead.role);
const shouldNotifyEarlyLead = (lead, text) => Boolean(hasAssetContext(lead, text) && lead.asset_type && (lead.location || lead.price || lead.area || lead.url));
const hasCallIntent = (text = '') => ['жду звонка', 'позвоните', 'готов обсудить', 'жду связи', 'можно звонить', 'свяжитесь', 'наберите'].some((w) => normalize(text).includes(w));

function systemPrompt() { return `
Ты — AI-оператор A&A Asset Team по первичному разбору и диагностике активов бизнеса.
Ты не просто собираешь анкету. Ты проводишь первичную диагностику актива: что продается, где находится, почему зависло, какие данные нужны для оценки ликвидности и подготовки маршрута реализации.

${KNOWLEDGE}

Правила:
1. Учитывай уже собранные данные и историю диалога.
2. Не задавай повторно вопрос, если клиент уже ответил.
3. Если клиент пишет коротко — это продолжение диалога.
4. Не предлагай аренду: компания ей не занимается.
5. Если клиент спрашивает про аренду, корректно верни фокус к продаже/реализации.
6. Не обещай продажу, не гарантируй цену, не давай юридическое заключение.
7. Веди к следующему шагу: материалы, первичный разбор, созвон, формат работы, договор.
8. Если уже понятны тип актива и город, не останавливайся: аккуратно добери площадь, цену, срок продажи, документы, роль клиента и удобный контакт.
9. Не задавай более 2-3 вопросов за одно сообщение.
10. Если клиент дал контакт, подтверди передачу специалисту.

Ответ: обычный текст для Telegram, до 700 символов.
`; }

async function askOpenAI(env, { text, session, user }) { const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: env.OPENAI_MODEL || 'gpt-4.1-mini', input: [{ role: 'system', content: systemPrompt() }, { role: 'user', content: JSON.stringify({ current_message: text, collected_data: session.lead, missing_fields: missingFields(session.lead), recent_history: session.messages.slice(-8), telegram_user: user }, null, 2) }], temperature: 0.45, max_output_tokens: 600 }) }); if (!r.ok) throw new Error(await r.text()); const d = await r.json(); return d.output_text || d.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text || ''; }

function buildClarifyingReply(session, text = '') { const t = normalize(text); const missing = missingFields(session.lead || {}); if (t.includes('аренд') || t.includes('сдам') || t.includes('сдать')) return 'Арендой мы не занимаемся. Наш профиль — продажа и реализация сложных активов. Можем посмотреть объект с точки зрения продажи: насколько он ликвиден, что мешает покупателю, какие материалы нужны и какой маршрут реализации выбрать.'; if (hasCallIntent(text) && session.lead.contact) return 'Принял. Передаю информацию на разбор. Специалист свяжется с вами по указанному контакту.'; if (session.lead.contact) return 'Принял контакт. Передаю информацию на разбор. Специалист свяжется с вами.'; if (hasCallIntent(text) && !session.lead.contact) return 'Принял. Оставьте, пожалуйста, удобный телефон или другой контакт для связи — передам информацию специалисту.'; if (hasAssetContext(session.lead, text)) { if (!missing.length) return 'Данных достаточно для первичной фиксации. Передаю информацию на разбор. Следующий шаг — посмотреть материалы по объекту: фото, документы или ссылку на объявление, если сможете прислать.'; return `Принял, дополнил данные по объекту. Осталось уточнить:\n${missing.slice(0, 3).map((item, i) => `${i + 1}. ${item}?`).join('\n')}`; } return `Понял. Уточните, пожалуйста, к какой категории относится актив:\n\n1. Производственная база\n2. Склад или ангар\n3. Коммерческая недвижимость\n4. Оборудование\n5. Спецтехника\n6. Складские остатки\n7. Неликвидные ТМЦ\n8. Имущество после закрытия направления\n\nМожно ответить коротко: например, «склад», «оборудование», «база» или описать объект своими словами.`; }

async function sendTelegram(env, chatId, text, replyTo) { const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, reply_to_message_id: replyTo || undefined, disable_web_page_preview: true }) }); if (!r.ok) throw new Error(`Telegram sendMessage failed ${r.status}: ${await r.text()}`); }
async function sendManager(env, text) { if (!env.MANAGER_CHAT_ID) return; await sendTelegram(env, env.MANAGER_CHAT_ID, text); }
function startGreeting() { return ['Здравствуйте. Я AI-оператор A&A Asset Team по первичному разбору активов бизнеса.', '', 'Помогу собрать ключевые данные по объекту и понять следующий шаг для продажи или реализации.', '', 'Мы работаем с зависшими и сложными активами:', '', '1. Производственные базы', '2. Склады и ангары', '3. Коммерческая недвижимость', '4. Оборудование', '5. Спецтехника', '6. Складские остатки', '7. Неликвидные ТМЦ', '8. Имущество после закрытия направлений', '', 'Напишите, что нужно реализовать: что за актив, где находится, примерная площадь или объем, цена и сколько времени уже продается.'].join('\n'); }

function buildMissingForFullLead(lead = {}) { const m = []; if (!lead.asset_type) m.push('тип актива'); if (!lead.location) m.push('локация'); if (!lead.area) m.push('площадь / объем'); if (!lead.price) m.push('цена'); if (!lead.selling_period) m.push('срок продажи'); if (!lead.role) m.push('кто обратился'); return m; }
function buildRecentClientHistory(messages = []) { const c = (messages || []).filter((x) => x.role === 'client').slice(-5); if (!c.length) return 'не указано'; return c.map((x, i) => `${i + 1}) ${x.text}`).join('\n'); }
function buildEarlyLeadCard({ user, lead, lastText, missingFullFields }) { return ['🟡 РАННИЙ ЛИД ИЗ TELEGRAM-БОТА', '', 'Клиент обозначил актив. Бот продолжает добирать данные. Полноценная заявка придет отдельным сообщением.', '', `Клиент: ${user.fullName || 'не указано'} ${user.username || ''}`.trim(), `Telegram user_id: ${user.id || 'не указано'}`, `Тип актива: ${lead.asset_type || 'не указано'}`, `Локация: ${lead.location || 'не указано'}`, `Площадь / объем: ${lead.area || 'не указано'}`, `Цена: ${lead.price || 'не указано'}`, `Срок продажи: ${lead.selling_period || 'не указано'}`, `Фото / ссылка: ${lead.photos || lead.url || 'не указано'}`, `Документы: ${lead.documents || 'не указано'}`, `Кто обратился: ${lead.role || 'не указано'}`, `Контакт: ${lead.contact || 'не указано'}`, '', `Последнее сообщение: ${lastText}`, `Не хватает до полной заявки: ${missingFullFields.length ? missingFullFields.join(', ') : 'ключевые поля собраны'}`].join('\n'); }
function buildFullLeadCard({ user, lead, lastText, recentHistory }) { return ['✅ ПОЛНАЯ ЗАЯВКА ИЗ TELEGRAM-БОТА', '', `Клиент: ${user.fullName || 'не указано'} ${user.username || ''}`.trim(), `Telegram user_id: ${user.id || 'не указано'}`, `Тип актива: ${lead.asset_type || 'не указано'}`, `Локация: ${lead.location || 'не указано'}`, `Площадь / объем: ${lead.area || 'не указано'}`, `Цена: ${lead.price || 'не указано'}`, `Срок продажи: ${lead.selling_period || 'не указано'}`, `Фото / ссылка: ${lead.photos || lead.url || 'не указано'}`, `Документы: ${lead.documents || 'не указано'}`, `Кто обратился: ${lead.role || 'не указано'}`, `Контакт: ${lead.contact || 'не указано'}`, '', `Последнее сообщение: ${lastText}`, '', 'Краткая история последних сообщений клиента:', recentHistory, '', 'Следующий шаг: связаться с клиентом, запросить материалы и провести первичный разбор.'].join('\n'); }
function buildSupplementCard({ user, lead, lastText, fields }) { return ['📎 ДОПОЛНЕНИЕ К ЗАЯВКЕ ИЗ TELEGRAM-БОТА', '', `Клиент: ${user.fullName || 'не указано'} ${user.username || ''}`.trim(), `Telegram user_id: ${user.id || 'не указано'}`, `Новые данные: ${fields.join(', ')}`, fields.includes('contact') ? `Контакт: ${lead.contact || 'не указано'}` : '', fields.includes('url') ? `URL: ${lead.url || 'не указано'}` : '', fields.includes('documents') ? `Документы: ${lead.documents || 'не указано'}` : '', fields.includes('photos') ? `Фото: ${lead.photos || 'не указано'}` : '', fields.includes('call_intent') ? 'Клиент ожидает звонок/связь.' : '', '', 'Текущая карточка лида:', `Тип актива: ${lead.asset_type || 'не указано'}`, `Локация: ${lead.location || 'не указано'}`, `Площадь / объем: ${lead.area || 'не указано'}`, `Цена: ${lead.price || 'не указано'}`, `Срок продажи: ${lead.selling_period || 'не указано'}`, `Кто обратился: ${lead.role || 'не указано'}`, '', `Последнее сообщение: ${lastText}`].filter(Boolean).join('\n'); }
function detectSupplementFields(session, prev, next, text) { if (!session.fullManagerNotified) return []; const n = session.notifiedFields || {}; const f = []; if (!prev.contact && next.contact && !n.contact) f.push('contact'); if (!prev.url && next.url && !n.url) f.push('url'); if (!prev.documents && next.documents && !n.documents) f.push('documents'); if (!prev.photos && next.photos && !n.photos) f.push('photos'); if (hasCallIntent(text) && !n.call_intent && !n.contact) f.push('call_intent'); return f; }

export async function onRequestPost({ request, env }) { try { if (!env.TELEGRAM_BOT_TOKEN) return jsonResponse({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN' }, 200); const update = await request.json(); const message = getMessage(update); const text = getText(update).trim(); if (!message || !text) return jsonResponse({ ok: true, skipped: true }); if (message.from?.is_bot) return jsonResponse({ ok: true, skipped: true }); const chatId = message.chat.id; const user = getUser(message.from);
  if (text.startsWith('/start')) { await saveSession(env, chatId, emptySession()); await sendTelegram(env, chatId, startGreeting(), message.message_id); return jsonResponse({ ok: true, event: 'start' }); }
  if (text.startsWith('/')) return jsonResponse({ ok: true, skipped: true });
  const session = await loadSession(env, chatId); const prevLead = { ...(session.lead || {}) }; const patch = extractPatch(text, session); session.lead = mergeLead(session.lead, patch); const missing = missingFields(session.lead); console.log('Telegram lead patch:', JSON.stringify({ text, patch, lead: session.lead, missing })); const prev = { ...prevLead }; session.messages = [...(session.messages || []), { role: 'client', text, at: new Date().toISOString() }].slice(-20);
  const patchKeys = ['asset_type','location','area','price','selling_period','role','documents','photos','url','contact'];
  const hasLeadPatch = patchKeys.some((k) => Boolean(patch[k]));
  let reply = ''; if (!hasLeadPatch && env.OPENAI_API_KEY) { try { reply = await askOpenAI(env, { text, session, user }); } catch (e) { console.error('OpenAI fallback:', e.message); } }
  if (!reply) reply = buildClarifyingReply(session, text);
  await sendTelegram(env, chatId, reply.trim(), message.message_id);
  if (isFullLeadReady(session.lead) && !session.fullManagerNotified) { await sendManager(env, buildFullLeadCard({ user, lead: session.lead, lastText: text, recentHistory: buildRecentClientHistory(session.messages) })); session.fullManagerNotified = true; session.earlyManagerNotified = true; }
  const sup = detectSupplementFields(session, prev, session.lead, text); if (sup.length) { const hash = sup.slice().sort().join('|') + '|' + (session.lead.contact || '') + '|' + (session.lead.url || ''); if (hash !== session.lastSupplementHash) { await sendManager(env, buildSupplementCard({ user, lead: session.lead, lastText: text, fields: sup })); session.lastSupplementHash = hash; session.notifiedFields = { ...(session.notifiedFields || {}) }; for (const x of sup) session.notifiedFields[x] = true; } }
  if (shouldNotifyEarlyLead(session.lead, text) && !session.earlyManagerNotified) { await sendManager(env, buildEarlyLeadCard({ user, lead: session.lead, lastText: text, missingFullFields: buildMissingForFullLead(session.lead) })); session.earlyManagerNotified = true; }
  session.messages = [...session.messages, { role: 'bot', text: reply, at: new Date().toISOString() }].slice(-20); await saveSession(env, chatId, session); return jsonResponse({ ok: true, memory: Boolean(env.CHAT_MEMORY) }); } catch (error) { console.error('Telegram webhook processing error:', error?.message || error); return jsonResponse({ ok: false, error: 'telegram_webhook_error' }, 200); } }

export async function onRequestGet() { return jsonResponse({ ok: true, mode: 'stateful-dialog-v4-telegram-matches-max-flow', memory: 'requires Cloudflare KV binding CHAT_MEMORY' }); }
