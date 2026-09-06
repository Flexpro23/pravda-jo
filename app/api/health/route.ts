import { NextResponse } from 'next/server';
import { store } from '@/lib/store/firebase';
import { hit, ipKey, clientIp } from '@/lib/store/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Is the machinery underneath this site actually alive.
 *
 * Two things fail silently otherwise. Firestore being unreachable shows up
 * first as a prospect's lead not saving — nobody sees that until they ask why
 * a form "didn't work". And the Meta access token has two separate expiries
 * (`discovery.ts` already documents both): `is_valid` flips at 60 days, but
 * `data_access_expires_at` can pass while `is_valid` still reports `true` —
 * the token keeps authenticating and every read starts coming back empty
 * instead of failing loudly. This endpoint is how either is caught before a
 * prospect does, by an uptime monitor or a person checking `/ops`.
 *
 * The Meta check is `debug_token` — the same access token inspecting itself.
 * That is one free metadata call, not a `business_discovery` call, so pinging
 * this endpoint never spends from the ~40/hour read ceiling `claimForRead`
 * enforces. No secret value is ever in the response: booleans, timestamps and
 * a day-count are all that leave this route.
 *
 * Public and unauthenticated on purpose — an uptime monitor cannot hold an
 * operator session — so it is rate-limited like every other open surface.
 */

const META_VERSION = process.env.META_API_VERSION || 'v21.0';
const GRAPH = 'https://graph.facebook.com';

type FirestoreCheck = { ok: boolean; latencyMs: number; error?: string };
type MetaCheck = {
  ok: boolean;
  configured: boolean;
  isValid?: boolean;
  expiresInDays?: number | null;
  dataAccessExpiresInDays?: number | null;
  warning?: string;
  error?: string;
};

/** A get() with a hard ceiling — a hung Firestore connection must not hang the check. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function checkFirestore(): Promise<FirestoreCheck> {
  const started = Date.now();
  try {
    // The smallest possible read: one document, existent or not, that costs
    // nothing to check either way — the answer is whether Firestore answered
    // at all, not what it holds.
    await withTimeout(store().collection('_health').doc('ping').get(), 3000);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: e instanceof Error && e.message === 'timeout' ? 'timeout' : 'unreachable',
    };
  }
}

const daysUntil = (unixSeconds: number | undefined) =>
  typeof unixSeconds === 'number' && unixSeconds > 0
    ? Math.floor((unixSeconds * 1000 - Date.now()) / 86_400_000)
    : null;

async function checkMeta(): Promise<MetaCheck> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, configured: false, error: 'META_ACCESS_TOKEN unset' };

  try {
    const url = `${GRAPH}/${META_VERSION}/debug_token`
      + `?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    const body = await res.json().catch(() => null);
    const data = body?.data;
    if (!res.ok || !data) {
      return { ok: false, configured: true, error: body?.error?.message || `http ${res.status}` };
    }

    const expiresInDays = daysUntil(data.expires_at);
    const dataAccessExpiresInDays = daysUntil(data.data_access_expires_at);
    const isValid = !!data.is_valid;

    const soon = [expiresInDays, dataAccessExpiresInDays]
      .filter((d): d is number => d !== null && d < 7);
    const warning = !isValid
      ? 'Token reports invalid.'
      : soon.length
        ? `Expires in ${Math.min(...soon)} day(s).`
        : undefined;

    return {
      ok: isValid,
      configured: true,
      isValid,
      expiresInDays,
      dataAccessExpiresInDays,
      ...(warning ? { warning } : {}),
    };
  } catch (e) {
    return {
      ok: false,
      configured: true,
      error: e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'network',
    };
  }
}

export async function GET(req: Request) {
  const limited = await hit(ipKey(clientIp(req)) + ':h', 30, 3600_000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'rate-limited' }, {
      status: 429,
      headers: { 'Retry-After': String(limited.retryAfterSec) },
    });
  }

  const [firestore, meta] = await Promise.all([checkFirestore(), checkMeta()]);

  return NextResponse.json(
    { ok: firestore.ok && meta.ok, firestore, meta, checkedAt: new Date().toISOString() },
    // 503 only when Firestore itself is unreachable, matching the store-failure
    // convention in POST /api/lead — a degraded Meta token is real information,
    // not an outage of this service, so it is still a 200 for a monitor to read.
    { status: firestore.ok ? 200 : 503 },
  );
}
