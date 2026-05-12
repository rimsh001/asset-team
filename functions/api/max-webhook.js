import { GREETING_TEXT, emptySession, processLeadMessage, detectSupplementFields, isFullLeadReady, shouldNotifyEarlyLead, buildEarlyLeadCard, buildFullLeadCard, buildSupplementCard } from '../lib/lead-ai-engine.js';

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const sessionKey=(chatId,userId)=>`max-lead:${chatId||userId}`;
const getMessage=(u)=>u?.message||null; const getText=(u)=>u?.message?.body?.text||'';
const getChatId=(u)=>u?.message?.recipient?.chat_id||u?.chat_id||u?.message?.chat_id||null; const getUserId=(u)=>u?.message?.sender?.user_id||u?.user?.user_id||u?.user_id||null;
const getUser=(u)=>{const s=u?.message?.sender||u?.user||{}; return {id:s.user_id||u?.user_id||'',fullName:`${s.first_name||''} ${s.last_name||''}`.trim()||s.name||'',username:s.username?`@${s.username}`:''};};
async function loadSession(env,chatId,userId){ if(!env.CHAT_MEMORY)return emptySession(); const raw=await env.CHAT_MEMORY.get(sessionKey(chatId,userId)); if(!raw)return emptySession(); try{return {...emptySession(),...JSON.parse(raw)};}catch{return emptySession();}}
async function saveSession(env,chatId,userId,session){ if(env.CHAT_MEMORY) await env.CHAT_MEMORY.put(sessionKey(chatId,userId),JSON.stringify(session),{expirationTtl:1209600}); }
async function sendMax(env,{chatId,userId,text}){ const url=new URL('https://platform-api.max.ru/messages'); if(chatId)url.searchParams.set('chat_id',String(chatId)); else if(userId)url.searchParams.set('user_id',String(userId)); const r=await fetch(url.toString(),{method:'POST',headers:{Authorization:env.MAX_BOT_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({text,notify:true,disable_link_preview:true})}); if(!r.ok) throw new Error(`MAX send ${r.status}`); }
async function sendManager(env,text){ if(!env.TELEGRAM_BOT_TOKEN||!env.MANAGER_CHAT_ID) return; await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:env.MANAGER_CHAT_ID,text,disable_web_page_preview:true})}); }
async function notify(env,session,user,text,supplementFields){ if(isFullLeadReady(session.lead)&&!session.fullManagerNotified){ await sendManager(env,buildFullLeadCard({channel:'MAX',user,lead:session.lead,lastText:text})); session.fullManagerNotified=true; session.earlyManagerNotified=true; return; } if(supplementFields.length){ const hash=`${supplementFields.sort().join('|')}|${session.lead.contact||''}|${session.lead.url||''}`; if(hash!==session.lastSupplementHash){ await sendManager(env,buildSupplementCard({channel:'MAX',user,lead:session.lead,lastText:text,fields:supplementFields})); session.lastSupplementHash=hash; session.notifiedFields={...(session.notifiedFields||{})}; supplementFields.forEach((f)=>{session.notifiedFields[f]=true;}); } } if(shouldNotifyEarlyLead(session.lead)&&!session.earlyManagerNotified){ await sendManager(env,buildEarlyLeadCard({channel:'MAX',user,lead:session.lead,lastText:text})); session.earlyManagerNotified=true; }}

export async function onRequestPost({ request, env }) {
  if (!env.MAX_BOT_TOKEN) return jsonResponse({ ok: false, error: 'Missing MAX_BOT_TOKEN' }, 200);
  if (env.MAX_WEBHOOK_SECRET && request.headers.get('X-Max-Bot-Api-Secret') !== env.MAX_WEBHOOK_SECRET) return jsonResponse({ ok: false, error: 'Invalid MAX webhook secret' }, 200);
  const update = await request.json(); const updateType = update.update_type || update.type; const message = getMessage(update); const text = getText(update).trim(); const chatId = getChatId(update); const userId = getUserId(update); const user = getUser(update);
  try {
    if (updateType === 'bot_started' || text.startsWith('/start')) { await saveSession(env, chatId, userId, emptySession()); await sendMax(env, { chatId, userId, text: GREETING_TEXT }); return jsonResponse({ ok: true, event: 'start' }); }
    if (updateType !== 'message_created' || !message || !text || message.sender?.is_bot) return jsonResponse({ ok: true, skipped: true, update_type: updateType });
    const session=await loadSession(env,chatId,userId); const prevLead={...(session.lead||{})}; session.messages=[...(session.messages||[]),{role:'client',text,at:new Date().toISOString()}].slice(-20);
    const { reply } = await processLeadMessage(env,{session,text,channel:'max',user});
    await sendMax(env,{chatId,userId,text:reply}); session.messages=[...session.messages,{role:'bot',text:reply,at:new Date().toISOString()}].slice(-20);
    const supplementFields=detectSupplementFields(session,prevLead,session.lead,text); await notify(env,session,user,text,supplementFields);
    await saveSession(env,chatId,userId,session); return jsonResponse({ ok: true, memory: Boolean(env.CHAT_MEMORY) });
  } catch (error) { console.error('MAX webhook error:', error.message); return jsonResponse({ ok: false, error: 'max_webhook_error', handled_without_retry: true }, 200); }
}
export async function onRequestGet(){ return jsonResponse({ ok:true, mode:'stateful-dialog-v8-ai-lead-engine', memory:'requires Cloudflare KV binding CHAT_MEMORY' }); }
