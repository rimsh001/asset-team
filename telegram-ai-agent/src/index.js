import { Telegraf } from 'telegraf';
import { config } from './config.js';
import { analyzeMessage } from './ai.js';
import { appendLead, ensureSheetHeaders } from './sheets.js';
import { addMessage } from './store.js';
import { formatHistory, formatManagerCard, getUserInfo } from './format.js';

const bot = new Telegraf(config.telegramBotToken);

function nowIso() {
  return new Date().toISOString();
}

function isTextMessage(ctx) {
  return Boolean(ctx.message && 'text' in ctx.message && ctx.message.text);
}

bot.start((ctx) => {
  ctx.reply('Бот активен. Добавьте меня в группу и отключите privacy mode через BotFather, чтобы я видел сообщения группы.');
});

bot.command('ping', (ctx) => ctx.reply('pong'));

bot.on('message', async (ctx) => {
  if (!isTextMessage(ctx)) return;

  const messageText = ctx.message.text.trim();
  if (!messageText || messageText.startsWith('/')) return;

  const user = getUserInfo(ctx.from);
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const date = nowIso();

  const history = addMessage({ chatId, userId, user, text: messageText, date });

  try {
    const aiResult = await analyzeMessage({
      messageText,
      history,
      user,
      chat: {
        id: chatId,
        title: ctx.chat.title || '',
        type: ctx.chat.type
      }
    });

    if (aiResult.should_send_client_reply && aiResult.client_reply) {
      await ctx.reply(`${config.botReplyPrefix}${aiResult.client_reply}`.trim(), {
        reply_to_message_id: ctx.message.message_id
      });
    }

    if (aiResult.should_create_card) {
      const fullHistory = formatHistory(history);
      const managerCard = formatManagerCard({
        user,
        status: aiResult.status,
        leadCard: aiResult.lead_card,
        managerSummary: aiResult.manager_summary
      });

      const targetChatId = config.managerChatId || chatId;
      await ctx.telegram.sendMessage(targetChatId, managerCard);

      await appendLead({
        date,
        user,
        chatId,
        status: aiResult.status,
        leadCard: aiResult.lead_card,
        fullHistory
      });
    }
  } catch (error) {
    console.error('Bot processing error:', error);
    await ctx.reply('Заявку увидел, но не смог обработать автоматически. Андрей, проверьте сообщение вручную.');
  }
});

async function main() {
  await ensureSheetHeaders();
  await bot.launch();
  console.log('Telegram AI asset manager bot started');
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
