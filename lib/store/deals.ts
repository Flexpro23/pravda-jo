import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { store } from '@/lib/store/firebase';
import type {
  Talent, Deal, Booking, DealStatus, BookingStatus, Availability,
} from '@/lib/data/deals';
import { canTransition, canDealTransition } from '@/lib/data/deals';
import { notifyOffer } from '@/lib/notify/whatsapp';

/**
 * A prefix so tests can exercise the real code against isolated collections.
 * Empty in production, and empty is the only value any deployed config sets —
 * the alternative is a test suite that either writes into live data or checks
 * a reimplementation of the thing it is meant to be testing.
 */
const P = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
const TALENT = `${P}talent`;
const DEALS = `${P}deals`;
const BOOKINGS = `${P}bookings`;

const now = () => new Date().toISOString();

// ── talent ──────────────────────────────────────────────────────────────────

export async function listTalent(): Promise<Talent[]> {
  const snap = await store().collection(TALENT).orderBy('name.en').get();
  return snap.docs.map((d) => d.data() as Talent);
}

export const getTalent = async (id: string) => {
  const d = await store().collection(TALENT).doc(id).get();
  return d.exists ? (d.data() as Talent) : null;
};

export async function saveTalent(t: Talent) {
  await store().collection(TALENT).doc(t.id).set(t, { merge: true });
}

/**
 * Change some fields on a person, including to nothing.
 *
 * `saveTalent` merges, and the store runs with `ignoreUndefinedProperties`, so
 * an `undefined` is not "clear this" — it is "do not mention this", and the old
 * value survives. Which meant the console could set a portfolio link, a legal
 * name or an ID number and could never take one back: emptying the box saved
 * successfully and changed nothing, and the record kept a number somebody had
 * asked us to remove. A `FieldValue.delete()` is the only thing that actually
 * clears a key, so a route that means "clear it" has to say so.
 */
export async function patchTalent(
  id: string, patch: Record<string, unknown>,
): Promise<void> {
  await store().collection(TALENT).doc(id).update(patch);
}

/** A plain ISO calendar date, and a real one — 2026-02-31 is not a date. */
const isIsoDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === s;
};

/**
 * A provider setting their own state, and — when they are away — when they are
 * back.
 *
 * The return date is cleared rather than left behind whenever it stops meaning
 * anything (they came back, or they gave no date), because a stale "back on
 * the 3rd" attached to "available" is worse than no date at all.
 *
 * Returns false on a date that is not a date; the route turns that into a 400
 * rather than silently storing rubbish a producer will later plan around.
 */
export async function setAvailability(
  id: string, availability: Availability, availableFrom?: string,
): Promise<boolean> {
  const from = (availableFrom ?? '').trim();
  if (from && !isIsoDate(from)) return false;

  const keep = availability !== 'available' && !!from;
  await store().collection(TALENT).doc(id).update({
    availability,
    availabilitySetAt: now(),
    availableFrom: keep ? from : FieldValue.delete(),
  });
  return true;
}

/**
 * Invalidate every session this provider already has.
 *
 * The epoch is folded into the cookie signature, so incrementing it is how a
 * lost phone is dealt with. Called by "reissue a code" and by "sign out
 * everywhere" — reissue signs them out too, which is a behaviour change from
 * the old reissue and is why both console buttons must say so.
 */
export async function bumpSessionEpoch(id: string): Promise<number | null> {
  const t = await getTalent(id);
  if (!t) return null;
  const next = (t.sessionEpoch ?? 0) + 1;
  await store().collection(TALENT).doc(id).update({ sessionEpoch: next });
  return next;
}

/**
 * How long a newly issued code is. Six-digit codes already in the field stay
 * valid — the login accepts anything from six to eight — because reissuing
 * every provider's code to close a gap they cannot see is a morning of
 * WhatsApp messages and a shoot day somebody cannot sign in for.
 */
export const PASS_CODE_DIGITS = 8;

/**
 * A provider's sign-in.
 *
 * An eight-digit code rather than a password: this is a phone-first audience
 * who will be handed the code once, by a person they already work with. It is
 * hashed, so the database never holds the thing they type.
 *
 * Six digits was a million values, and `talentByCode` matches against the
 * *whole roster* rather than a named account — so a guesser was not attacking
 * one provider, they were attacking all of them at once, and with thirty on
 * the roster the expected cost of landing inside somebody's session was around
 * thirty-three thousand guesses. Eight digits is a hundred times that, and
 * together with the login's throttle and its fixed delay it stops being the
 * cheapest way in.
 *
 * `readUInt32BE` tops out below 100 million, so the modulus alone would bias
 * the low end of the range and never reach the top of it. Four extra bits of
 * entropy, then reject-and-retry the small tail that would skew: the loop runs
 * once in practice and the distribution is exactly uniform.
 */
const CODE_SPACE = 10 ** PASS_CODE_DIGITS;
export const newPassCode = () => {
  const limit = Math.floor(0x1_0000_0000_0000 / CODE_SPACE) * CODE_SPACE;
  for (;;) {
    const n = randomBytes(6).readUIntBE(0, 6);
    if (n < limit) return String(n % CODE_SPACE).padStart(PASS_CODE_DIGITS, '0');
  }
};
export const hashCode = (code: string) =>
  createHash('sha256').update(code.trim()).digest('hex');

export const codeMatches = (code: string, hash?: string) => {
  if (!hash) return false;
  const a = Buffer.from(hashCode(code)), b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Find the provider a code belongs to. Linear, over a roster of tens. */
export async function talentByCode(code: string): Promise<Talent | null> {
  const all = await listTalent();
  return all.find((t) => t.active && codeMatches(code, t.passCodeHash)) ?? null;
}

// ── deals ───────────────────────────────────────────────────────────────────

export async function listDeals(limit = 100): Promise<Deal[]> {
  const snap = await store().collection(DEALS)
    .orderBy('updatedAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => d.data() as Deal);
}

export const getDeal = async (id: string) => {
  const d = await store().collection(DEALS).doc(id).get();
  return d.exists ? (d.data() as Deal) : null;
};

export async function saveDeal(deal: Deal) {
  await store().collection(DEALS).doc(deal.id).set({ ...deal, updatedAt: now() }, { merge: true });
}

/**
 * Move a deal along, and let the money reveal the client.
 *
 * Paying is the moment talent is allowed to know who they are shooting for, so
 * that transition is the one place `clientName` is written onto bookings. Doing
 * it here rather than in a screen means it cannot be forgotten by whoever
 * builds the next screen.
 */
export async function advanceDeal(
  id: string, status: DealStatus, lostReason?: string,
): Promise<boolean> {
  const deal = await getDeal(id);
  if (!deal) return false;

  // The table is the authority, not the button that was tapped. Without this
  // the route wrote whatever string it was handed: a proposal nobody signed
  // could be marked `paid`, which is the one transition that writes the
  // client's name onto every booking on the job.
  if (!canDealTransition(deal.status, status)) return false;

  const patch: Record<string, unknown> = { status, updatedAt: now() };
  if (status === 'signed' && !deal.signedAt) patch.signedAt = now();
  if (status === 'paid' && !deal.paidAt) patch.paidAt = now();
  // Only meaningful on the way out, and only when someone actually said why.
  if (status === 'lost' && lostReason?.trim()) patch.lostReason = lostReason.trim().slice(0, 200);
  await store().collection(DEALS).doc(id).update(patch);

  if (status === 'paid') {
    const bs = await bookingsForDeal(id);
    const batch = store().batch();
    for (const b of bs) {
      batch.update(store().collection(BOOKINGS).doc(b.id), { clientName: deal.clientName });
    }
    await batch.commit();
  }
  return true;
}

// ── bookings ────────────────────────────────────────────────────────────────

export async function bookingsForDeal(dealId: string): Promise<Booking[]> {
  const snap = await store().collection(BOOKINGS).where('dealId', '==', dealId).get();
  return snap.docs.map((d) => d.data() as Booking).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Everything one provider is allowed to see.
 *
 * The only query the talent portal ever runs. It is scoped by talentId at the
 * query rather than filtered after, so a bug in a screen cannot widen it.
 */
export async function bookingsForTalent(talentId: string): Promise<Booking[]> {
  const snap = await store().collection(BOOKINGS).where('talentId', '==', talentId).get();
  return snap.docs.map((d) => d.data() as Booking).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Every booking still in play, across all deals.
 *
 * The console could previously only reach bookings one deal at a time, so
 * "who is owed money" and "which day nobody has been told about" were
 * questions it could not ask. `done` is in the window because an unpaid
 * finished day is exactly the thing that gets forgotten.
 */
export async function listOpenBookings(limit = 200): Promise<Booking[]> {
  const snap = await store().collection(BOOKINGS)
    .where('status', 'in', ['offered', 'accepted', 'done'])
    .limit(limit).get();
  return snap.docs.map((d) => d.data() as Booking)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * What `offerBooking` can come back with.
 *
 * A union rather than a thrown error or a null, because three of these are
 * ordinary operator situations rather than faults, and each needs different
 * words on screen: a person who cannot be booked at all, and a day that is
 * already spoken for — which is a question, not a refusal.
 */
export type OfferResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: 'placeholder' | 'inactive' | 'no-talent' }
  | { ok: false; reason: 'conflict'; conflict: { id: string; dealId: string; status: BookingStatus } };

/**
 * Create a booking.
 *
 * Takes the fields a booking may hold and nothing else. A caller that tries to
 * attach the client's price has nowhere to put it, and a caller that tries to
 * attach the client's name before the money has arrived is overruled here.
 *
 * Two guards sit in front of the write, both deliberately here rather than in
 * a screen — a screen is one careless render away from losing them:
 *
 *  · An invented person cannot be offered a real day. The roster carries
 *    `placeholder` people so the public work pages have somebody to show; the
 *    failure mode without this check is an operator discovering the mistake
 *    when the notification reports `no-number`.
 *  · The same person cannot be quietly offered the same date twice. This does
 *    not block it — a producer may legitimately want a backup on a day already
 *    spoken for, or the existing offer may be about to be declined — it asks,
 *    by returning the clash. `force` proceeds and records `conflictWith`, so a
 *    double-booking is visible on both sides rather than discovered on the day.
 */
export async function offerBooking(input: {
  dealId: string; talentId: string; date: string;
  feeJOD: number; brief: string; location?: string; callTime?: string;
  /** The booking this one replaces, when a day is being moved. */
  rescheduledFrom?: string;
  /** Offer it anyway, knowing about the clash. */
  force?: boolean;
  /** Where the portal lives, for the link in the message. */
  origin?: string;
}): Promise<OfferResult> {
  const talent = await getTalent(input.talentId);
  if (!talent) return { ok: false, reason: 'no-talent' };
  if (talent.placeholder) return { ok: false, reason: 'placeholder' };
  if (!talent.active) return { ok: false, reason: 'inactive' };

  // Narrower than pulling their whole history: two equality filters, which
  // Firestore serves off its own single-field indexes.
  const sameDay = await store().collection(BOOKINGS)
    .where('talentId', '==', input.talentId)
    .where('date', '==', input.date).get();
  const clash = sameDay.docs.map((d) => d.data() as Booking)
    .find((b) => b.status === 'offered' || b.status === 'accepted');
  if (clash && !input.force) {
    return {
      ok: false,
      reason: 'conflict',
      conflict: { id: clash.id, dealId: clash.dealId, status: clash.status },
    };
  }

  const deal = await getDeal(input.dealId);
  const booking: Booking = {
    id: randomBytes(9).toString('base64url'),
    dealId: input.dealId,
    talentId: input.talentId,
    date: input.date,
    feeJOD: input.feeJOD,
    status: 'offered',
    brief: input.brief,
    location: input.location,
    callTime: input.callTime,
    ...(clash ? { conflictWith: clash.id } : {}),
    ...(input.rescheduledFrom ? { rescheduledFrom: input.rescheduledFrom } : {}),
    // Only a paid deal reveals the client, whatever the caller intended.
    ...(deal?.status === 'paid' || deal?.status === 'delivered'
      ? { clientName: deal.clientName } : {}),
    createdAt: now(),
  };
  await store().collection(BOOKINGS).doc(booking.id).set(booking);

  // A moved day is a link between two bookings, so both ends carry it. Written
  // here rather than left to the caller: half a link is worse than none, since
  // a console reading the old booking would show it as simply cancelled.
  if (input.rescheduledFrom) {
    await store().collection(BOOKINGS).doc(input.rescheduledFrom)
      .update({ rescheduledTo: booking.id }).catch(() => { /* the old id was wrong; the new day stands */ });
  }

  // Tell them. A failure here must not undo the booking — the day is still
  // offered, it just has to be passed on by hand, and the console says which.
  const r = await notifyOffer(booking, talent, input.origin ?? '');
  const patch = r.sent
    ? { notifiedAt: now() }
    : { notifyNote: r.reason === 'no-number' ? 'no usable phone number'
      : r.reason === 'unconfigured' ? 'WhatsApp not configured — send it by hand'
        : `send failed: ${r.detail ?? 'unknown'}` };
  await store().collection(BOOKINGS).doc(booking.id).update(patch);
  Object.assign(booking, patch);

  return { ok: true, booking };
}

/**
 * A provider answering. Scoped by talentId so one cannot answer for another,
 * and still limited to the two answers that are theirs to give — cancelling
 * and no-showing are the studio's words about a day, not the provider's.
 */
export async function respondToBooking(
  id: string, talentId: string,
  status: Extract<BookingStatus, 'accepted' | 'declined'>,
  reason?: string,
): Promise<boolean> {
  const ref = store().collection(BOOKINGS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const b = snap.data() as Booking;
  if (b.talentId !== talentId) return false;         // not theirs to answer
  if (b.status !== 'offered') return false;          // already settled

  const why = (reason ?? '').trim().slice(0, 200);
  await ref.update({
    status,
    respondedAt: now(),
    // A reason only means anything on a no, and only when one was given.
    ...(status === 'declined' && why ? { declineReason: why } : {}),
  });
  return true;
}

/**
 * The operator moving a booking along.
 *
 * Validated against the transition table rather than trusting the caller, so a
 * paid day cannot be walked back to offered by a mis-tap or by a screen that
 * offers a button it should not. Returns false on an illegal move; the route
 * turns that into a 409.
 */
export async function markBooking(id: string, status: BookingStatus): Promise<boolean> {
  const ref = store().collection(BOOKINGS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const b = snap.data() as Booking;
  if (!canTransition(b.status, status)) return false;

  const patch: Record<string, unknown> = { status };
  if (status === 'paid') patch.paidAt = now();
  await ref.update(patch);
  return true;
}

/** Record that a reminder went out by hand. Informational; nothing schedules. */
export async function recordReminder(id: string): Promise<boolean> {
  const ref = store().collection(BOOKINGS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({ remindedAt: FieldValue.arrayUnion(now()) });
  return true;
}
