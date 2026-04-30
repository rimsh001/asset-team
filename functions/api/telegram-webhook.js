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

const BUSINESS_KNOWLEDGE = `
Позиционирование: «Превращаем зависшие активы бизнеса в деньги».
A&A Asset Team помогает собственникам продавать базы, склады, коммерческую недвижимость, оборудование, спецтехнику, складские остатки и неликвидные ТМЦ, которые долго не находят покупателя.

Главная логика: не просто разместить объявление, а разобрать актив как сделку: кто может купить, что мешает покупке, какие риски видит покупатель, какие документы нужны, как упаковать объект, где искать целевой спрос и как вести переговоры.

Почему активы зависают: завышена или не объяснена цена; непонятен целевой покупатель; слабые фото; нет технического описания; документы не собраны; объект размещен не там; продавец ждет случайного звонка; нет прямого поиска; не сняты риски покупателя; переговоры сводятся к торгу.

Производственная база: важны земля, строения, назначение земли, коммуникации, отопление, электричество, вода, канализация, подъезд, арендаторы, состояние, документы, кадастровые номера, ограничения, сценарии использования.

Склад или ангар: важны площадь, высота, ворота, полы, отопление, подъезд фур, охрана, электричество, локация, арендаторы, документы, ставка аренды, возможность продажи или сдачи.

Коммерческая недвижимость: важны назначение, трафик, арендный поток, окупаемость, документы, состояние, ограничения, ликвидность локации, сценарии покупателя.

Оборудование и спецтехника: важны марка, модель, год, наработка, состояние, комплектность, фото, видео работы, документы, демонтаж, погрузка, доставка, цена аналога.

Складские остатки и ТМЦ: важны список позиций, объем, состояние, срок хранения, цена по балансу, минимальная партия, возможность продажи частями, целевой сегмент покупателей.

Аренда вместо продажи: если клиент не хочет продавать, а думает о сдаче, нужно оценить арендопригодность: локация, подъезд, инженерия, отопление, состояние, площадь, ставка, потенциальный арендатор, вложения до сдачи. Иногда аренда лучше продажи, если объект дает поток; иногда продажа лучше, если требуются вложения или спрос слабый.

Формат работы: первичный разбор → сбор материалов → диагностика цены, упаковки и спроса → стратегия продажи или аренды → упаковка объекта → поиск покупателя или арендатора → переговоры → условия договора.

Договор обсуждается после понимания объекта, объема работы и формата сопровождения. Нельзя обещать сделку до диагностики.
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
  if (value.includes('участ') || value.includes('земл')) return 'земельный участок';
  if (value.includes('оборуд')) return 'оборудование';
  if (value.includes('техник') || value.includes('погруз') || value.includes('кран') || value.includes('экскават')) return 'спецтехника';
  if (value.includes('тмц') || value.includes('остат') || value.includes('неликвид')) return 'складские остатки / ТМЦ';
  if (value.includes('недвиж') || value.includes('офис') || value.includes('помещ')) return 'коммерческая недвижимость';
  return 'не определено';
}

function isLikelyLead(text) {
  const value = normalizeText(text);
  const assetWords = ['база', 'склад', 'ангар', 'участ', 'земля', 'оборуд', 'техник', 'погруз', 'кран', 'тмц', 'остат', 'неликвид', 'недвиж', 'офис', 'помещ'];
  return assetWords.some((word) => value.includes(word));
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
    main_problem: normalizeText(text).includes('аренд') ? 'клиент рассматривает аренду или консультацию' : 'требуется уточнить цель: продажа, аренда или консультация',
    ai_assessment: 'Заявка из Telegram-бота. Нужно квалифицировать объект, цель обращения, роль клиента, документы, фото/ссылку и возможный формат работы.',
    recommended_next_step: 'Связаться с клиентом, уточнить цель, запросить материалы и провести первичный разбор.',
    telegram_user: `${user.fullName || ''} ${user.username || ''}`.trim(),
    chat_id: String(chatId)
  };
}

function systemPrompt(managerName) {
  return `
Ты — AI-оператор по разбору активов для A&A Asset Team.
Ты общаешься с клиентом в Telegram как живой сильный первичный менеджер, а не как автоответчик.

${BUSINESS_KNOWLEDGE}

Правила диалога:
1. Отвечай именно на последнее сообщение клиента.
2. Не повторяй один и тот же шаблон.
3. Если клиент задает вопрос — сначала ответь на вопрос, потом мягко веди к следующему шагу.
4. Если клиент хочет консультацию, а не продажу — предложи разбор вариантов: продать, сдать в аренду, подержать, подготовить к продаже.
5. Если объект еще не выставлялся — объясни, что это хорошо для правильной подготовки упаковки и каналов.
6. Если спрашивает «как работаете» — дай этапы работы.
7. Если спрашивает «когда позвонят» — попроси удобное время и контакт.
8. Если спрашивает про договор — объясни, что договор после первичного разбора и выбора формата.
9. Если дал объект — задай только самые важные вопросы по его типу.
10. Не обещай продажу, не гарантируй цену, не давай юридическое заключение.

Формат ответа: обычный текст для Telegram, без таблиц, не длиннее 900 символов.
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
        { role: 'user', content: JSON.stringify({ message_from_client: text, telegram_user: user, telegram_chat: chat, instruction: 'Ответь клиенту как живой профессиональный менеджер по реализации сложных активов. Не повторяй шаблон. Учитывай контекст бизнеса.' }, null, 2) }
      ],
      temperature: 0.65,
      max_output_tokens: 800
    })
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text || '';
}

function fallbackReply(text) {
  const value = normalizeText(text);

  if (value.includes('не хочу прод') || value.includes('проконсульт') || value.includes('сдам') || value.includes('аренд')) {
    return 'Понял. Тогда задача не обязательно в продаже — можно разобрать, что выгоднее: продать, сдать в аренду или сначала подготовить объект. Для аренды важно понять локацию, площадь, состояние, отопление/электричество, подъезд и кто может быть арендатором. Напишите, пожалуйста, что за имущество и где оно находится.';
  }

  if (value.includes('еще не выстав') || value.includes('не выставлял')) {
    return 'Это нормальная ситуация. Если объект еще не выставлялся, лучше сначала подготовить его правильно: определить целевого покупателя или арендатора, собрать ключевые характеристики, фото, документы и понять стартовую цену. Что за имущество и в каком регионе находится?';
  }

  if (value.includes('когда позвон')) {
    return 'После первичного разбора специалист сможет связаться с вами предметно, а не просто задать общие вопросы. Напишите, пожалуйста, удобное время для звонка и номер телефона, если он отличается от Telegram.';
  }

  if (value.includes('как работает')) {
    return 'Работа строится по этапам: сначала разбираем имущество и цель — продажа, аренда или консультация. Потом смотрим документы, фото, цену, спрос и слабые места. После этого предлагаем маршрут: как упаковать объект, кому он может быть нужен, где искать покупателя или арендатора и какой формат работы подходит.';
  }

  if (value.includes('договор')) {
    return 'Договор имеет смысл обсуждать после первичного разбора. Сначала нужно понять объект, объем работы и формат: консультация, упаковка, поиск покупателя/арендатора или полное сопровождение. После этого условия можно зафиксировать письменно.';
  }

  if (value.includes('сколько') || value.includes('комисс') || value.includes('стоим')) {
    return 'Стоимость зависит от задачи. Одно дело — консультация и разбор, другое — упаковка объекта, поиск покупателя или полное сопровождение сделки. Сначала нужно понять имущество, его цену, документы и сложность продажи/аренды, затем можно назвать формат и условия.';
  }

  if (isLikelyLead(text)) {
    const type = detectAssetType(text);
    if (type.includes('база')) {
      return 'Понял, речь о базе. Для первичного разбора важно понять: земля и строения в собственности или аренде, какая площадь, есть ли отопление, электричество, подъезд, документы и фото. Также важно: вы хотите продать, сдать в аренду или пока сравнить варианты?';
    }
    return 'Понял. По такому имуществу сначала нужно определить цель: продать, сдать в аренду или получить консультацию. Дальше смотрим цену, документы, фото, состояние и потенциального покупателя/арендатора. Пришлите, пожалуйста, регион, ориентировочную цену и есть ли материалы по объекту.';
  }

  return 'Понял вас. Уточните, пожалуйста, что именно за имущество, где оно находится и какая цель сейчас: продать, сдать в аренду или получить консультацию по дальнейшей стратегии.';
}

async function sendTelegramMessage(env, chatId, text, replyToMessageId) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_to_message_id: replyToMessageId || undefined, disable_web_page_preview: true })
  });
  if (!response.ok) throw new Error(`Telegram sendMessage error: ${response.status} ${await response.text()}`);
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

async function handleStart(env, message) {
  const chatId = message.chat.id;
  const hello = [
    'Здравствуйте. Я AI-оператор по разбору активов.',
    '',
    'Помогу быстро собрать информацию по вашему имуществу и понять, какой следующий шаг нужен для его реализации.',
    '',
    'Напишите, пожалуйста, одним сообщением:',
    '1. Что хотите реализовать или сдать в аренду?',
    '2. Где находится имущество?',
    '3. Какая ориентировочная цена или желаемая аренда?',
    '4. Продавали или сдавали уже раньше?',
    '5. Есть ли фото, документы или ссылка на объявление?',
    '',
    'После этого я зафиксирую заявку и помогу определить следующий шаг: консультация, продажа, аренда или подготовка объекта.'
  ].join('\n');

  await sendTelegramMessage(env, chatId, hello, message.message_id);
  return jsonResponse({ ok: true, command: 'start' });
}

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN) return jsonResponse({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN' }, 200);

  const update = await request.json();
  const message = getMessage(update);
  const text = getText(update).trim();

  if (!message || !text) return jsonResponse({ ok: true, skipped: true, reason: 'empty message' });
  if (message.from?.is_bot) return jsonResponse({ ok: true, skipped: true, reason: 'bot message ignored' });
  if (text.startsWith('/start')) return handleStart(env, message);
  if (text.startsWith('/')) return jsonResponse({ ok: true, skipped: true, reason: 'command ignored' });

  const user = getUser(message.from);
  const chatId = message.chat.id;
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
      const managerCard = formatManagerCard({ user, status: 'новая / требуется квалификация', leadCard, sourceText: text });
      await sendTelegramMessage(env, env.MANAGER_CHAT_ID || chatId, managerCard);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('Telegram webhook processing error:', error.message);
    return jsonResponse({ ok: false, error: error.message, handled_without_retry: true }, 200);
  }
}

export async function onRequestGet() {
  return jsonResponse({ ok: true, service: 'telegram-ai-operator-cloudflare-pages', mode: 'live-manager-dialog-v3' });
}
