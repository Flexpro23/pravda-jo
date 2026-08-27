import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { discover, normaliseHandle } from '@/lib/meta/discovery';
import { computeSignals } from '@/lib/teardown/signals';
import { composeDraft, needsWriting } from '@/lib/teardown/compose';
import { mintToken, saveTeardown, findByHandle } from '@/lib/store/teardowns';

// firebase-admin and node:crypto both need the Node runtime, not Edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Run a teardown against one handle.
 *
 * Operator-only, by deliberate choice: acquisition is outbound-first, so the
 * first version of this is a tool for whoever is building the target list, not
 * a public endpoint. It stays that way until there is a queue, a rate limit and
 * a consent record to put in front of it — a form that spends Meta's hourly
 * budget on behalf of anonymous callers is a denial-of-service on ourselves.
 */
const authorised = (req: Request): boolean => {
  const expected = process.env.OPERATOR_KEY;
  if (!expected) return false;                       // unset means closed, not open
  const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(got), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const handle = normaliseHandle(String(body?.handle ?? ''));
  if (!handle) {
    return NextResponse.json({ error: 'handle' }, { status: 400 });
  }

  // Re-reading an account we already hold spends rate limit we do not have
  // much of — roughly 200 calls an hour, four per prospect.
  if (!body?.force) {
    const prior = await findByHandle(handle).catch(() => null);
    if (prior) {
      return NextResponse.json({
        token: prior.token, handle, status: prior.status, reused: true,
      });
    }
  }

  const read = await discover(handle);
  if (!read.ok) {
    // 'unreadable' genuinely cannot be narrowed: personal account, typo,
    // renamed and deleted all return the same error, so we do not guess.
    // 'no-data' and 'unauthorised' are both OUR fault, not the prospect's, and
    // are reported as such so nobody spends an afternoon on a healthy account.
    const status = read.reason === 'throttled' ? 429
      : read.reason === 'unauthorised' || read.reason === 'no-data' ? 502
        : 404;
    const hint = read.reason === 'no-data'
      ? 'The account reports posts but returned none — check whether the token has passed data_access_expires_at.'
      : undefined;
    return NextResponse.json({ error: read.reason, hint }, { status });
  }

  const signals = computeSignals(handle, read.profile.followers_count, read.profile.media);
  if (!signals) {
    return NextResponse.json({ error: 'too-few-posts' }, { status: 422 });
  }

  const token = mintToken();
  const report = composeDraft(signals, token, read.profile.name);
  const now = new Date().toISOString();

  await saveTeardown({
    token, handle,
    // Computed is not finished. A draft is invisible to anyone holding the
    // link until a human has written the parts arithmetic cannot.
    status: needsWriting(report) ? 'draft' : 'ready',
    report, signals,
    readAt: now, createdAt: now,
  });

  return NextResponse.json({
    token, handle,
    status: needsWriting(report) ? 'draft' : 'ready',
    posts: signals.posts,
    followers: signals.followers,
    preview: `/p/${token}`,
    full: `/r/${token}`,
  });
}
