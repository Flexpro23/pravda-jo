/**
 * Firestore-backed rate limiting — not in-memory.
 *
 * App Hosting runs this service on up to four Cloud Run instances behind a
 * round-robin load balancer. A counter held in one instance's process memory
 * only ever sees the requests that happen to land on it — an attacker's
 * traffic is spread across all four, so each instance would think it is
 * seeing a quarter of the abuse it is meant to be stopping. Firestore is the
 * one thing every instance actually shares, so it is the only place a count
 * can be trusted. (A tolerant in-memory LRU in front of this, as a fast
 * reject for the obvious repeat hit within one instance's own lifetime, is a
 * valid future addition — it would sit in front of this module, never
 * replace it.)
 *
 * Keys are hashed, never the raw value. `ipKey` never writes a visitor's IP
 * address into Firestore in the clear: a rate-limit collection is exactly the
 * kind of incidental data nobody thinks to protect, and there is no reason a
 * day-and-a-half-old document should be able to name who visited. Salting the
 * hash with a server secret means the mapping cannot be rebuilt from outside
 * the deployment even by someone who reads the collection directly.
 *
 * `expiresAt` is written as a Firestore `Timestamp` and not as the ISO string
 * every other date here is, because a TTL policy only ever deletes a document
 * whose TTL field holds a timestamp — anything else is passed over in silence,
 * so a window document written with a string would be swept by nothing and
 * this collection would grow without limit under exactly the traffic it exists
 * to survive. `ttlWrite` is where that conversion happens.
 *
 * Owner action this file cannot perform: a Firestore TTL policy is not
 * expressible in firestore.indexes.json. Every document below is written
 * with a correct `expiresAt`, but nothing actually deletes an expired one
 * until this runs once, after the first deploy:
 *   gcloud firestore fields ttls update expiresAt --collection-group=ratelimit --enable-ttl
 */

import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { store } from '@/lib/store/firebase';
import { ttlWrite } from '@/lib/store/ttl';

const P = process.env.FIRESTORE_COLLECTION_PREFIX ?? '';
const RATELIMIT = `${P}ratelimit`;

export type Hit = { ok: boolean; remaining: number; retryAfterSec: number };

export type HitOptions = {
  /**
   * What to do when the store cannot answer.
   *
   * Off by default, which is the right answer for the public lead form: a
   * Firestore outage must not look to a stranger like a refusal to take their
   * details. It is the wrong answer for a bucket whose whole job is to stop
   * an attacker — a login guess counter that fails open turns one outage into
   * an unthrottled window, and the global Meta ceiling that fails open turns
   * one into an unbounded bill. Those pass `failClosed: true`.
   */
  failClosed?: boolean;
};

/**
 * Spend one hit against `bucket` inside a fixed window of `windowMs`,
 * allowing at most `limit` hits inside any one window.
 *
 * The window is identified by `${bucket}:${Math.floor(now / windowMs)}`, so
 * every caller inside the same window shares one document and the window
 * rolls over on its own — nothing ever has to reset a counter by hand.
 *
 * Increment first, then read back. This used to be a transaction, and a
 * transaction is exactly wrong here: Firestore aborts and retries a contended
 * one, and past its retry budget it *throws* — so the busier the bucket, the
 * more likely the limiter is to fall into its own catch and answer `ok: true`.
 * A counter that fails open precisely under load is not a counter. An atomic
 * `increment` never contends, and the `get()` that follows can only be stale
 * by other hits in the same instant, which errs toward refusing rather than
 * allowing.
 *
 * Never throws. A failure is logged as one structured line and answered
 * according to `opts.failClosed` — open for the public form, closed for the
 * buckets that are actually a defence.
 */
export async function hit(
  bucket: string, limit: number, windowMs: number, opts?: HitOptions,
): Promise<Hit> {
  const now = Date.now();
  const windowIndex = Math.floor(now / windowMs);
  const windowEnd = (windowIndex + 1) * windowMs;
  const retryAfterSec = Math.max(1, Math.ceil((windowEnd - now) / 1000));

  try {
    const ref = store().collection(RATELIMIT).doc(`${bucket}:${windowIndex}`);
    // A full window past this window's own end, so the TTL sweep never races
    // the last legitimate read of a window that just closed.
    const expiresAt = ttlWrite(new Date(windowEnd + windowMs).toISOString());
    await ref.set({ count: FieldValue.increment(1), expiresAt }, { merge: true });

    const snap = await ref.get();
    // Our own hit is already in there, so the floor is one rather than zero.
    const count = Math.max(1, (snap.data()?.count as number | undefined) ?? 1);

    const ok = count <= limit;
    return {
      ok,
      remaining: Math.max(0, limit - count),
      retryAfterSec: ok ? 0 : retryAfterSec,
    };
  } catch (e) {
    console.error(JSON.stringify({
      at: 'ratelimit.hit',
      bucket,
      failClosed: opts?.failClosed === true,
      err: e instanceof Error ? e.message : String(e),
    }));
    return opts?.failClosed
      ? { ok: false, remaining: 0, retryAfterSec }
      : { ok: true, remaining: -1, retryAfterSec: 0 };
  }
}

/**
 * A rate-limit key that never carries a visitor's raw IP address into
 * Firestore. Salted with the session/operator secret so the hash cannot be
 * reversed from outside this deployment; sixteen hex characters of a SHA-256
 * is plenty to keep one visitor's buckets distinct from every other's without
 * needing to store the whole digest.
 */
export const ipKey = (ip: string) =>
  'ip:' + createHash('sha256')
    .update(ip + (process.env.SESSION_SECRET || process.env.OPERATOR_KEY || ''))
    .digest('hex')
    .slice(0, 16);

/**
 * The caller's address, as Cloud Run's proxy reports it: the first entry of
 * `x-forwarded-for`, the client closest to the internet rather than the load
 * balancer itself. Spoofable by a determined attacker running their own
 * proxy — which is exactly why this module is one layer and not the whole
 * defence. The real backstop is the global Meta read ceiling, which sits on
 * the spend rather than on the request.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || 'unknown';
}
