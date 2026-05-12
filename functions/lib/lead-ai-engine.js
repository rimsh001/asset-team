export const HEALTHCHECK_MODE = 'stateful-dialog-v8-ai-lead-engine';

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export function normalize(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е');
}

export function hasCallIntent(text = '') {
  const t = normalize(text);
  return ['жду звонка', 'позвоните', 'готов обсудить', 'жду связи', 'можно звонить', 'свяжитесь', 'наберите'].some((w) => t.includes(w));
}
