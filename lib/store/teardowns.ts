import { randomBytes } from 'node:crypto';
import { store } from '@/lib/store/firebase';
import { SPECIMEN, type Report } from '@/lib/data/report';
import type { Signals } from '@/lib/teardown/signals';

const COLLECTION = 'teardowns';

/**
 * A token is the only thing standing between a stranger and a document about
 * someone else's business, so it is 128 bits of randomness rather than anything
 * derived from the handle. Base64url keeps it short enough to sit in a DM.
 */
export function mintToken(): string {
  return randomBytes(16).toString('base64url');
}

export type Teardown = {
  token: string;
  handle: string;
  /**
   * draft   — computed, not yet fit to send: the prose pass has not run.
   * ready   — reviewed by an operator and cleared for sending.
   * sent    — a link has gone out; kept distinct so the queue can be worked.
   */
  status: 'draft' | 'ready' | 'sent';
  report: Report;
  /** The arithmetic behind the report, kept so prose can be rewritten without
   *  spending another hour of rate limit on the same account. */
  signals: Signals;
  /** What was read and when. A teardown claims provenance; this is the record
   *  that backs the claim if anyone ever asks us to show it. */
  readAt: string;
  createdAt: string;
  sentAt?: string;
};

export async function saveTeardown(t: Teardown): Promise<void> {
  await store().collection(COLLECTION).doc(t.token).set(t);
}

/**
 * Resolve a token to a teardown.
 *
 * `sample` is the published specimen and is served from code rather than the
 * store: it is linked from the marketing site, so it must not depend on a
 * database being reachable, and it must never be editable by whatever can write
 * to the collection.
 */
export async function getTeardown(token: string): Promise<Report | null> {
  if (token === 'sample') return SPECIMEN;
  // A malformed token should not become a Firestore path segment.
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;

  try {
    const snap = await store().collection(COLLECTION).doc(token).get();
    if (!snap.exists) return null;
    const t = snap.data() as Teardown;
    // A draft has not been read by a human yet. It is not a 404 to us, but it
    // is to anyone holding the link.
    if (t.status === 'draft') return null;
    return t.report;
  } catch {
    // A store outage must not take the specimen or the marketing site with it.
    return null;
  }
}

/** The operator queue, newest first. */
export async function listTeardowns(limit = 50): Promise<Teardown[]> {
  const snap = await store().collection(COLLECTION)
    .orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => d.data() as Teardown);
}

export async function findByHandle(handle: string): Promise<Teardown | null> {
  const snap = await store().collection(COLLECTION)
    .where('handle', '==', handle.toLowerCase())
    .orderBy('createdAt', 'desc').limit(1).get();
  return snap.empty ? null : (snap.docs[0].data() as Teardown);
}

/**
 * The whole record, drafts included.
 *
 * `getTeardown` deliberately refuses a draft, because it answers the public
 * routes. The console is the one caller that must see unfinished work — it is
 * what turns unfinished into finished — so it reads through here instead.
 */
export async function getRaw(token: string): Promise<Teardown | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const snap = await store().collection(COLLECTION).doc(token).get();
  return snap.exists ? (snap.data() as Teardown) : null;
}

/**
 * Save an operator's edits.
 *
 * Only the report and the status move. The signals are the arithmetic and stay
 * exactly as computed — an operator writes the judgement, never the figures,
 * because a hand-edited number would carry the same provenance line as a
 * measured one and there would be no way to tell them apart afterwards.
 */
export async function saveEdits(
  token: string, report: Report, status: Teardown['status'],
): Promise<void> {
  const patch: Record<string, unknown> = { report, status };
  if (status === 'sent') patch.sentAt = new Date().toISOString();
  await store().collection(COLLECTION).doc(token).update(patch);
}
