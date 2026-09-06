import { SITE } from '@/lib/data/company';
import { markNotified } from '@/lib/store/clients';
import { msisdn, sendText } from '@/lib/notify/whatsapp';
import { sendTelegram } from '@/lib/notify/telegram';
import { sendEmail } from '@/lib/notify/email';
import type { Client, NotifyChannel } from '@/lib/data/clients';
import { FAILURE_NOTE } from '@/lib/data/clients';

/**
 * Telling Khaled something happened.
 *
 * Two moments, and they answer different questions. A new lead means somebody
 * wants us and there is a person on the other end expecting a reply. A ready
 * report means there is something on his screen to review. Sending one message
 * covering both would arrive before the read had finished, which is the one
 * time it is useless.
 *
 * It runs in the same honest two modes the talent notifier does. With a
 * WhatsApp Business number configured, it sends. Without one — which is the
 * state today — it composes the exact text and a wa.me link, records nothing as
 * sent, and the console shows the lead as un-notified with a one-tap button.
 * A dashboard that believes messages went out when they did not is how a lead
 * sits for three days.
 *
 * Never throws. A read that succeeded must not be reported as failed because
 * the message about it did not send.
 */

/**
 * Who gets told. Khaled runs production, so it is his phone and not the
 * studio's published line — that one is answered by whoever is nearest.
 */
const operatorPhone = () =>
  (process.env.OPERATOR_PHONE || process.env.NEXT_PUBLIC_CONTACT_PHONE || '').trim();

export type Notice = {
  /** The message as it would be sent, so the console can show it verbatim. */
  text: string;
  /** A link that opens WhatsApp with it ready. Null when there is no number. */
  link: string | null;
  sent: boolean;
  /** Why it did not send. Shown in the console rather than swallowed. */
  reason?: 'unconfigured' | 'no-number' | 'failed';
  detail?: string;
  /**
   * Which channel carried it — or `manual`, meaning none did and a human has a
   * link to tap. `sent: true` with `channel: 'telegram'` is a different fact
   * from `sent: true` with `channel: 'whatsapp'`, and the console shows which.
   */
  channel?: NotifyChannel;
  /**
   * Everything that was tried and did not work, in order.
   *
   * This is the row that makes a dead WhatsApp window visible: the message
   * still arrived, but it arrived by the second route, and nobody would ever
   * have known if the failure had simply been swallowed by the success.
   */
  tried?: { channel: NotifyChannel; reason: string }[];
};

const line = (parts: (string | null)[]) =>
  parts.filter((p): p is string => p !== null).join('\n');

/** Somebody handed over their handle. */
export function composeNewLead(c: Client): string {
  return line([
    'عميل جديد على برافدا 👋',
    '',
    `${c.contactName} — @${c.handle}`,
    `☎ ${c.contactPhone}`,
    c.website ? `🔗 ${c.website}` : null,
    '',
    'عم نقرأ حسابهم هلق. بنعلمك لما يجهز التقرير.',
    `${SITE}/ops/clients/${c.id}`,
  ]);
}

/** The engine finished and there is a sheet to review. */
export function composeReady(c: Client, sheetToken: string, findings: number): string {
  return line([
    `التقرير جاهز — ${c.businessName || `@${c.handle}`} ✅`,
    '',
    `${findings} ملاحظة، وخمس أفكار مقترحة.`,
    `تواصل: ${c.contactName} · ${c.contactPhone}`,
    '',
    'راجعها واختار ٣ أفكار قبل ما تنبعت:',
    `${SITE}/ops/sheet/${sheetToken}`,
  ]);
}

/**
 * The read could not finish.
 *
 * A third message, and it is the one that most needs sending: a lead whose read
 * failed looks identical to a lead nobody has got to yet, and the most common
 * cause — a personal account — is fixed by one message pointing at a page we
 * already built.
 */
export function composeFailed(c: Client): string {
  const note = c.readError ? FAILURE_NOTE[c.readError] : null;
  return line([
    `ما قدرنا نقرأ حساب ${c.contactName} ⚠️`,
    '',
    `@${c.handle} · ${c.contactPhone}`,
    note ? note.what : 'The read did not complete.',
    note ? note.do_ : null,
    '',
    `${SITE}/ops/clients/${c.id}`,
  ]);
}

/**
 * Try every way we have of reaching him, in order, and stop at the first that
 * works.
 *
 * The order is not preference, it is reliability. WhatsApp is first only
 * because it is where he already is — but it goes dark outside a 24-hour window
 * he has to open himself, so it cannot be the only one. Telegram has no window
 * and is the recommended permanent home for operator notices. Email is slower
 * to read and the only one that is still searchable next quarter. And when none
 * of them is configured, nothing is pretended: the text and a `wa.me` link come
 * back with `sent: false`, the console shows the lead as un-notified, and a
 * human finishes it in one tap. A dashboard that believes messages went out
 * when they did not is how a lead sits for three days.
 *
 * Every sender here is bounded at four seconds and never throws, because this
 * now runs before the public form's response.
 */
async function deliver(text: string, subject: string): Promise<Notice> {
  const to = msisdn(operatorPhone());
  const link = to ? `https://wa.me/${to}?text=${encodeURIComponent(text)}` : null;
  const tried: { channel: NotifyChannel; reason: string }[] = [];

  const note = (channel: NotifyChannel, reason: string, detail?: string) =>
    tried.push({ channel, reason: detail ? `${reason}: ${detail}` : reason });

  // Skipped entirely when unconfigured, so the common case — no channel set at
  // all — costs zero network I/O and this whole function is microseconds.
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
    if (!to) note('whatsapp', 'no-number');
    else {
      const r = await sendText(to, text);
      if (r.sent) return { text, link, sent: true, channel: 'whatsapp', tried };
      note('whatsapp', r.reason, r.detail);
    }
  }

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const r = await sendTelegram(text);
    if (r.sent) return { text, link, sent: true, channel: 'telegram', tried };
    note('telegram', r.reason, r.detail);
  }

  if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL_TO) {
    const r = await sendEmail(subject, text);
    if (r.sent) return { text, link, sent: true, channel: 'email', tried };
    note('email', r.reason, r.detail);
  }

  return {
    text, link, sent: false, channel: 'manual',
    // Nothing was even attempted → the deployment is unconfigured (or has no
    // number to fall back on), which is a different problem from a send that
    // was tried and refused.
    reason: tried.length ? 'failed' : (to ? 'unconfigured' : 'no-number'),
    detail: tried.length ? tried.map((t) => `${t.channel} ${t.reason}`).join('; ') : undefined,
    tried,
  };
}

/** A subject line for the one channel that needs one. Never a contact detail. */
const subjectFor = (event: 'new' | 'ready' | 'failed', c: Client) =>
  event === 'new' ? `PRAVDA — new lead @${c.handle}`
    : event === 'ready' ? `PRAVDA — teardown ready @${c.handle}`
      : `PRAVDA — read failed @${c.handle}`;

/**
 * Tell him, and record it only if it actually went.
 *
 * `markNotified` is called on success alone. An un-notified lead in the console
 * is a job somebody can finish in one tap; a lead marked notified that never
 * was is invisible.
 */
export async function tellOperator(
  event: 'new' | 'ready' | 'failed',
  c: Client,
  extra?: { sheetToken?: string; findings?: number },
): Promise<Notice> {
  const text = event === 'new' ? composeNewLead(c)
    : event === 'ready' ? composeReady(c, extra?.sheetToken ?? '', extra?.findings ?? 0)
      : composeFailed(c);

  try {
    const notice = await deliver(text, subjectFor(event, c));
    // `failed` shares the ready slot: both mean "the engine is done with this
    // one", and a lead cannot be in both states.
    if (notice.sent) {
      await markNotified(c.id, event === 'new' ? 'new' : 'ready', notice.channel);
    }
    console.log(JSON.stringify({
      msg: notice.sent ? 'notify.sent' : 'notify.skipped',
      event, clientId: c.id, channel: notice.channel,
      reason: notice.reason,
      tried: notice.tried?.map((t) => `${t.channel}:${t.reason}`),
    }));
    return notice;
  } catch (e) {
    return {
      text, link: null, sent: false, reason: 'failed', channel: 'manual',
      detail: e instanceof Error ? e.message : 'unknown',
    };
  }
}
