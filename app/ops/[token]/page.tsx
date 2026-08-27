import Link from 'next/link';
import { notFound } from 'next/navigation';
import { opsAuthed } from '@/lib/ops/auth';
import { getRaw } from '@/lib/store/teardowns';
import Editor from '@/components/ops/Editor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ReviewOne({
  params,
}: { params: Promise<{ token: string }> }) {
  if (!(await opsAuthed())) {
    return (
      <main className="gate">
        <h1>PRAVDA — operator</h1>
        <p className="muted">This session has expired.</p>
        <p><Link className="btn" href="/ops">Sign in</Link></p>
      </main>
    );
  }

  const { token } = await params;
  const t = await getRaw(token);
  if (!t) notFound();

  return (
    <main className="wrap">
      <div className="top">
        <h1>@{t.handle}</h1>
        <span className="pill" data-s={t.status}>{t.status}</span>
        <span className="sp" />
        <Link className="btn" href="/ops">← Queue</Link>
      </div>
      <Editor initial={t.report} signals={t.signals} status={t.status} />
    </main>
  );
}
