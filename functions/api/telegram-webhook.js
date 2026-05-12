import { GREETING_TEXT, emptySession, processLeadMessage, detectSupplementFields, isFullLeadReady, shouldNotifyEarlyLead, buildEarlyLeadCard, buildFullLeadCard, buildSupplementCard } from '../lib/lead-ai-engine.js';

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const sessionKey = (chatId) => `tg-lead:${chatId}`;
const getMessage = (u) => u?.message || null;
const getText = (u) => u?.message?.text || '';
const getUser = (from={}) => ({ id: from.id || '', fullName: [from.first_name, from.last_name].filter(Boolean).join(' '), username: from.username ? `@${from.username}` : '' });
async function loadSession(env, chatId){ if(!env.CHAT_MEMORY) return emptySession(); const raw=await env.CHAT_MEMORY.get(sessionKey(chatId)); if(!raw) return emptySession(); try{return { ...emptySession(), ...JSON.parse(raw) };}catch{return emptySession();}}
async function saveSession(env, chatId, session){ if(env.CHAT_MEMORY) await env.CHAT_MEMORY.put(sessionKey(chatId), JSON.stringify(session), { expirationTtl: 1209600 }); }
async function sendTelegram(env, chatId, text, replyTo){ const r=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text,reply_to_message_id:replyTo||undefined,disable_web_page_preview:true})}); if(!r.ok) throw new Error(`Telegram send ${r.status}`); }
const sendManager = async (env, text) => env.MANAGER_CHAT_ID ? sendTelegram(env, env.MANAGER_CHAT_ID, text) : null;

async function notify(env, session, user, text, supplementFields){
  if(isFullLeadReady(session.lead) && !session.fullManagerNotified){ await sendManager(env, buildFullLeadCard({ channel:'TELEGRAM', user, lead:session.lead, lastText:text })); session.fullManagerNotified=true; session.earlyManagerNotified=true; return; }
  if(supplementFields.length){ const hash=`${supplementFields.sort().join('|')}|${session.lead.contact||''}|${session.lead.url||''}`; if(hash!==session.lastSupplementHash){ await sendManager(env, buildSupplementCard({ channel:'TELEGRAM', user, lead:session.lead, lastText:text, fields:supplementFields })); session.lastSupplementHash=hash; session.notifiedFields={...(session.notifiedFields||{})}; supplementFields.forEach((f)=>{session.notifiedFields[f]=true;}); } }
  if(shouldNotifyEarlyLead(session.lead) && !session.earlyManagerNotified){ await sendManager(env, buildEarlyLeadCard({ channel:'TELEGRAM', user, lead:session.lead, lastText:text })); session.earlyManagerNotified=true; }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.TELEGRAM_BOT_TOKEN) return jsonResponse({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN' }, 200);
    const update = await request.json(); const message = getMessage(update); const text = getText(update).trim();
    if (!message || !text || message.from?.is_bot) return jsonResponse({ ok: true, skipped: true });
    const chatId = message.chat.id; const user = getUser(message.from);
    if (text.startsWith('/start')) { await saveSession(env, chatId, emptySession()); await sendTelegram(env, chatId, GREETING_TEXT, message.message_id); return jsonResponse({ ok: true, event: 'command_start' }); }
    const session = await loadSession(env, chatId); const prevLead = { ...(session.lead || {}) };
    session.messages = [...(session.messages||[]), { role:'client', text, at:new Date().toISOString() }].slice(-20);
    const { reply } = await processLeadMessage(env, { session, text, channel: 'telegram', user });
    await sendTelegram(env, chatId, reply, message.message_id);
    session.messages = [...session.messages, { role:'bot', text:reply, at:new Date().toISOString() }].slice(-20);
    const supplementFields = detectSupplementFields(session, prevLead, session.lead, text);
    await notify(env, session, user, text, supplementFields);
    await saveSession(env, chatId, session);
    return jsonResponse({ ok: true, memory: Boolean(env.CHAT_MEMORY) });
  } catch (error) { console.error('Telegram webhook error:', error.message); return jsonResponse({ ok: false, error: 'telegram_webhook_error', handled_without_retry: true }, 200); }
}
export async function onRequestGet(){ return jsonResponse({ ok:true, mode:'stateful-dialog-v8-ai-lead-engine', memory:'requires Cloudflare KV binding CHAT_MEMORY' }); }
