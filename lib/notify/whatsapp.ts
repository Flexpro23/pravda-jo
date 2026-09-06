/**
 * Telling a provider they have been offered a day.
 *
 * The portal promises «بنبعتلك إشعار لما يصير في شغل» and for a while nothing
 * sent one. This is what makes that true.
 *
 * WhatsApp, because that is where work is arranged in Amman and a provider who
 * has to remember to open a web page will miss a shoot. This is a booked
 * contractor being told about their own booking — not cold outreach, which
 * would breach Meta's Business Messaging Policy and take the whole number down
 * with it.
 *
 * Two modes, and the difference is honest rather than hidden. With a WhatsApp
 * Business number configured, the message sends itself. Without one, `compose`
 * still produces the exact text and a wa.me link, the console shows the booking
 * as un-notified, and a human sends it in one tap. A studio of two people
 * running the second mode is a working system; a studio that believes messages
 * are going out when they are not is a missed shoot.
 */

import type { Booking, Talent } from '@/lib/data/deals';
import { arNum } from '@/lib/format/num';
import { arDate } from '@/lib/format/date';

/**
 * A Jordanian number in the form WhatsApp wants: digits only, country code
 * first, no plus. 07xxxxxxxx is how everyone writes it locally and is not
 * dialable from outside, so it becomes 9627xxxxxxxx.
 */
export function msisdn(raw: string): string | null {
  let n = (raw ?? '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  // 00 is how an international prefix is written on half the business cards in
  // Amman. Left alone it stays a valid-looking string of digits and WhatsApp
  // rejects the send — a silently undelivered booking.
  if (n.startsWith('00')) n = n.slice(2);
  if (/^0\d{9}$/.test(n)) n = `962${n.slice(1)}`;
  else if (/^7\d{8}$/.test(n)) n = `962${n}`;
  return /^\d{8,15}$/.test(n) ? n : null;
}

/**
 * The message itself. Arabic, because the portal is.
 *
 * The link is the bare `${origin}/t` and cannot carry a `?code=` prefill: the
 * pass code is stored hashed, so at the moment a booking is announced nobody —
 * this process included — knows what it is. A prefilled link is only possible
 * at the instant a code is issued, which is a different message from a
 * different screen.
 */
export function compose(b: Booking, t: Talent, origin: string) {
  // null drops out; '' is a deliberate blank line and must survive the filter.
  const lines: (string | null)[] = [
    `مرحبا ${t.name.ar} — في يوم تصوير إلك من برافدا.`,
    '',
    `${arDate(b.date)}${b.callTime ? ` · ${b.callTime}` : ''}`,
    b.location ? `📍 ${b.location}` : null,
    b.brief ? `الشغل: ${b.brief}` : null,
    `الأجرة: ${arNum(b.feeJOD)} دينار`,
    '',
    'اقبل أو اعتذر من هون:',
    `${origin}/t`,
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}

/**
 * The nudge before the day, in the same voice as the offer.
 *
 * Deliberately shorter: they already accepted, so this is a reminder of a
 * commitment rather than an offer of one, and it repeats only what somebody
 * standing up at six in the morning needs — when, where, what time.
 */
export function composeReminder(b: Booking, t: Talent, origin: string) {
  const lines: (string | null)[] = [
    `تذكير ${t.name.ar} — عندك يوم تصوير مع برافدا.`,
    '',
    `${arDate(b.date)}${b.callTime ? ` · ${b.callTime}` : ''}`,
    b.location ? `📍 ${b.location}` : null,
    b.brief ? `الشغل: ${b.brief}` : null,
    '',
    'التفاصيل هون:',
    `${origin}/t`,
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}

/** A link that opens WhatsApp with the message ready to send. */
export const waLink = (phone: string, text: string) => {
  const n = msisdn(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
};

export type NotifyResult =
  | { sent: true }
  | { sent: false; reason: 'unconfigured' | 'no-number' | 'failed'; detail?: string };

/** Where the Cloud API lives. One place, so a version bump moves once. */
const graph = (path: string) =>
  `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}/${path}`;

/**
 * Send a plain message to a number that is already in conversation with us.
 *
 * Free-text is only accepted inside an open 24-hour window; outside one, Meta
 * requires an approved template. That is fine for the operator's own phone,
 * which is the only caller — he messages the business number, so the window is
 * effectively always open. It is NOT fine for talent, which is why
 * `notifyOffer` below sends a template when one is configured.
 *
 * Never throws.
 */
export async function sendText(to: string, body: string): Promise<NotifyResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return { sent: false, reason: 'unconfigured' };

  try {
    const res = await fetch(graph(`${phoneId}/messages`), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'text', text: { body },
      }),
      // Nothing here is worth holding a request open for. A notice that takes
      // longer than four seconds has already failed the person waiting on the
      // response behind it; the fallback is a human tapping send.
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      return { sent: false, reason: 'failed', detail: j?.error?.message ?? `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'failed', detail: e instanceof Error ? e.message : 'unknown' };
  }
}

/**
 * ── The template contract ───────────────────────────────────────────────────
 *
 * Whoever registers these with Meta needs the exact body text before this code
 * ever runs, and the two can silently drift — a template whose parameter order
 * changed on Meta's side still sends, it just sends a fee where a date should
 * be. So the contract is written down here, next to the code that has to obey
 * it, rather than in a spreadsheet.
 *
 * `WHATSAPP_TEMPLATE` — the offer. Category: UTILITY. Language: `ar`.
 * Body, verbatim, three parameters in this order:
 *
 *   مرحبا {{1}} — في يوم تصوير إلك من برافدا يوم {{2}}. الأجرة {{3}} دينار. افتح البرافدا للتفاصيل.
 *
 *   {{1}} the provider's Arabic name   `t.name.ar`
 *   {{2}} the shooting day, spelled    `arDate(b.date)` → "الأحد ٣٠ آب"
 *   {{3}} the fee in dinars, digits    `arNum(b.feeJOD)` → "٥٠"
 *
 * `WHATSAPP_REMINDER_TEMPLATE` — the nudge before an accepted day. Category:
 * UTILITY. Language: `ar`. Body, verbatim, three parameters in this order:
 *
 *   تذكير {{1}} — عندك يوم تصوير مع برافدا يوم {{2}}. المكان {{3}}. افتح البرافدا للتفاصيل.
 *
 *   {{1}} the provider's Arabic name   `t.name.ar`
 *   {{2}} the shooting day, spelled    `arDate(b.date)`
 *   {{3}} where and when               `b.location`/`b.callTime`, or "بنبعتلك التفاصيل"
 *
 * {{3}} is never empty: Meta rejects a template send with a blank parameter,
 * and a booking with no location yet is an ordinary state, not an error.
 *
 * Neither variable is required. With no template name set, both senders fall
 * back to `compose`/`composeReminder` free text, which only lands inside an
 * open 24-hour window — and when nothing at all is configured the console
 * shows the booking as un-notified and a human sends the `wa.me` link.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Send it, if we can.
 *
 * Never throws. A notification that fails must not roll back the booking it was
 * announcing — the day is still offered, it just has to be passed on by hand,
 * and the console says so.
 */
export async function notifyOffer(
  b: Booking, t: Talent, origin: string,
): Promise<NotifyResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const template = process.env.WHATSAPP_TEMPLATE;   // an approved template name

  const to = msisdn(t.phone);
  if (!to) return { sent: false, reason: 'no-number' };
  if (!token || !phoneId) return { sent: false, reason: 'unconfigured' };

  try {
    // Business-initiated messages outside a 24-hour window must be templates,
    // so a template name is required rather than optional in practice; free
    // text is only accepted while a conversation is already open.
    const body = template
      ? {
        messaging_product: 'whatsapp', to, type: 'template',
        template: {
          name: template, language: { code: 'ar' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: t.name.ar },
              { type: 'text', text: arDate(b.date) },
              // Arabic digits: the template body around it is Arabic and a
              // Latin numeral dropped into it is the one visibly foreign thing
              // in the message. `compose` already does this; the template path
              // did not, so the same fee read differently down two channels.
              { type: 'text', text: arNum(b.feeJOD) },
            ],
          }],
        },
      }
      : { messaging_product: 'whatsapp', to, type: 'text', text: { body: compose(b, t, origin) } };

    const res = await fetch(
      `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}/${phoneId}/messages`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        // The booking is already written. Waiting longer than this on Meta only
        // delays the operator seeing that they need to send it by hand.
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      return { sent: false, reason: 'failed', detail: j?.error?.message ?? `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'failed', detail: e instanceof Error ? e.message : 'unknown' };
  }
}

/**
 * The reminder, sent the same way and with the same honesty.
 *
 * Mirrors `notifyOffer` deliberately rather than sharing a body with it: the
 * two templates are registered separately with Meta, carry different
 * parameters, and will drift apart the first time one of them is reworded.
 * Nothing calls this on a schedule — there is no queue. It is an operator's
 * one tap, the day before or the morning of.
 */
export async function notifyReminder(
  b: Booking, t: Talent, origin: string,
): Promise<NotifyResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const template = process.env.WHATSAPP_REMINDER_TEMPLATE;

  const to = msisdn(t.phone);
  if (!to) return { sent: false, reason: 'no-number' };
  if (!token || !phoneId) return { sent: false, reason: 'unconfigured' };

  // Meta rejects a blank template parameter, and a day whose location is not
  // settled yet is an ordinary state — so {{3}} says so rather than being empty.
  const where = [b.location, b.callTime].filter(Boolean).join(' · ') || 'بنبعتلك التفاصيل';

  try {
    const body = template
      ? {
        messaging_product: 'whatsapp', to, type: 'template',
        template: {
          name: template, language: { code: 'ar' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: t.name.ar },
              { type: 'text', text: arDate(b.date) },
              { type: 'text', text: where },
            ],
          }],
        },
      }
      : {
        messaging_product: 'whatsapp', to, type: 'text',
        text: { body: composeReminder(b, t, origin) },
      };

    const res = await fetch(graph(`${phoneId}/messages`), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      return { sent: false, reason: 'failed', detail: j?.error?.message ?? `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'failed', detail: e instanceof Error ? e.message : 'unknown' };
  }
}
