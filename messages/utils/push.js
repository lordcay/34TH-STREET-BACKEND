// messages/utils/push.js
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendExpoPush({ to, sound = 'default', title, body, data = {} }) {
  if (!to) throw new Error('Missing Expo push token `to`');
  const payload = { to, sound, title, body, data };

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let json = null;
  try { json = await res.json(); } catch {}

  if (!res.ok) {
    throw new Error(`Expo push failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

module.exports = { sendExpoPush };