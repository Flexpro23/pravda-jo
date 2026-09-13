import { servePhoto } from '@/lib/talent/photo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A roster photograph, for the public website.
 *
 * No session, so the rule is the only lock: the operator chose this photo for
 * the website, the person's `roster` and `website` consents are both live, and
 * the person is real rather than a worked example. Any one missing is a 404
 * indistinguishable from a photo that never existed.
 */
export async function GET(
  _req: Request, { params }: { params: Promise<{ talentId: string; imageId: string }> },
) {
  const { talentId, imageId } = await params;
  return servePhoto(talentId, imageId, 'website');
}
