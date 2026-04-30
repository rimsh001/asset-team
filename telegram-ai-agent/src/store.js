const sessions = new Map();

function key(chatId, userId) {
  return `${chatId}:${userId}`;
}

export function addMessage({ chatId, userId, user, text, date }) {
  const sessionKey = key(chatId, userId);
  const history = sessions.get(sessionKey) || [];
  history.push({ user, text, date });
  const trimmed = history.slice(-30);
  sessions.set(sessionKey, trimmed);
  return trimmed;
}

export function getHistory({ chatId, userId }) {
  return sessions.get(key(chatId, userId)) || [];
}
