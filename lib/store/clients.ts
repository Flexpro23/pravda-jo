import { FieldValue } from 'firebase-admin/firestore';
import { store } from '@/lib/store/firebase';
import { normaliseHandle } from '@/lib/meta/discovery';
import { hit } from '@/lib/store/ratelimit';
import { ENGINE_STATUS, STATUS_RANK } from '@/lib/data/clients';
import type {
  Client, ClientNote, ClientStatus, NotifyChannel, ReadFailure,
} from '@/lib/data/clients';
import type { Vertical } from '@/lib/data/concepts';

/** Same test seam as the other stores; empty everywhere but a test run. */
const P = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
const CLIENTS = `${P}clients`;

const now = () => new Date().toISOString();

/**
 * How long an unconverted lead's record lives before a Firestore TTL policy
 * removes it (D16). Stamped only at creation — a re-submission of the same
 * handle never extends or resets it, because the clock is about how long a
 * lead has gone unconverted, not about when it was last touched. `won` clears
 * the field entirely (`setClientOutcome`), so a real client's history is never
 * subject to this policy once the relationship exists. The TTL policy itself
 * is an owner action — `gcloud firestore fields ttls update expiresAt
 * --collection-group=clients` — documented in docs/RUNBOOK.md.
 */
const RETENTION_DAYS = 180;
const retentionExpiry = () => new Date(Date.now() + RETENTION_DAYS * 86_400_000).toISOString();

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
 * How far along an account may be before its contact details stop being the
 * form's to change.
 *
 * While nobody has spoken to them, a second submission is the same person
 * correcting their own typo and the newer detail is simply better. Once Khaled
 * has sent them a sheet, that number is the one he has been calling — and the
 * public form is unauthenticated, so anybody who knows a business's Instagram
 * handle could otherwise redirect a live conversation onto their own phone by
 * typing it into a page. Past `ready` the stored contact stands and the
 * submission is written into the margin instead, where a person decides.
 */
const CONTACT_MUTABLE: ClientStatus[] = ['new', 'reading', 'failed'];

/**
 * Somebody asked. Return the account, creating it if this is the first time.
 *
 * A non-empty contact detail wins while the account is still the engine's —
 * a person filling the form again is usually correcting a typo in their own
 * phone number, and a stale number on a lead is the same as no lead. But an
 * empty one is never a detail: it is the console re-reading a handle with
 * nothing typed into the contact fields, and must never erase a name or number
 * a real lead already gave us. And past `ready` neither wins: see
 * `CONTACT_MUTABLE`. Everything the engine produced stays: a second submission
 * from the same shop is another read on one account, never a second account,
 * and never a reset of the first one's history.
 */
export async function openClient(input: {
  handle: string;
  contactName?: string;
  contactPhone?: string;
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
  const result = await store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prior = snap.exists ? (snap.data() as Client) : null;

    // A client already moved along the pipeline is not dragged back to `new` by
    // someone re-submitting the form. Only an account that has never got past a
    // failed read is put back in the queue to be tried again.
    const status: ClientStatus = !prior || prior.status === 'failed' ? 'new' : prior.status;

    const offeredName = input.contactName?.trim() ?? '';
    const offeredPhone = input.contactPhone?.trim() ?? '';
    // An account nobody has worked yet takes the newer detail; one past `ready`
    // keeps what it has — unless it has nothing, in which case an empty field
    // is not a thing worth defending.
    const open = !prior || CONTACT_MUTABLE.includes(prior.status);
    const contactName = open
      ? (offeredName || prior?.contactName || '')
      : (prior?.contactName || offeredName || '');
    const contactPhone = open
      ? (offeredPhone || prior?.contactPhone || '')
      : (prior?.contactPhone || offeredPhone || '');

    // What was offered and refused, so the caller can put it in the margin.
    const refused = !open
      ? [
        offeredName && offeredName !== contactName ? `name ${offeredName}` : '',
        offeredPhone && offeredPhone !== contactPhone ? `phone ${offeredPhone}` : '',
      ].filter(Boolean).join(' / ')
      : '';

    const client: Client = {
      id,
      handle: id,
      contactName,
      contactPhone,
      website: input.website || prior?.website,
      businessName: prior?.businessName,
      source: prior?.source ?? input.source ?? 'intake',
      status,
      // Every account that is waiting for a read carries the moment it started
      // waiting, so the sweeper can serve the longest wait first. Stamped here
      // because this is the only place a client is ever put into `new` — a
      // queue whose entries do not all have a queue time is a queue with a
      // silent second class of entry that never gets read.
      queuedAt: status === 'new' ? (prior?.queuedAt ?? now()) : prior?.queuedAt,
      readStartedAt: prior?.readStartedAt,
      readLeaseUntil: prior?.readLeaseUntil,
      readAttempts: prior?.readAttempts,
      lastNotifyChannel: prior?.lastNotifyChannel,
      vertical: prior?.vertical,
      notes: prior?.notes,
      lostReason: prior?.lostReason,
      // Set once, on first creation, for a lead that starts life unconverted.
      // A returning submission keeps whatever the account already carries —
      // never re-stamped, and never touched here once a human has moved the
      // status past `failed` (that clearing happens in `setClientOutcome`).
      expiresAt: prior ? prior.expiresAt : retentionExpiry(),
      sheetTokens: prior?.sheetTokens ?? [],
      dealId: prior?.dealId,
      readError: undefined,
      notifiedNewAt: prior?.notifiedNewAt,
      notifiedReadyAt: prior?.notifiedReadyAt,
      notifyNewAttemptedAt: prior?.notifyNewAttemptedAt,
      resumeStatus: prior?.resumeStatus,
      lang: input.lang,
      createdAt: prior?.createdAt ?? now(),
      updatedAt: now(),
    };
    tx.set(ref, client, { merge: true });
    return { client, created: !prior, refused };
  });

  // Outside the transaction, because a note is an append to the same document
  // and nesting one transaction inside another is not a thing Firestore does.
  // Quietly: a lost margin note must not fail a lead that was written.
  if (result?.refused) {
    await addClientNote(id, 'system', `form resubmitted with ${result.refused}`).catch(() => null);
  }
  return result ? { client: result.client, created: result.created } : null;
}

/**
 * Set the status, whatever it currently is.
 *
 * The unguarded primitive, and it is named for what it does now: every caller
 * that reached for `setClientStatus` because it was the only thing on the shelf
 * was writing a bug. A console re-read of a client Khaled had already sent a
 * sheet to dragged them back to `ready` and back into the queue as work to do.
 * Reach for `advanceClient` instead; this one is for the two places that really
 * do mean "override" — an operator un-approving a sheet, and the sweeper
 * retiring a read that has run out of attempts.
 */
export async function forceClientStatus(
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
 * Move the account along, but only forwards.
 *
 * The engine gets to say `reading`, `ready` and `failed` — and only while it is
 * still ahead of the humans. Past `ready` the status belongs to Khaled: a
 * client he has sent to, won or lost keeps that status while a freshly read
 * sheet is filed underneath it. An operator transition (`sent`, `won`, `lost`,
 * or an explicit `unapprove` back to `ready`) always applies, because the
 * person is the authority on where the relationship is.
 *
 * A transaction rather than a read-then-write, because the sweeper and the
 * console can both be finishing the same client in the same second.
 */
export async function advanceClient(
  id: string, status: ClientStatus, readError?: ReadFailure,
): Promise<Client | null> {
  const clean = idFor(id);
  if (!clean) return null;
  const ref = store().collection(CLIENTS).doc(clean);

  return store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const prior = snap.data() as Client;

    // Refused, not failed: the account is simply further along than the engine
    // is, and the caller carries on filing whatever it produced.
    if (ENGINE_STATUS.includes(status) && STATUS_RANK[prior.status] > 2) return prior;

    const patch: Partial<Client> = { status, updatedAt: now(), readError: readError ?? undefined };
    tx.update(ref, { ...patch, readError: readError ?? null });
    return { ...prior, ...patch };
  });
}

/**
 * Take the read.
 *
 * The one function that stands between two code paths and a double-spent Meta
 * call. `after()` on the lead route and the cron sweeper both want to read the
 * same account, and neither can see the other; whichever wins this transaction
 * owns the read until its lease runs out, and the loser gets `null` and does
 * nothing. A claim is refused unless the account is `new`, or `reading` with a
 * lease that has already expired — which is what makes an instance dying
 * mid-read a recoverable event rather than a lead stuck forever.
 *
 * Two things happen here that do not look like claiming:
 *
 * The global Meta ceiling is spent here, not in the lead route, because it is a
 * ceiling on *reads* and this is the only place a read begins. Over the
 * ceiling, the account keeps its status, gets a `queuedAt` if it has none, and
 * the sweeper collects it once the window rolls. The lead is never dropped;
 * only the read is deferred.
 *
 * And `force` — the console's "Re-run read" — restarts the attempt count. An
 * operator asking for another read has taken responsibility for it, and should
 * not immediately have it retired by the sweeper's three-strike rule.
 *
 * What `force` may not do is walk a settled account. A won client re-read used
 * to come back as `ready`, because the claim wrote `reading` and `readAndFile`
 * then advanced a status the engine was suddenly ahead of — so a customer
 * reappeared in the queue as a lead to chase. `won` and `lost` are refused
 * outright; `sent` is borrowed and given back (`resumeStatus`), because
 * re-reading a business Khaled has already written to is an ordinary thing to
 * want and only the status must not move.
 */
export async function claimForRead(
  id: string, leaseMs = 10 * 60_000, opts?: { force?: boolean },
): Promise<Client | null> {
  const clean = idFor(id);
  if (!clean) return null;
  const ref = store().collection(CLIENTS).doc(clean);
  const force = opts?.force === true;

  const claimable = (c: Client) =>
    (force ? c.status !== 'won' && c.status !== 'lost' : false)
    || c.status === 'new'
    || (c.status === 'reading'
      && (!c.readLeaseUntil || +new Date(c.readLeaseUntil) <= Date.now()));

  // A cheap look before the ceiling is spent. Without it, every `after()` on a
  // returning client that needs no read at all would burn an hour's budget.
  const peek = await ref.get();
  if (!peek.exists) return null;
  if (!claimable(peek.data() as Client)) return null;

  // Fail closed. This ceiling sits on Meta spend rather than on a request, so
  // a store outage that let it through would not inconvenience one visitor —
  // it would remove the only bound on the bill.
  const ceiling = await hit('reads:global', 40, 60 * 60_000, { failClosed: true });
  if (!ceiling.ok) {
    await ref.update({ queuedAt: (peek.data() as Client).queuedAt ?? now(), updatedAt: now() })
      .catch(() => {});
    console.log(JSON.stringify({ msg: 'read.deferred', clientId: clean, retryAfterSec: ceiling.retryAfterSec }));
    return null;
  }

  return store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const prior = snap.data() as Client;
    // Checked again inside the transaction, and this is the check that counts:
    // the peek above is an optimisation, this is the mutual exclusion.
    if (!claimable(prior)) return null;

    // Anything the engine is not already ahead of is borrowed, not taken. In
    // practice that is only `sent` — `won` and `lost` were refused above and
    // everything else ranks at or below `ready`.
    const borrowed = STATUS_RANK[prior.status] > 2 ? prior.status : null;

    const patch = {
      status: 'reading' as const,
      readStartedAt: now(),
      readLeaseUntil: new Date(Date.now() + leaseMs).toISOString(),
      readAttempts: force ? 1 : (prior.readAttempts ?? 0) + 1,
      ...(borrowed ? { resumeStatus: borrowed } : {}),
      updatedAt: now(),
    };
    tx.update(ref, patch);
    return { ...prior, ...patch };
  });
}

/**
 * Give back what a forced re-read borrowed.
 *
 * Called by `readAndFile` once the sheet is filed, whichever way the read went.
 * Only a status the engine may not set on its own is restored — anything at
 * rank 2 or below is exactly where the read has just correctly left it — and
 * `resumeStatus` is deleted either way, so a stale one can never resurrect a
 * status two reads later. The failure reason travels with it, because "sent,
 * and the last re-read could not complete" is a true and useful sentence and
 * `forceClientStatus` would otherwise clear it.
 */
export async function resumeAfterRead(
  id: string, readError?: ReadFailure,
): Promise<ClientStatus | null> {
  const clean = idFor(id);
  if (!clean) return null;
  const ref = store().collection(CLIENTS).doc(clean);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const resume = (snap.data() as Client).resumeStatus;
  if (!resume) return null;
  if (STATUS_RANK[resume] <= 2) {
    await ref.update({ resumeStatus: FieldValue.delete(), updatedAt: now() });
    return null;
  }

  await ref.update({
    status: resume,
    resumeStatus: FieldValue.delete(),
    readError: readError ?? null,
    updatedAt: now(),
  });
  return resume;
}

/**
 * The `new` notice was tried — sent or not.
 *
 * `markNotified` records a success and is what stops the notice being sent
 * twice. This records the attempt, and is what stops a cascade with every
 * channel down being retried once a minute forever. Both, because "he was
 * told" and "we tried to tell him" are different facts and the queue needs
 * each of them for a different reason.
 */
export async function markNotifyAttempt(id: string): Promise<void> {
  const clean = idFor(id);
  if (!clean) return;
  await store().collection(CLIENTS).doc(clean)
    .update({ notifyNewAttemptedAt: now(), updatedAt: now() })
    .catch(() => {});
}

/**
 * Put it back in the queue without claiming it.
 *
 * The console's re-run belt-and-braces: it claims and reads inline, but if that
 * instance dies the lease is the only thing that recovers it — and a `queuedAt`
 * costs nothing and makes the intent visible in the console meanwhile.
 */
export async function enqueueForRead(id: string): Promise<void> {
  const clean = idFor(id);
  if (!clean) return;
  const ref = store().collection(CLIENTS).doc(clean);
  const snap = await ref.get();
  if (!snap.exists) return;
  const c = snap.data() as Client;
  if (c.queuedAt) return;
  await ref.update({ queuedAt: now(), updatedAt: now() }).catch(() => {});
}

/**
 * Attach something the engine produced.
 *
 * Newest first, and de-duplicated: re-running the same sheet token must not
 * make the history look like two reads.
 */
export async function attachToClient(
  id: string, kind: 'sheet', token: string,
): Promise<void> {
  const clean = idFor(id);
  if (!clean) return;
  void kind;
  const ref = store().collection(CLIENTS).doc(clean);
  await store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const c = snap.data() as Client;
    // Only sheets attach now. The long-form teardown pipeline is retired, and
    // `teardownTokens` survives on the type as a read-only relic so documents
    // written before the retirement still parse — nothing writes it again.
    const list = [token, ...(c.sheetTokens ?? []).filter((t) => t !== token)];
    tx.update(ref, { sheetTokens: list, updatedAt: now() });
  });
}

/**
 * Record that Khaled was actually told, per event — and by what.
 *
 * The channel matters because the cascade can fall through several before one
 * carries: "told on Telegram because WhatsApp's window had closed" is the fact
 * that explains a WhatsApp integration quietly doing nothing for a week.
 */
export async function markNotified(
  id: string, which: 'new' | 'ready', channel?: NotifyChannel,
): Promise<void> {
  const clean = idFor(id);
  if (!clean) return;
  await store().collection(CLIENTS).doc(clean).update({
    [which === 'new' ? 'notifiedNewAt' : 'notifiedReadyAt']: now(),
    ...(channel ? { lastNotifyChannel: channel } : {}),
    updatedAt: now(),
  });
}

/**
 * The vertical, confirmed by a person.
 *
 * Kept on the account rather than only on the sheet, so the next read of the
 * same business starts from the answer somebody already gave instead of asking
 * the guesser again.
 */
export async function setClientVertical(id: string, vertical: Vertical | null): Promise<void> {
  const clean = idFor(id);
  if (!clean) return;
  await store().collection(CLIENTS).doc(clean)
    .update({ vertical: vertical ?? null, updatedAt: now() });
}

/** A line in the margin. Appended, newest last, never overwriting. */
export async function addClientNote(
  id: string, by: ClientNote['by'], text: string,
): Promise<Client | null> {
  const clean = idFor(id);
  const body = text.trim().slice(0, 2000);
  if (!clean || !body) return null;
  const ref = store().collection(CLIENTS).doc(clean);
  return store().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const c = snap.data() as Client;
    const notes = [...(c.notes ?? []), { at: now(), by, text: body }];
    tx.update(ref, { notes, updatedAt: now() });
    return { ...c, notes };
  });
}

/**
 * Fix a name or a number by hand.
 *
 * An empty field is never a correction — it is a form somebody did not fill —
 * so it is dropped rather than written. Correcting a phone number is one of the
 * few edits that has to be possible: a lead with a typo in it is not a lead.
 */
export async function setClientContact(
  id: string, input: { contactName?: string; contactPhone?: string },
): Promise<Client | null> {
  const clean = idFor(id);
  if (!clean) return null;
  const patch: Record<string, string> = {};
  const name = input.contactName?.trim();
  const phone = input.contactPhone?.trim();
  if (name) patch.contactName = name.slice(0, 120);
  if (phone) patch.contactPhone = phone.slice(0, 40);
  if (!Object.keys(patch).length) return getClient(clean);
  await store().collection(CLIENTS).doc(clean).update({ ...patch, updatedAt: now() });
  return getClient(clean);
}

/**
 * They said yes, or they said no.
 *
 * An operator transition, so it applies whatever the engine thinks. A win
 * clears `expiresAt`: the retention clock runs on unconverted leads, and a
 * customer is not one. A loss keeps the reason in the operator's own words,
 * because "too expensive" and "went with their cousin" are different businesses
 * to call back in six months.
 */
export async function setClientOutcome(
  id: string, outcome: 'won' | 'lost', reason?: string,
): Promise<Client | null> {
  const clean = idFor(id);
  if (!clean) return null;
  const ref = store().collection(CLIENTS).doc(clean);
  const snap = await ref.get();
  if (!snap.exists) return null;

  await ref.update({
    status: outcome,
    lostReason: outcome === 'lost' ? (reason?.trim().slice(0, 500) || null) : null,
    ...(outcome === 'won' ? { expiresAt: null } : {}),
    updatedAt: now(),
  });
  return getClient(clean);
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

/**
 * Accounts waiting for a first read, longest wait first.
 *
 * Needs the composite index on `(status, queuedAt)`. Firestore's `orderBy`
 * silently drops documents that lack the field, so a `new` client written
 * before `queuedAt` existed would never appear here — which is why
 * `staleUnqueued` below exists, and why `openClient` now stamps it.
 */
export async function queuedForRead(limit = 3): Promise<Client[]> {
  const snap = await store().collection(CLIENTS)
    .where('status', '==', 'new').orderBy('queuedAt', 'asc').limit(limit).get();
  return snap.docs.map((d) => d.data() as Client);
}

/**
 * The backstop for `new` clients written before the queue existed.
 *
 * Deliberately unordered: an unordered `where` + `limit` needs only the
 * automatic single-field index, so this costs no new composite and cannot be
 * the thing that breaks a deploy. It should return nothing on a healthy
 * database — every account opened since `queuedAt` landed carries one.
 */
export async function staleUnqueued(limit = 3): Promise<Client[]> {
  const snap = await store().collection(CLIENTS)
    .where('status', '==', 'new').limit(limit).get();
  return snap.docs.map((d) => d.data() as Client).filter((c) => !c.queuedAt);
}

/**
 * Reads that claimed an account and never came back, oldest lease first.
 *
 * Needs the composite index on `(status, readLeaseUntil)`. The expiry itself is
 * filtered in code rather than in the query, so one round trip answers both
 * "which leases are old" and "which of those have actually run out".
 */
export async function expiredLeases(limit = 3, at = Date.now()): Promise<Client[]> {
  const snap = await store().collection(CLIENTS)
    .where('status', '==', 'reading').orderBy('readLeaseUntil', 'asc').limit(limit).get();
  return snap.docs.map((d) => d.data() as Client)
    .filter((c) => !c.readLeaseUntil || +new Date(c.readLeaseUntil) <= at);
}

/** The newest read, which is the one every screen opens. */
export const currentSheetOf = (c: Client) => c.sheetTokens[0] ?? null;

/** Which client a sheet belongs to, for the paths that only hold a token. */
export async function clientForSheet(token: string): Promise<Client | null> {
  const snap = await store().collection(CLIENTS)
    .where('sheetTokens', 'array-contains', token).limit(1).get();
  return snap.empty ? null : (snap.docs[0].data() as Client);
}
