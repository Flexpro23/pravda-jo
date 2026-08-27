import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { store } from '@/lib/store/firebase';
import type {
  Talent, Deal, Booking, DealStatus, BookingStatus, Availability,
} from '@/lib/data/deals';

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

export async function setAvailability(id: string, availability: Availability) {
  await store().collection(TALENT).doc(id)
    .update({ availability, availabilitySetAt: now() });
}

/**
 * A provider's sign-in.
 *
 * A six-digit code rather than a password: this is a phone-first audience who
 * will be handed the code once, by a person they already work with. It is
 * hashed, so the database never holds the thing they type.
 */
export const newPassCode = () => String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(6, '0');
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
export async function advanceDeal(id: string, status: DealStatus) {
  const deal = await getDeal(id);
  if (!deal) return;

  const patch: Record<string, unknown> = { status, updatedAt: now() };
  if (status === 'signed' && !deal.signedAt) patch.signedAt = now();
  if (status === 'paid' && !deal.paidAt) patch.paidAt = now();
  await store().collection(DEALS).doc(id).update(patch);

  if (status === 'paid') {
    const bs = await bookingsForDeal(id);
    const batch = store().batch();
    for (const b of bs) {
      batch.update(store().collection(BOOKINGS).doc(b.id), { clientName: deal.clientName });
    }
    await batch.commit();
  }
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
 * Create a booking.
 *
 * Takes the fields a booking may hold and nothing else. A caller that tries to
 * attach the client's price has nowhere to put it, and a caller that tries to
 * attach the client's name before the money has arrived is overruled here.
 */
export async function offerBooking(input: {
  dealId: string; talentId: string; date: string;
  feeJOD: number; brief: string; location?: string; callTime?: string;
}): Promise<Booking> {
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
    // Only a paid deal reveals the client, whatever the caller intended.
    ...(deal?.status === 'paid' || deal?.status === 'delivered'
      ? { clientName: deal.clientName } : {}),
    createdAt: now(),
  };
  await store().collection(BOOKINGS).doc(booking.id).set(booking);
  return booking;
}

/** A provider answering. Scoped by talentId so one cannot answer for another. */
export async function respondToBooking(
  id: string, talentId: string, status: Extract<BookingStatus, 'accepted' | 'declined'>,
): Promise<boolean> {
  const ref = store().collection(BOOKINGS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const b = snap.data() as Booking;
  if (b.talentId !== talentId) return false;         // not theirs to answer
  if (b.status !== 'offered') return false;          // already settled
  await ref.update({ status, respondedAt: now() });
  return true;
}

export async function markBooking(id: string, status: BookingStatus) {
  const patch: Record<string, unknown> = { status };
  if (status === 'paid') patch.paidAt = now();
  await store().collection(BOOKINGS).doc(id).update(patch);
}
