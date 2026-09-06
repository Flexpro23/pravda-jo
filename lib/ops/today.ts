/**
 * What to do next, in one list.
 *
 * The console used to answer "what happened" — four tabs of tables, each
 * complete and none of them urgent. The only question either operator actually
 * asks, standing in a car park with a phone, is "what do I do next", and the
 * answer was spread across a badge on one tab, a second table on another and a
 * booking buried inside one deal. This file is that answer: pure assembly over
 * what four queries already return, in a fixed order that puts the thing that
 * rots fastest at the top.
 *
 * It is deliberately store-free and clock-injectable, so the ordering can be
 * asserted in a unit test rather than eyeballed against live data.
 */

import { FAILURE_NOTE, type Client } from '@/lib/data/clients';
import { BOOKING_LABEL, type Booking, type Deal, type Talent } from '@/lib/data/deals';
import type { Sheet } from '@/lib/store/sheets';

// ── reading a sheet's cast ──────────────────────────────────────────────────
/**
 * The talent ids an operator settled on for one concept, or null for "he did
 * not". `CastPicker` needs ids to select with; everything that needs people
 * uses `effectiveCast` from the store, which is what the approve gate reads.
 */
export function overrideIds(sheet: Sheet, conceptN: number): string[] | null {
  const raw = sheet.castOverrides?.[String(conceptN)];
  return raw ? raw.map((c) => c.talentId).filter(Boolean) : null;
}

// ── the queue ───────────────────────────────────────────────────────────────

export type TaskKind =
  | 'read-failed' | 'tell-new' | 'read-stuck' | 'tell-ready'
  | 'review-sheet' | 'send-sheet' | 'chase-sheet'
  | 'collect' | 'tell-booking' | 'mark-done' | 'pay-crew';

/**
 * The fixed order. It is not "most urgent first" in the abstract — it is the
 * order these things go wrong in: a read nobody knows failed is worse than a
 * crew member nobody has paid, because the first one loses the lead and the
 * second one is embarrassing.
 */
export const TASK_ORDER: TaskKind[] = [
  'read-failed', 'tell-new', 'read-stuck', 'tell-ready',
  'review-sheet', 'send-sheet', 'chase-sheet',
  'collect', 'tell-booking', 'mark-done', 'pay-crew',
];

export type Task = {
  kind: TaskKind;
  /** Its group index, 1–11. Sorting on it is the plan's order, verbatim. */
  urgency: number;
  clientId?: string;
  sheetToken?: string;
  dealId?: string;
  bookingId?: string;
  title: string;
  sub: string;
  href: string;
  /** How long it has been owed, in minutes. Negative is impossible; 0 is now. */
  ageMins: number;
};

const MIN = 60_000;
const mins = (iso: string | undefined, at: number) =>
  (iso ? Math.max(0, Math.round((at - +new Date(iso)) / MIN)) : 0);

/** Ten minutes is longer than any read has ever legitimately taken. */
export const STUCK_MINS = 10;
/** Two days of silence on a link nobody opened. */
export const CHASE_UNOPENED_MINS = 48 * 60;
/** Five days between "they read it" and "they said nothing". */
export const CHASE_UNANSWERED_MINS = 5 * 24 * 60;

const nameOf = (c: Client) => c.businessName || `@${c.handle}`;

/** A lease nobody renewed, or a read that has simply stopped moving. */
export const readStuck = (c: Client, at: number) =>
  c.status === 'reading'
  && ((!!c.readLeaseUntil && +new Date(c.readLeaseUntil) <= at)
    || mins(c.updatedAt, at) > STUCK_MINS);

/** Terminal from the console's point of view: nothing here is owed any more. */
const settled = (c: Client) => c.status === 'won' || c.status === 'lost';

export function buildToday(input: {
  clients: Client[];
  sheets: Sheet[];
  deals: Deal[];
  bookings: Booking[];
  talentById?: Record<string, Talent>;
  /** Injected so the order is testable. Defaults to now. */
  at?: number;
}): Task[] {
  const {
    clients, sheets, deals, bookings, talentById = {}, at = Date.now(),
  } = input;
  const out: Task[] = [];
  const rank = (k: TaskKind) => TASK_ORDER.indexOf(k) + 1;
  const push = (t: Omit<Task, 'urgency'>) => out.push({ ...t, urgency: rank(t.kind) });

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const dealById = new Map(deals.map((d) => [d.id, d]));

  // ── the account ─────────────────────────────────────────────────────────
  for (const c of clients) {
    const href = `/ops/clients/${c.id}`;

    if (c.status === 'failed') {
      const note = c.readError ? FAILURE_NOTE[c.readError] : null;
      push({
        kind: 'read-failed', clientId: c.id, href,
        title: `The read failed for ${nameOf(c)}`,
        sub: note ? note.do_ : 'No reason was recorded. Re-run it and watch.',
        ageMins: mins(c.updatedAt, at),
      });
    }

    if (!c.notifiedNewAt && !settled(c)) {
      push({
        kind: 'tell-new', clientId: c.id, href,
        title: `Nobody has been told about ${nameOf(c)}`,
        sub: c.contactName ? `${c.contactName} asked` : 'Arrived through the form',
        ageMins: mins(c.createdAt, at),
      });
    }

    if (readStuck(c, at)) {
      push({
        kind: 'read-stuck', clientId: c.id, href,
        title: `The read for ${nameOf(c)} has stalled`,
        sub: 'The claim on it has expired. Re-run it, or leave it to the sweeper.',
        ageMins: mins(c.readStartedAt ?? c.updatedAt, at),
      });
    }

    if (c.status === 'ready' && !c.notifiedReadyAt) {
      push({
        kind: 'tell-ready', clientId: c.id, href,
        title: `${nameOf(c)} is read and nobody has been told`,
        sub: 'The sheet is waiting to be reviewed.',
        ageMins: mins(c.updatedAt, at),
      });
    }
  }

  // ── the sheet ───────────────────────────────────────────────────────────
  for (const s of sheets) {
    const owner = clientById.get(s.handle);
    if (owner && settled(owner)) continue;
    const who = s.clientName || `@${s.handle}`;

    if (s.status === 'draft') {
      push({
        kind: 'review-sheet', sheetToken: s.token, clientId: owner?.id,
        href: `/ops/sheet/${s.token}`,
        title: `${who} is waiting for three ideas`,
        sub: `${s.chosen?.length ?? 0}/3 chosen`,
        ageMins: mins(s.createdAt, at),
      });
      continue;
    }

    if (s.status === 'approved' && !s.sentAt) {
      push({
        kind: 'send-sheet', sheetToken: s.token, clientId: owner?.id,
        href: `/ops/sheet/${s.token}`,
        title: `${who}'s sheet is approved and unsent`,
        sub: 'The link exists. Nobody has it.',
        ageMins: mins(s.approvedAt ?? s.updatedAt, at),
      });
      continue;
    }

    // Chasing is two different silences. Unopened is a message that may never
    // have arrived; opened-and-nothing is a decision that has not been made.
    if (s.sentAt && !s.openedAt) {
      const age = mins(s.sentAt, at);
      if (age > CHASE_UNOPENED_MINS) {
        push({
          kind: 'chase-sheet', sheetToken: s.token, clientId: owner?.id,
          href: owner ? `/ops/clients/${owner.id}` : `/ops/sheet/${s.token}`,
          title: `${who} has not opened their sheet`,
          sub: `Sent ${Math.floor(age / 60 / 24)} days ago, never opened.`,
          ageMins: age,
        });
      }
    } else if (s.openedAt && !s.dealId) {
      const age = mins(s.lastOpenedAt ?? s.openedAt, at);
      if (age > CHASE_UNANSWERED_MINS) {
        push({
          kind: 'chase-sheet', sheetToken: s.token, clientId: owner?.id,
          href: owner ? `/ops/clients/${owner.id}` : `/ops/sheet/${s.token}`,
          title: `${who} read the sheet and said nothing`,
          sub: `Last opened ${Math.floor(age / 60 / 24)} days ago.`,
          ageMins: age,
        });
      }
    }
  }

  // ── the job ─────────────────────────────────────────────────────────────
  for (const d of deals) {
    if (d.status !== 'signed') continue;
    push({
      kind: 'collect', dealId: d.id, href: `/ops/deals/${d.id}`,
      title: `${d.clientName} has not paid`,
      sub: `${d.clientTotalJOD} JOD agreed. Nothing arrives until it does.`,
      ageMins: mins(d.signedAt ?? d.updatedAt, at),
    });
  }

  const today = new Date(at).toISOString().slice(0, 10);
  for (const b of bookings) {
    const who = talentById[b.talentId]?.name.en ?? b.talentId;
    const deal = dealById.get(b.dealId);
    const href = `/ops/deals/${b.dealId}`;
    const on = `${who} · ${b.date}`;

    if (!b.notifiedAt && (b.status === 'offered' || b.status === 'accepted')) {
      push({
        kind: 'tell-booking', bookingId: b.id, dealId: b.dealId, href,
        title: `${who} has not been told about ${b.date}`,
        sub: b.notifyNote || (deal ? `On ${deal.clientName}. A day nobody heard about is a missed shoot.` : 'A day nobody heard about is a missed shoot.'),
        ageMins: mins(b.createdAt, at),
      });
    }

    if (b.status === 'accepted' && b.date < today) {
      push({
        kind: 'mark-done', bookingId: b.id, dealId: b.dealId, href,
        title: `Was the shoot with ${who} done?`,
        sub: `${on} — still marked ${BOOKING_LABEL.accepted.en.toLowerCase()}.`,
        ageMins: mins(`${b.date}T23:59:59Z`, at),
      });
    }

    if (b.status === 'done') {
      push({
        kind: 'pay-crew', bookingId: b.id, dealId: b.dealId, href,
        title: `${who} is owed ${b.feeJOD} JOD`,
        sub: `${on} — shot and not paid.`,
        ageMins: mins(`${b.date}T23:59:59Z`, at),
      });
    }
  }

  // Group order first, then longest-owed within a group: two un-notified leads
  // are the same kind of problem and the older one is the worse one.
  return out.sort((a, b) => a.urgency - b.urgency || b.ageMins - a.ageMins);
}

/** "3d ago", for a card that has to fit on a phone. */
export function ago(mins_: number): string {
  if (mins_ < 1) return 'just now';
  if (mins_ < 60) return `${mins_}m ago`;
  const h = Math.floor(mins_ / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
