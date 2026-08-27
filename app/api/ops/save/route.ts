import { NextResponse } from 'next/server';
import { opsAuthed } from '@/lib/ops/auth';
import { getRaw, saveEdits } from '@/lib/store/teardowns';
import { needsWriting } from '@/lib/teardown/compose';
import type { Report } from '@/lib/data/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await opsAuthed())) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? '');
  const report = body?.report as Report | undefined;
  const intent = body?.intent as 'save' | 'ready' | 'sent' | undefined;
  if (!token || !report || !intent) {
    return NextResponse.json({ error: 'malformed' }, { status: 400 });
  }

  const existing = await getRaw(token);
  if (!existing) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  // The token is the document's identity. An edited copy carrying a different
  // one would silently overwrite whichever record that token names.
  if (report.token !== token) {
    return NextResponse.json({ error: 'token-mismatch' }, { status: 400 });
  }

  // A report still holding placeholder prose cannot be released, whatever the
  // button said. This is the same gate getTeardown applies, enforced before the
  // write rather than discovered by a recipient opening an empty page.
  if (intent !== 'save' && needsWriting(report)) {
    return NextResponse.json(
      { error: 'incomplete', detail: 'Some sections still hold placeholder text.' },
      { status: 422 },
    );
  }

  const status = intent === 'save' ? existing.status
    : intent === 'ready' ? 'ready' as const
      : 'sent' as const;

  await saveEdits(token, report, status);
  return NextResponse.json({ ok: true, status });
}
