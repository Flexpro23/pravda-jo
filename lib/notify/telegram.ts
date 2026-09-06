import type { NotifyResult } from '@/lib/notify/whatsapp';

/**
 * The channel that actually works today.
 *
 * WhatsApp free-text to Khaled's own number only sends inside a 24-hour window
 * that *he* has to open by messaging the business number. It is fine for talent
 * — they get an approved template — but for operator notices it means the
 * system stops telling him things after a quiet day, silently, and the failure
 * is discovered by finding a two-day-old lead nobody answered.
 *
 * A Telegram bot has no window, no business verification and no template
 * approval: BotFather, a token, a chat id, one HTTPS POST. Ten minutes of setup
 * for the one thing in this system that has somebody waiting on the other end.
 *
 * Never throws, and gives up after four seconds — this now runs *before* the
 * lead form's response, so a hung upstream would hold a stranger's form open.
 */

const TIMEOUT_MS = 4000;

export async function sendTelegram(text: string): Promise<NotifyResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return { sent: false, reason: 'unconfigured' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Previews left on: every one of these messages ends in a link to the
      // console, and seeing where it goes before tapping it is the point.
      body: JSON.stringify({
        chat_id: chatId, text, disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      return {
        sent: false, reason: 'failed',
        detail: j?.description ?? `HTTP ${res.status}`,
      };
    }
    return { sent: true };
  } catch (e) {
    return {
      sent: false, reason: 'failed',
      detail: e instanceof Error ? e.message : 'unknown',
    };
  }
}
