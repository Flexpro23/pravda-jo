import { NextResponse } from 'next/server';
import { opsAuthed } from '@/lib/ops/auth';
import { byId, toReportConcept } from '@/lib/data/concepts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Adapt one library concept into a report concept.
 *
 * Server-side on purpose: the library is long-form source material and has no
 * business being shipped to a browser that only needs the one entry an
 * operator just clicked. The console holds a slim index for picking; the prose
 * arrives one concept at a time.
 */
export async function POST(req: Request) {
  if (!(await opsAuthed())) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const src = byId(Number(body?.n));
  if (!src) return NextResponse.json({ error: 'no-such-concept' }, { status: 404 });
  return NextResponse.json({ concept: toReportConcept(src), source: src });
}
