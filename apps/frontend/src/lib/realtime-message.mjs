export function upsertMessageById(messages, message) {
  return messages.some((existing) => existing.id === message.id) ? messages : [...messages, message];
}
