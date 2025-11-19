const bannedWords = require('./bannedWords');

function containsObjectionableContent(text = "") {
  const lowerText = text.toLowerCase();
  return bannedWords.some(word => lowerText.includes(word));
}

module.exports = containsObjectionableContent;