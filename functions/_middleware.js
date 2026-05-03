const SITE_DOMAIN = "https://aateam.ru";
const LEGACY_DOMAIN = "https://asset-team.pages.dev";
const OLD_EMAIL = "bss10@bk.ru";
const NEW_EMAIL = "info@aateam.ru";

const HTML_REPLACEMENTS = [
  [LEGACY_DOMAIN, SITE_DOMAIN],
  [OLD_EMAIL, NEW_EMAIL],
  [`<p class="kicker">SEO-услуга</p>`, ""],
  [`<p class="kicker">SEO услуга</p>`, ""]
];

const applyHtmlFixes = (html) => HTML_REPLACEMENTS.reduce(
  (currentHtml, [from, to]) => currentHtml.replaceAll(from, to),
  html
);

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  const host = requestUrl.hostname.toLowerCase();

  if (host === "www.aateam.ru") {
    requestUrl.protocol = "https:";
    requestUrl.hostname = "aateam.ru";

    return Response.redirect(requestUrl.toString(), 301);
  }

  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("text/html")) {
    return response;
  }

  const html = await response.text();
  const updatedHtml = applyHtmlFixes(html);

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
