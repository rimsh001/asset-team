export function getUserInfo(from = {}) {
  const firstName = from.first_name || '';
  const lastName = from.last_name || '';
  return {
    id: from.id,
    fullName: `${firstName} ${lastName}`.trim(),
    username: from.username ? `@${from.username}` : ''
  };
}

export function formatHistory(history) {
  return history
    .map((item) => `[${item.date}] ${item.user.fullName || item.user.username || 'Пользователь'}: ${item.text}`)
    .join('\n');
}

export function formatManagerCard({ user, status, leadCard, managerSummary }) {
  return [
    '📌 НОВАЯ ЗАЯВКА',
    '',
    `Статус: ${status}`,
    `Клиент: ${user.fullName || 'не указано'} ${user.username || ''}`.trim(),
    '',
    `Тип актива: ${leadCard.asset_type || 'не указано'}`,
    `Локация: ${leadCard.location || 'не указано'}`,
    `Кто обратился: ${leadCard.contact_role || 'не указано'}`,
    `Суть задачи: ${leadCard.task_description || 'не указано'}`,
    `Срок продажи: ${leadCard.selling_period || 'не указано'}`,
    `Цена: ${leadCard.current_price || 'не указано'}`,
    `Документы: ${leadCard.documents_status || 'не указано'}`,
    `Фото: ${leadCard.photos_status || 'не указано'}`,
    `Ссылка: ${leadCard.listing_url || 'не указано'}`,
    '',
    `Проблема: ${leadCard.main_problem || 'не указано'}`,
    `Оценка AI: ${leadCard.ai_assessment || 'не указано'}`,
    `Следующий шаг: ${leadCard.recommended_next_step || 'не указано'}`,
    '',
    managerSummary ? `Комментарий AI: ${managerSummary}` : ''
  ].filter(Boolean).join('\n');
}
