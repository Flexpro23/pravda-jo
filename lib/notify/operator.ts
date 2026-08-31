import { SITE } from '@/lib/data/company';
import { markNotified } from '@/lib/store/clients';
import { msisdn, sendText } from '@/lib/notify/whatsapp';
import type { Client } from '@/lib/data/clients';
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

async function deliver(text: string): Promise<Notice> {
  const to = msisdn(operatorPhone());
  const link = to ? `https://wa.me/${to}?text=${encodeURIComponent(text)}` : null;
  if (!to) return { text, link, sent: false, reason: 'no-number' };

  const r = await sendText(to, text);
  return r.sent
    ? { text, link, sent: true }
    : { text, link, sent: false, reason: r.reason, detail: r.detail };
}

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
    const notice = await deliver(text);
    // `failed` shares the ready slot: both mean "the engine is done with this
    // one", and a lead cannot be in both states.
    if (notice.sent) await markNotified(c.id, event === 'new' ? 'new' : 'ready');
    return notice;
  } catch (e) {
    return {
      text, link: null, sent: false, reason: 'failed',
      detail: e instanceof Error ? e.message : 'unknown',
    };
  }
}
