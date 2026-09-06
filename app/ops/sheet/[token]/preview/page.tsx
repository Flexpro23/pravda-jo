import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSheet } from '@/lib/store/sheets';
import SheetView from '@/components/SheetView';
import '../../../../s/s.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What they will see, before they see it.
 *
 * "See what they see" only existed once the link was live, which meant the
 * first person ever to read a finished sheet was the prospect. This renders the
 * draft through the same component `/s` uses, so what is checked is the
 * artefact and not a description of it.
 *
 * It is behind the console's own gate — the layout above it does that once for
 * everything under `/ops` — and it never mounts the opened beacon, because a
 * sheet opened by the person who wrote it is not a sheet the client read.
 *
 * The one honest caveat: this page lives inside the console's document, so it
 * inherits `<html lang="en" dir="ltr">` and `ops.css` underneath `s.css`. The
 * Arabic runs right-to-left from the wrapper below and the type is the real
 * type; the surrounding chrome is not. For a pixel-exact reading, approve and
 * open `/s`.
 */
export default async function Preview({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sheet = await getSheet(token);
  if (!sheet) notFound();

  return (
    <>
      {/* Not `position: fixed` — it should scroll away, because it is a note to
          the operator and not part of what is being judged. */}
      <div className="prevbar">
        <Link className="btn" href={`/ops/sheet/${token}`}>← Back to the sheet</Link>
        <span className="mono">
          {sheet.status === 'approved' ? 'approved' : 'draft'} · nothing here is recorded as an open
        </span>
      </div>
      <div lang="ar" dir="rtl">
        <SheetView sheet={sheet} ar />
      </div>
    </>
  );
}
