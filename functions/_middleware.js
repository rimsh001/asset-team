const OLD_EMAIL = "bss10@bk.ru";
const NEW_EMAIL = "info@aateam.ru";

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("text/html")) {
    return response;
  }

  const html = await response.text();
  const updatedHtml = html.replaceAll(OLD_EMAIL, NEW_EMAIL);

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
