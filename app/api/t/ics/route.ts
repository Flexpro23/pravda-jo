import { currentTalent } from '@/lib/talent/auth';
import { publicOrigin } from '@/lib/origin';
import { bookingsForTalent } from '@/lib/store/deals';
import type { Booking } from '@/lib/data/deals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A provider's own shooting days, as a calendar file.
 *
 * Somebody juggling PRAVDA against three other clients should not be retyping
 * dates off a web page into a phone. This is the pull half of that: they tap
 * "أضف للتقويم" on the portal and the days land in whatever calendar the phone
 * already uses. Nothing is pushed, and no invitation is sent — an .ics is a
 * text file, not a scheduling system.
 *
 * It takes no parameters at all. The session is the only input, so there is no
 * id to tamper with and no way to ask for somebody else's calendar. Accepted,
 * done and paid days are included: a provider's calendar is also their record
 * of what they worked, and a day that has happened is not less true than one
 * that has not. Offered days are left out on purpose — an offer they have not
 * answered is not yet a commitment, and putting it in their calendar would
 * quietly answer for them.
 *
 * No dependency: an ICS file is a handful of lines, and the studio's rule about
 * document-generation libraries holds here as it does for the printed documents.
 */

/** Jordan is UTC+3 all year — no DST since 2022 — so a fixed offset is exact. */
const AMMAN_OFFSET_MIN = 180;
/** A shoot day with a call time, absent an end time, is booked as a working day. */
const DEFAULT_HOURS = 8;

const pad = (n: number) => String(n).padStart(2, '0');

const stampUTC = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
  + `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/**
 * RFC 5545 §3.3.11: a backslash, a semicolon, a comma and a newline all have to
 * be escaped inside a text value, or a location with a comma in it silently
 * becomes two properties.
 *
 * A bare carriage return counts as a line break too. A brief pasted out of
 * Windows-authored notes carries CRLF, and escaping only the LF half left a
 * literal CR sitting mid-value — which ends the content line early and turns
 * the rest of the brief into a property name the calendar cannot parse. Both
 * halves collapse to one `\\n`, which is what the field means.
 */
const esc = (s: string) =>
  s.replace(/\\/g, '\\\\')
    .replace(/\r\n?/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');

/**
 * §3.1: no content line may exceed 75 octets. Arabic is two to four bytes a
 * character, so a brief that looks short is not — the fold has to count bytes
 * and then continue with a leading space.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Never split a UTF-8 sequence: back off to the last lead byte.
    while (end > start && end < bytes.length && (bytes[end] & 0xC0) === 0x80) end--;
    out.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74;                       // continuation lines carry a leading space
  }
  return out.join('\r\n ');
}

function vevent(b: Booking, domain: string): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${b.id}@${domain}`,
    `DTSTAMP:${stampUTC(new Date())}`,
  ];

  const hhmm = /^(\d{1,2}):(\d{2})$/.exec((b.callTime ?? '').trim());
  if (hhmm) {
    // Amman local, written as UTC rather than with a TZID — a TZID that has no
    // VTIMEZONE block beside it is exactly the thing calendar apps disagree about.
    const [, h, m] = hhmm;
    const startMs = Date.parse(`${b.date}T00:00:00Z`)
      + (Number(h) * 60 + Number(m) - AMMAN_OFFSET_MIN) * 60_000;
    lines.push(`DTSTART:${stampUTC(new Date(startMs))}`);
    lines.push(`DTEND:${stampUTC(new Date(startMs + DEFAULT_HOURS * 3600_000))}`);
  } else {
    // All-day. DTEND is exclusive, so a one-day event ends on the next date.
    const endMs = Date.parse(`${b.date}T00:00:00Z`) + 86_400_000;
    lines.push(`DTSTART;VALUE=DATE:${b.date.replace(/-/g, '')}`);
    lines.push(`DTEND;VALUE=DATE:${new Date(endMs).toISOString().slice(0, 10).replace(/-/g, '')}`);
  }

  lines.push(`SUMMARY:${esc(b.brief || 'يوم تصوير · PRAVDA')}`);
  if (b.location) lines.push(`LOCATION:${esc(b.location)}`);
  // The fee is theirs and only theirs, so it may travel; the client's price has
  // no field on a booking and therefore cannot reach this file even by mistake.
  lines.push(`DESCRIPTION:${esc(`الأجرة: ${b.feeJOD} دينار`)}`);
  lines.push('END:VEVENT');
  return lines;
}

export async function GET(req: Request) {
  const me = await currentTalent();
  if (!me) return new Response('unauthenticated', { status: 401 });

  let bookings: Booking[] = [];
  try { bookings = await bookingsForTalent(me.id); } catch { /* an empty calendar, not a 500 */ }
  const mine = bookings
    .filter((b) => b.status === 'accepted' || b.status === 'done' || b.status === 'paid')
    .sort((a, b) => a.date.localeCompare(b.date));

  const domain = new URL(publicOrigin(req)).hostname || 'pravda.jo';
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PRAVDA//Talent portal//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:PRAVDA',
    ...mine.flatMap((b) => vevent(b, domain)),
    'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n';

  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="pravda-${me.id}.ics"`,
      // One person's own days. Nothing between here and the phone may keep it.
      'cache-control': 'private, no-store',
    },
  });
}
