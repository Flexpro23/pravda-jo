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

const AR_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثا', 'الأربعا', 'الخميس', 'الجمعة', 'السبت'];
const arNum = (s: string | number) =>
  String(s).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);

const arDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(+d)) return iso;
  return `${AR_DAYS[d.getDay()]} ${arNum(d.getDate())} ${AR_MONTHS[d.getMonth()]}`;
};

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

/** The message itself. Arabic, because the portal is. */
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
              { type: 'text', text: String(b.feeJOD) },
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
