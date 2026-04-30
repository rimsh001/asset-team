function redirect(location) {
  return Response.redirect(location, 302);
}

export async function onRequestGet({ env }) {
  const explicitLink = env.TELEGRAM_BOT_LINK;
  const username = env.TELEGRAM_BOT_USERNAME || '@asset_team_bot';
  const payload = env.TELEGRAM_START_PAYLOAD || 'site_asset_request';

  if (explicitLink) return redirect(explicitLink);

  const cleanUsername = username.replace('@', '').trim();
  return redirect(`https://t.me/${cleanUsername}?start=${encodeURIComponent(payload)}`);
}
