import OpenAI from 'openai';
import { config } from './config.js';
import { SYSTEM_PROMPT, RESPONSE_SCHEMA } from './prompt.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export async function analyzeMessage({ messageText, history, user, chat }) {
  const input = [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: JSON.stringify({
        instruction: 'Проанализируй новое сообщение в Telegram-группе. Определи, заявка ли это. Если заявка — подготовь короткий ответ клиенту и/или карточку заявки.',
        new_message: messageText,
        conversation_history: history.slice(-12),
        telegram_user: user,
        telegram_chat: chat,
        manager_name: config.managerName
      }, null, 2)
    }
  ];

  const response = await openai.responses.create({
    model: config.openaiModel,
    input,
    temperature: 0.2,
    text: {
      format: {
        type: 'json_schema',
        ...RESPONSE_SCHEMA
      }
    }
  });

  const raw = response.output_text;
  return JSON.parse(raw);
}
