import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Talent } from '@/lib/data/deals';

/**
 * A provider's session.
 *
 * Entirely separate from the operator's. They share nothing: no cookie, no
 * secret, no code path. A provider holding an operator cookie is not a
 * possibility that has to be reasoned about, because the two never meet.
 *
 * The cookie carries the talent id, the epoch their sessions are counted from
 * and the date it was minted, plus an HMAC over all three. Editing any of them
 * breaks the signature, so the id cannot be swapped for someone else's, the
 * date cannot be pushed forward past the TTL, and a cookie minted before a code
 * reissue does not survive it — which is what makes "lost phone" answerable
 * without deactivating the person's whole account.
 *
 * `sha256(id + secret)` was the previous construction: plain-hash-with-appended
 * -secret, which happens to avoid a length-extension attack only because of the
 * order the two are concatenated in. Correct by accident is not correct.
 */
export const T_COOKIE = 'pravda_t';

/**
 * Sixty days. This is a phone kept in a pocket, not a desk someone walks away
 * from, and a provider re-entering a code before every shoot would stop using
 * the portal. Enforced here rather than left to the browser's `maxAge`.
 */
export const T_TTL_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * A dedicated secret, falling back twice.
 *
 * `OPERATOR_KEY` signed these until now, which coupled two lifecycles that
 * should not be coupled: rotating the console key to revoke one operator
 * session signed out every provider on their phone, possibly the morning of a
 * shoot. `TALENT_SESSION_SECRET` decouples it; the chain through
 * `SESSION_SECRET` to `OPERATOR_KEY` means nothing breaks before it is
 * provisioned.
 */
const secret = () =>
  (process.env.TALENT_SESSION_SECRET
    || process.env.SESSION_SECRET
    || process.env.OPERATOR_KEY
    || '').trim();

const sign = (id: string, epoch: number, issuedAt: number) =>
  createHmac('sha256', secret())
    .update(`${id}:${epoch}:${issuedAt}`)
    .digest('hex')
    .slice(0, 32);

const same = (a: string, b: string) => {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

/** The cookie value for a provider, at the epoch their account is currently on. */
export const sessionValue = (id: string, epoch = 0, issuedAt: number = Date.now()) =>
  `${id}.${epoch}.${issuedAt}.${sign(id, epoch, issuedAt)}`;

export type TalentSession = { id: string; epoch: number; issuedAt: number };

/**
 * What a cookie says about itself, once the signature and the age have been
 * checked — or null. Never a partially trusted id: a caller cannot accidentally
 * scope a query by something that failed verification, because nothing is
 * returned unless everything passed.
 */
export function readSession(raw: string): TalentSession | null {
  if (!secret()) return null;
  const parts = (raw ?? '').split('.');
  if (parts.length !== 4) return null;

  const [id, epochRaw, issuedRaw, sig] = parts;
  if (!/^[a-z0-9-]{1,50}$/.test(id)) return null;
  if (!/^\d{1,10}$/.test(epochRaw) || !/^\d{10,15}$/.test(issuedRaw)) return null;

  const epoch = Number(epochRaw);
  const issuedAt = Number(issuedRaw);
  const age = Date.now() - issuedAt;
  if (age < -60_000 || age >= T_TTL_MS) return null;   // skew tolerance, then the wall

  return same(sig, sign(id, epoch, issuedAt)) ? { id, epoch, issuedAt } : null;
}

/**
 * The roster carries `sessionEpoch` as an optional field — an account that has
 * never had a session revoked has never needed one written. Absent is zero, on
 * both sides of the comparison, so the default case compares equal.
 */
export const epochOf = (t: Talent): number => t.sessionEpoch ?? 0;

/**
 * Who is asking. Returns the provider, or null.
 *
 * Three things have to hold: the cookie verifies, the account is still active,
 * and the epoch it was minted under is the epoch the account is on now. The
 * third is the one that makes "Reissue code" and "Sign out everywhere" mean
 * something — before it, a stolen phone with a live cookie stayed signed in
 * however many times the code was reissued.
 *
 * Both the request context and the store are imported where they are used
 * rather than at the top of the file: `next/headers` cannot be resolved by
 * Node's own loader, and the store drags a Firestore client in with it. The
 * session format above is worth unit-testing without either.
 */
export async function currentTalent(): Promise<Talent | null> {
  const { cookies } = await import('next/headers');
  const session = readSession((await cookies()).get(T_COOKIE)?.value ?? '');
  if (!session) return null;

  const { getTalent } = await import('@/lib/store/deals');
  const t = await getTalent(session.id);
  if (!t || !t.active) return null;
  return epochOf(t) === session.epoch ? t : null;
}
