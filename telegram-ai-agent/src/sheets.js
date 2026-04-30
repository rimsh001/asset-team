import { google } from 'googleapis';
import { config } from './config.js';

const HEADERS = [
  'Дата и время',
  'Telegram имя',
  'Username',
  'Chat ID',
  'Статус',
  'Тип актива',
  'Локация',
  'Кто обратился',
  'Описание задачи',
  'Срок продажи',
  'Текущая цена',
  'Документы',
  'Фото',
  'Ссылка на объявление',
  'Главная проблема',
  'Оценка AI',
  'Следующий шаг',
  'Полный текст переписки'
];

function isSheetsEnabled() {
  return Boolean(config.googleSheetId && config.googleServiceAccountEmail && config.googlePrivateKey);
}

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({ version: 'v4', auth });
}

export async function ensureSheetHeaders() {
  if (!isSheetsEnabled()) return false;
  const sheets = getSheetsClient();
  const range = `${config.googleSheetTab}!A1:R1`;
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetId,
    range
  }).catch(() => null);

  const current = result?.data?.values?.[0] || [];
  if (current.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.googleSheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] }
    });
  }
  return true;
}

export async function appendLead({ date, user, chatId, status, leadCard, fullHistory }) {
  if (!isSheetsEnabled()) return false;
  const sheets = getSheetsClient();

  const row = [
    date,
    user.fullName || '',
    user.username || '',
    String(chatId),
    status || '',
    leadCard.asset_type || '',
    leadCard.location || '',
    leadCard.contact_role || '',
    leadCard.task_description || '',
    leadCard.selling_period || '',
    leadCard.current_price || '',
    leadCard.documents_status || '',
    leadCard.photos_status || '',
    leadCard.listing_url || '',
    leadCard.main_problem || '',
    leadCard.ai_assessment || '',
    leadCard.recommended_next_step || '',
    fullHistory || ''
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetId,
    range: `${config.googleSheetTab}!A:R`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });

  return true;
}
