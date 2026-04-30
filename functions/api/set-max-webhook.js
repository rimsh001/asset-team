function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.MAX_BOT_TOKEN) {
    return jsonResponse({ ok: false, error: 'Missing MAX_BOT_TOKEN' }, 500);
  }

  const url = new URL(request.url);
  const webhookUrl = env.MAX_WEBHOOK_URL || `${url.origin}/api/max-webhook`;
  const secret = env.MAX_WEBHOOK_SECRET || undefined;

  const body = {
    url: webhookUrl,
    update_types: ['message_created', 'bot_started']
  };

  if (secret) body.secret = secret;

  const response = await fetch('https://platform-api.max.ru/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: env.MAX_BOT_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  return jsonResponse({
    ok: response.ok,
    status: response.status,
    webhook_url: webhookUrl,
    update_types: body.update_types,
    max_response: data
  }, response.ok ? 200 : 500);
}
