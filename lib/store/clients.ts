import { store } from '@/lib/store/firebase';
import { normaliseHandle } from '@/lib/meta/discovery';
import type { Client, ClientStatus, ReadFailure } from '@/lib/data/clients';

/** Same test seam as the other stores; empty everywhere but a test run. */
const P = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
const CLIENTS = `${P}clients`;

const now = () => new Date().toISOString();

/**
 * A handle is the identity, so it is also the document id.
 *
 * Firestore ids may not contain a slash and may not be `.` or `..`; a
 * normalised Instagram handle can be none of those, but the guard stays because
 * this value arrives from a public form and an id is a path segment.
 */
const idFor = (handle: string) => {
  const h = normaliseHandle(handle);
  return h && !/^\.{1,2}$/.test(h) ? h : null;
};

export async function getClient(id: string): Promise<Client | null> {
  const clean = idFor(id);
  if (!clean) return null;
  const d = await store().collection(CLIENTS).doc(clean).get();
  return d.exists ? (d.data() as Client) : null;
}

/**
 * Somebody asked. Return the account, creating it if this is the first time.
 *
 * The contact details always win, because a person filling the form again is
 * usually correcting a typo in their own phone number — and a stale number on
 * a lead is the same as no lead. Everything the engine produced stays: a second
 * submission from the same shop is another read on one account, never a second
 * account, and never a reset of the first one's history.
 */
export async function openClient(input: {
  handle: string;
  contactName: string;
  contactPhone: string;
  website?: string;
  lang: 'ar' | 'en';
  source?: Client['source'];
}): Promise<{ client: Client; created: boolean } | null> {
  const id = idFor(input.handle);
  if (!id) return null;

  const ref = store().collection(CLIENTS).doc(id);

  // A transaction, because the public form is the one place two submissions can
  // land at once — somebody double-tapping a button on a slow phone connection.
  // Read-then-write outside one would let the second overwrite the first's
  // sheetTokens with an empty array.
  return store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prior = snap.exists ? (snap.data() as Client) : null;

    const client: Client = {
      id,
      handle: id,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      website: input.website || prior?.website,
      businessName: prior?.businessName,
      source: prior?.source ?? input.source ?? 'intake',
      // A client already moved along the pipeline is not dragged back to `new`
      // by someone re-submitting the form. Only an account that has never got
      // past a failed read is put back in the queue to be tried again.
      status: !prior || prior.status === 'failed' ? 'new' : prior.status,
      sheetTokens: prior?.sheetTokens ?? [],
      teardownTokens: prior?.teardownTokens ?? [],
      dealId: prior?.dealId,
      readError: undefined,
      notifiedNewAt: prior?.notifiedNewAt,
      notifiedReadyAt: prior?.notifiedReadyAt,
      lang: input.lang,
      createdAt: prior?.createdAt ?? now(),
      updatedAt: now(),
    };
    tx.set(ref, client, { merge: true });
    return { client, created: !prior };
  });
}

/** Move the account along. Only the engine and the console call this. */
export async function setClientStatus(
  id: string, status: ClientStatus, readError?: ReadFailure,
): Promise<void> {
  const clean = idFor(id);
  if (!clean) return;
  await store().collection(CLIENTS).doc(clean).update({
    status, updatedAt: now(),
    // Cleared on every transition, so a failure note can never outlive the
    // failure and sit under a status that has since gone green.
    readError: readError ?? null,
  });
}

/**
 * Attach something the engine produced.
 *
 * Newest first, and de-duplicated: re-running the same sheet token must not
 * make the history look like two reads.
 */
export async function attachToClient(
  id: string, kind: 'sheet' | 'teardown', token: string,
): Promise<void> {
  const clean = idFor(id);
  if (!clean) return;
  const ref = store().collection(CLIENTS).doc(clean);
  await store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const c = snap.data() as Client;
    const key = kind === 'sheet' ? 'sheetTokens' : 'teardownTokens';
    const list = [token, ...(c[key] ?? []).filter((t) => t !== token)];
    tx.update(ref, { [key]: list, updatedAt: now() });
  });
}

/** Record that Khaled was actually told, per event. */
export async function markNotified(
  id: string, which: 'new' | 'ready',
): Promise<void> {
  const clean = idFor(id);
  if (!clean) return;
  await store().collection(CLIENTS).doc(clean).update({
    [which === 'new' ? 'notifiedNewAt' : 'notifiedReadyAt']: now(),
    updatedAt: now(),
  });
}

/** Learned from the read rather than asked for on a form nobody wants to fill. */
export async function setBusinessName(id: string, businessName: string): Promise<void> {
  const clean = idFor(id);
  if (!clean || !businessName.trim()) return;
  await store().collection(CLIENTS).doc(clean)
    .update({ businessName: businessName.trim(), updatedAt: now() });
}

export async function linkDeal(id: string, dealId: string): Promise<void> {
  const clean = idFor(id);
  if (!clean) return;
  await store().collection(CLIENTS).doc(clean)
    .update({ dealId, status: 'won', updatedAt: now() });
}

/** The book, newest movement first. */
export async function listClients(limit = 200): Promise<Client[]> {
  const snap = await store().collection(CLIENTS)
    .orderBy('updatedAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => d.data() as Client);
}

/** The newest read, which is the one every screen opens. */
export const currentSheetOf = (c: Client) => c.sheetTokens[0] ?? null;

/** Which client a sheet belongs to, for the paths that only hold a token. */
export async function clientForSheet(token: string): Promise<Client | null> {
  const snap = await store().collection(CLIENTS)
    .where('sheetTokens', 'array-contains', token).limit(1).get();
  return snap.empty ? null : (snap.docs[0].data() as Client);
}
