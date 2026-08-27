import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getTalent } from '@/lib/store/deals';
import type { Talent } from '@/lib/data/deals';

/**
 * A provider's session.
 *
 * Entirely separate from the operator's. They share nothing: no cookie, no
 * secret, no code path. A provider holding an operator cookie is not a
 * possibility that has to be reasoned about, because the two never meet.
 *
 * The cookie carries the talent id plus a signature of it, so the id cannot be
 * edited into someone else's. The signing secret is OPERATOR_KEY, which the
 * provider never sees.
 */
export const T_COOKIE = 'pravda_t';

const secret = () => process.env.OPERATOR_KEY?.trim() ?? '';

const sign = (id: string) =>
  createHash('sha256').update(`${id}:${secret()}`).digest('hex').slice(0, 32);

export const sessionValue = (id: string) => `${id}.${sign(id)}`;

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Who is asking. Returns the provider, or null — never a partially trusted id,
 * so a caller cannot accidentally use an unverified one to scope a query.
 */
export async function currentTalent(): Promise<Talent | null> {
  if (!secret()) return null;
  const raw = (await cookies()).get(T_COOKIE)?.value ?? '';
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return null;
  const id = raw.slice(0, dot), sig = raw.slice(dot + 1);
  if (!/^[a-z0-9-]{1,50}$/.test(id) || !same(sig, sign(id))) return null;
  const t = await getTalent(id);
  return t?.active ? t : null;
}
