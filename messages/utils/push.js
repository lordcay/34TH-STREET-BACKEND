// messages/utils/push.js
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Validate Expo push token format.
 * Both ExponentPushToken[...] and ExpoPushToken[...] are valid.
 */
function isValidExpoPushToken(token) {
  return (
    typeof token === 'string' &&
    (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
  );
}

/**
 * Send push notifications via Expo Push API.
 * Accepts a single token string or an array of tokens for batch delivery.
 *
 * iOS-required fields included:
 *   - _contentAvailable: true  → wakes app in background (silent push + visible)
 *   - mutableContent: true     → allows notification service extension to enrich
 *   - ttl: 86400               → 24-hour delivery window if device is offline
 *   - badge                    → update app badge count
 *
 * @param {object} opts
 * @param {string|string[]} opts.to          - Expo push token(s)
 * @param {string}          opts.title       - Notification title
 * @param {string}          opts.body        - Notification body text
 * @param {object}          [opts.data]      - Custom payload data (for tapping/routing)
 * @param {string}          [opts.sound]     - 'default' or sound file name
 * @param {string}          [opts.channelId] - Android notification channel
 * @param {string}          [opts.priority]  - 'high' | 'normal' (default: 'high')
 * @param {number}          [opts.badge]     - iOS badge count (omit to leave unchanged)
 * @param {number}          [opts.ttl]       - Seconds to retain if device offline (default: 86400)
 */
async function sendExpoPush({
  to,
  sound = 'default',
  title,
  body,
  data = {},
  channelId = 'messages',
  priority = 'high',
  badge,
  ttl = 86400,
}) {
  if (!to) throw new Error('Missing Expo push token `to`');

  // Support single token or array
  const tokens = Array.isArray(to) ? to : [to];
  const validTokens = tokens.filter(isValidExpoPushToken);

  if (validTokens.length === 0) {
    console.log('⚠️ No valid Expo push tokens — skipping push');
    return null;
  }

  // Build one message object per token (Expo batch format)
  const messages = validTokens.map(token => ({
    to: token,
    sound,
    title,
    body,
    data,
    channelId,
    priority,
    ttl,
    // iOS-critical: deliver to background/killed app
    _contentAvailable: true,
    // iOS: allow Notification Service Extension to process before display
    mutableContent: true,
    // Badge count (only included if caller passes it)
    ...(badge !== undefined && badge !== null ? { badge } : {}),
  }));

  // Expo accepts a single object or an array of up to 100 messages
  const requestBody = messages.length === 1 ? messages[0] : messages;

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  let json = null;
  try { json = await res.json(); } catch {}

  if (!res.ok) {
    throw new Error(`Expo push failed: ${res.status} ${JSON.stringify(json)}`);
  }

  const results = Array.isArray(json?.data) ? json.data : [json?.data];
  results.forEach((r, i) => {
    if (r?.status === 'error') {
      console.error(`❌ Push delivery error for token[${i}]:`, r.message, r.details);
    } else {
      console.log('📬 Push sent:', { to: validTokens[i]?.slice(0, 35), title, status: r?.status || 'ok' });
    }
  });

  return json;
}

module.exports = { sendExpoPush, isValidExpoPushToken };