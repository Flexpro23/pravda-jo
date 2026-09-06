import type { NotifyResult } from '@/lib/notify/whatsapp';

/**
 * The third try, and the only one that leaves a record anybody can search.
 *
 * A message on a phone is read once and scrolled past; a mailbox is a list of
 * every lead that ever arrived, sorted, searchable, and still there when the
 * phone is replaced. That is why email stays in the cascade below the instant
 * channels rather than being dropped as redundant.
 *
 * Resend rather than SMTP: one `fetch`, no dependency, and no outbound SMTP
 * from Cloud Run to argue with. It is a no-op until the domain is registered —
 * both mailboxes in `.env.example` sit on a domain nobody has bought yet — and
 * saying so plainly is better than a send that fails somewhere invisible.
 *
 * Never throws. Four-second ceiling, same as the others.
 */

const TIMEOUT_MS = 4000;

export async function sendEmail(subject: string, text: string): Promise<NotifyResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = process.env.NOTIFY_EMAIL_TO?.trim();
  const from = process.env.NOTIFY_EMAIL_FROM?.trim();
  if (!key || !to || !from) return { sent: false, reason: 'unconfigured' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      // Plain text, not HTML. These are three-line operational notes with a
      // link at the bottom; wrapping them in markup would make them look like
      // marketing to every spam filter between here and the mailbox.
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      return {
        sent: false, reason: 'failed',
        detail: j?.message ?? j?.name ?? `HTTP ${res.status}`,
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
