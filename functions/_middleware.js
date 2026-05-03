const SITE_HOST = "aateam.ru";
const SITE_ORIGIN = "https://aateam.ru";

const LEGACY_REDIRECTS = [
  [/^\/product\/.*/i, "/"],
  [/^\/collection\/.*/i, "/"],
  [/^\/page\/about-us\/?$/i, "/contacts.html"],
  [/^\/page\/contacts\/?$/i, "/contacts.html"],
  [/^\/page\/terms-of-use\/?$/i, "/privacy.html"],
  [/^\/page\/realizaciya-imushchestva-biznesa\.html$/i, "/realizaciya-imushchestva-biznesa.html"],
  [/^\/page\/prodazha-neprofilnyh-aktivov\.html$/i, "/prodazha-neprofilnyh-aktivov.html"],
  [/^\/page\/prodazha-oborudovaniya\.html$/i, "/prodazha-oborudovaniya.html"],
  [/^\/page\/prodazha-spectehniki\.html$/i, "/prodazha-spectehniki.html"],
  [/^\/page\/prodazha-skladov-angarov\.html$/i, "/prodazha-skladov-angarov.html"],
  [/^\/page\/prodazha-proizvodstvennyh-baz\.html$/i, "/prodazha-proizvodstvennyh-baz.html"],
  [/^\/page\/prodazha-kommercheskoy-nedvizhimosti\.html$/i, "/prodazha-kommercheskoy-nedvizhimosti.html"],
  [/^\/page\/prodazha-skladskih-ostatkov\.html$/i, "/prodazha-skladskih-ostatkov.html"],
  [/^\/page\/realizaciya-nelikvidnyh-tmc\.html$/i, "/realizaciya-nelikvidnyh-tmc.html"],
];

const HTML_REPLACEMENTS = [
  ["https://asset-team.pages.dev", SITE_ORIGIN],
  ["asset-team.pages.dev", SITE_HOST],
  ["bss10@bk.ru", "info@aateam.ru"],
  [`<p class="kicker">SEO-услуга</p>`, ""],
  [`<p class="kicker">SEO услуга</p>`, ""]
];

const NOINDEX_PATHS = new Set(["/thanks.html", "/forms.html"]);

const applyHtmlFixes = (html) => HTML_REPLACEMENTS.reduce((curr, [from, to]) => curr.replaceAll(from, to), html);

function redirectTo(url, status = 301) { return Response.redirect(url, status); }

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname === "asset-team.pages.dev") {
    return redirectTo(`${SITE_ORIGIN}${url.pathname}${url.search}`, 301);
  }

  if (url.protocol === "http:") {
    return redirectTo(`https://${url.host}${url.pathname}${url.search}`, 301);
  }

  for (const [pattern, target] of LEGACY_REDIRECTS) {
    if (pattern.test(url.pathname)) return redirectTo(`${SITE_ORIGIN}${target}`, 301);
  }

  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (NOINDEX_PATHS.has(url.pathname)) headers.set("X-Robots-Tag", "noindex, nofollow");

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("text/html")) return new Response(response.body, { status: response.status, statusText: response.statusText, headers });

  const updatedHtml = applyHtmlFixes(await response.text());
  headers.delete("content-length");
  return new Response(updatedHtml, { status: response.status, statusText: response.statusText, headers });
}
