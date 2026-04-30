import 'dotenv/config';

const required = ['TELEGRAM_BOT_TOKEN', 'OPENAI_API_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env variable: ${key}`);
  }
}

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  managerChatId: process.env.MANAGER_CHAT_ID || null,
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  googleSheetId: process.env.GOOGLE_SHEET_ID || null,
  googleSheetTab: process.env.GOOGLE_SHEET_TAB || 'Leads',
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null,
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : null,
  botReplyPrefix: process.env.BOT_REPLY_PREFIX || '',
  managerName: process.env.COMPANY_MANAGER_NAME || 'Андрей',
};
