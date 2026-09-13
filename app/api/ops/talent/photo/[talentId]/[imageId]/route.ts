import { opsAuthed } from '@/lib/ops/auth';
import { servePhoto } from '@/lib/talent/photo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A roster photograph, for the console.
 *
 * Behind the operator session, and even then only while the person's `roster`
 * consent is live — holding somebody's photos is itself the processing they
 * agreed to, so an operator with no consent on file sees that photos exist and
 * not what is in them.
 */
export async function GET(
  _req: Request, { params }: { params: Promise<{ talentId: string; imageId: string }> },
) {
  if (!(await opsAuthed())) return new Response('Not found', { status: 404 });
  const { talentId, imageId } = await params;
  return servePhoto(talentId, imageId, 'roster');
}
