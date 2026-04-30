function redirect(location) {
  return Response.redirect(location, 302);
}

export async function onRequestGet({ env }) {
  const fallbackLink = 'https://max.ru/id380119910292_bot?start=site_asset_request';
  const explicitLink = env.MAX_BOT_LINK || env.MAX_CONTACT_LINK || fallbackLink;

  return redirect(explicitLink);
}
