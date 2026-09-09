import { Timestamp, type DocumentData } from 'firebase-admin/firestore';

/**
 * The one place an `expiresAt` crosses between the domain and Firestore.
 *
 * A Firestore TTL policy deletes a document only when its TTL field holds a
 * `Timestamp`. A field holding anything else — a string, a number, `null` — is
 * not an error and is not a warning: the sweep simply passes the document over
 * and it lives forever. So the three collections that promise a retention
 * window (`clients`, `sheets`, `ratelimit`) have to store this field as a real
 * `Timestamp`, and a policy enabled over a string-valued field is a policy that
 * can never fire.
 *
 * The domain types cannot carry a `Timestamp`. `Client` lives in `lib/data`,
 * which client components import, and `Sheet.expiresAt` is composed by the
 * engine in `lib/teardown` under `node --test` with no Firestore anywhere near
 * it — a `firebase-admin` import in either place drags gRPC into the browser
 * bundle. They keep the ISO string every other date in this codebase uses, and
 * the store modules translate at the edge: `ttlWrite` on the way in,
 * `ttlRead` on the way out.
 *
 * Its own module rather than a corner of `clients.ts` or `sheets.ts`, because
 * both of those need it plus `ratelimit.ts`, and making one store import
 * another for a date conversion is how two files that share nothing else end
 * up coupled.
 */

/**
 * The ISO string as Firestore must hold it.
 *
 * `undefined` passes through untouched so a caller can spread this over a
 * document without deciding whether the field exists — `ignoreUndefinedProperties`
 * drops it, which is the same absence the field had before. An unparseable
 * string is dropped rather than written as `Invalid Date`: a document with no
 * TTL field is swept by nobody, which is exactly what a garbage date deserves,
 * and a `Timestamp` built from `NaN` throws on write.
 */
export function ttlWrite(iso: string | undefined | null): Timestamp | undefined {
  if (!iso) return undefined;
  const ms = +new Date(iso);
  return Number.isFinite(ms) ? Timestamp.fromDate(new Date(ms)) : undefined;
}

/**
 * Whatever the document actually holds, as the ISO string the type promises.
 *
 * Three shapes reach this. A `Timestamp` is what every write since this change
 * produces. A string is what the deployed build wrote, and production holds
 * live documents in that shape — they must keep reading correctly until
 * `scripts/backfill-ttl-timestamps.mjs` has been run against them, and after
 * it, forever, because a restored backup can put them back. `undefined` or
 * `null` is a cleared clock: `setClientOutcome` nulls the field on a win where
 * the sheets side deletes it, and both mean the same thing to a reader.
 */
export function ttlRead(value: unknown): string | undefined {
  if (typeof value === 'string') return value || undefined;
  // Duck-typed rather than `instanceof Timestamp`, because the emulator, a
  // restored export and the Admin SDK loaded through two module graphs can all
  // hand back a timestamp that is not the same class object this file closed
  // over — and an `instanceof` that quietly answers `false` would drop the
  // field instead of reading it.
  if (value && typeof (value as Timestamp).toDate === 'function') {
    const d = (value as Timestamp).toDate();
    return Number.isFinite(+d) ? d.toISOString() : undefined;
  }
  return undefined;
}

/**
 * One document, with its `expiresAt` made honest.
 *
 * Every `d.data() as Client` and `d.data() as Sheet` in the store goes through
 * this, because a cast is a claim about the value and a raw `Timestamp` sitting
 * behind a `string` type is that claim being false — the kind of lie that
 * surfaces as `.slice is not a function` in whichever screen renders the date
 * first, not at the read that caused it.
 */
export function withTtl<T>(data: DocumentData): T {
  const expiresAt = ttlRead(data.expiresAt);
  return (expiresAt === undefined
    ? { ...data, expiresAt: undefined }
    : { ...data, expiresAt }) as T;
}
