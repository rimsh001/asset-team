const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const pick = (data, key) => String(data.get(key) || '').trim();

const buildTelegramMessage = (data) => {
  const rows = [
    ['Имя', pick(data, 'name')],
    ['Контакт', pick(data, 'phone')],
    ['Email', pick(data, 'email')],
    ['Тип актива', pick(data, 'asset_type')],
    ['Город / регион', pick(data, 'region')],
    ['Стоимость', pick(data, 'value')],
    ['Сколько продаётся', pick(data, 'sale_period')],
    ['Описание', pick(data, 'description')],
    ['Согласие', pick(data, 'personal_data_consent')]
  ].filter(([, value]) => value);

  return [
    '<b>Новая заявка с сайта A&amp;A Asset Team</b>',
    '',
    ...rows.map(([label, value]) => `<b>${escapeHtml(label)}:</b> ${escapeHtml(value)}`)
  ].join('\n');
};

const sendToTelegram = async (env, message) => {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  if (!env.TELEGRAM_CHAT_ID) throw new Error('TELEGRAM_CHAT_ID is not configured');

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${errorText}`);
  }
};

const sendToFormspree = async (env, data) => {
  if (!env.FORMSPREE_ENDPOINT) return;

  const payload = new FormData();
  for (const [key, value] of data.entries()) {
    if (key !== 'bot-field' && key !== 'form-name') payload.append(key, value);
  }

  const response = await fetch(env.FORMSPREE_ENDPOINT, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: payload
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Formspree API error ${response.status}: ${errorText}`);
  }
};

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const thanksUrl = `${url.origin}/thanks.html`;
  const errorUrl = `${url.origin}/?form=error#request`;

  try {
    const data = await request.formData();

    if (pick(data, 'bot-field')) {
      return Response.redirect(thanksUrl, 303);
    }

    const requiredFields = ['name', 'phone', 'asset_type', 'region', 'description', 'personal_data_consent'];
    const hasMissingRequired = requiredFields.some((field) => !pick(data, field));

    if (hasMissingRequired) {
      return Response.redirect(`${url.origin}/?form=missing#request`, 303);
    }

    const message = buildTelegramMessage(data);

    await sendToTelegram(env, message);
    await sendToFormspree(env, data);

    return Response.redirect(thanksUrl, 303);
  } catch (error) {
    console.error(error);
    return Response.redirect(errorUrl, 303);
  }
}

export async function onRequestGet({ env }) {
  return Response.json({
    ok: true,
    message: 'Lead function is active',
    telegramBotTokenConfigured: Boolean(env.TELEGRAM_BOT_TOKEN),
    telegramChatIdConfigured: Boolean(env.TELEGRAM_CHAT_ID),
    formspreeConfigured: Boolean(env.FORMSPREE_ENDPOINT)
  });
}
