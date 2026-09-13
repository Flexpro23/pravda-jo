import { NextResponse } from 'next/server';
import { opsAuthed, sameOrigin } from '@/lib/ops/auth';
import { sniff } from '@/lib/store/media';
import { readCompCard } from '@/lib/talent/readCard';
import { IMAGE_MAX_BYTES } from '@/lib/data/media';
import { DISCIPLINE_RATE, type TalentDiscipline } from '@/lib/data/deals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Read a comp card image into a draft the console can show.
 *
 * Stores nothing and touches no record: the image is read, the draft is
 * returned, and the bytes are gone with the request. Saving is the operator's
 * separate act through `/api/ops/talent/media`, after they have looked.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  if (!(await opsAuthed())) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const discipline = String(form?.get('discipline') ?? '') as TalentDiscipline;
  if (!(file instanceof File) || !Object.prototype.hasOwnProperty.call(DISCIPLINE_RATE, discipline)) {
    return NextResponse.json({ error: 'malformed' }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.length) return NextResponse.json({ error: 'empty' }, { status: 400 });
  if (bytes.length > IMAGE_MAX_BYTES) return NextResponse.json({ error: 'too-large' }, { status: 413 });
  const mimeType = sniff(bytes);
  if (!mimeType) return NextResponse.json({ error: 'not-an-image' }, { status: 415 });

  const r = await readCompCard({ bytes, mimeType }, discipline);
  if (!r.ok) {
    const status = r.why === 'unconfigured' ? 503 : r.why === 'timeout' ? 504 : 502;
    const detail = {
      unconfigured: 'Reading cards needs Gemini, which is not configured on this deployment.',
      timeout: 'The card took too long to read. Try a smaller or clearer picture.',
      request: 'The card could not be read just now. Type it in, or try again.',
      unparseable: 'The card could not be read into fields. Type it in, or try a clearer picture.',
    }[r.why];
    return NextResponse.json({ error: `card-${r.why}`, detail }, { status });
  }
  return NextResponse.json(r);
}
