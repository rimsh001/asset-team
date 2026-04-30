function redirect(location) {
  return Response.redirect(location, 302);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestGet({ env }) {
  const explicitLink = env.TELEGRAM_BOT_LINK;
  const username = env.TELEGRAM_BOT_USERNAME;
  const payload = env.TELEGRAM_START_PAYLOAD || 'site_asset_request';

  if (explicitLink) return redirect(explicitLink);

  if (!username) {
    return jsonResponse({
      ok: false,
      error: 'Missing TELEGRAM_BOT_USERNAME or TELEGRAM_BOT_LINK in Cloudflare Pages variables'
    }, 500);
  }

  const cleanUsername = username.replace('@', '').trim();
  return redirect(`https://t.me/${cleanUsername}?start=${encodeURIComponent(payload)}`);
}
