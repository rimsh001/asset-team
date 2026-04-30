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
  const explicitLink = env.MAX_BOT_LINK || env.MAX_CONTACT_LINK;

  if (explicitLink) return redirect(explicitLink);

  return jsonResponse({
    ok: false,
    error: 'Missing MAX_BOT_LINK or MAX_CONTACT_LINK in Cloudflare Pages variables'
  }, 500);
}
