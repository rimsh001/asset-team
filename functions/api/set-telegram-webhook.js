function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return jsonResponse({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN' }, 500);
  }

  const url = new URL(request.url);
  const webhookUrl = url.searchParams.get('url');
  const secret = url.searchParams.get('secret');

  if (env.SET_WEBHOOK_SECRET && secret !== env.SET_WEBHOOK_SECRET) {
    return jsonResponse({ ok: false, error: 'Invalid secret' }, 403);
  }

  if (!webhookUrl) {
    return jsonResponse({
      ok: false,
      error: 'Missing url query parameter',
      example: `${url.origin}/api/set-telegram-webhook?url=${url.origin}/api/telegram-webhook&secret=your_secret`
    }, 400);
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'edited_message']
    })
  });

  const data = await response.json();
  return jsonResponse(data, response.ok ? 200 : 500);
}
