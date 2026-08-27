import { NextResponse } from 'next/server';
import { opsAuthed } from '@/lib/ops/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Run a teardown from the console.
 *
 * A thin pass-through to the operator API rather than a second copy of the
 * pipeline: one path reads Meta, computes and stores, so the console and a
 * curl can never drift into producing different reports from the same handle.
 */
export async function POST(req: Request) {
  if (!(await opsAuthed())) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);

  const res = await fetch(new URL('/api/teardown', req.url), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPERATOR_KEY?.trim() ?? ''}`,
    },
    body: JSON.stringify({ handle: body?.handle, force: body?.force }),
  });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
