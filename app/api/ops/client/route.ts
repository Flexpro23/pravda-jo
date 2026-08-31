import { NextResponse } from 'next/server';
import { opsAuthed } from '@/lib/ops/auth';
import { getClient, markNotified, currentSheetOf } from '@/lib/store/clients';
import { getSheet } from '@/lib/store/sheets';
import { tellOperator } from '@/lib/notify/operator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The console's side of the two notices.
 *
 * `compose` tries to send and, when there is no number configured, hands back
 * the exact text and a wa.me link instead. `mark-sent` records that a human
 * did it. They are separate calls on purpose: opening WhatsApp is not sending,
 * and a lead marked handled by a click that only opened an app is a lead
 * nobody will look at again.
 */
export async function POST(req: Request) {
  if (!(await opsAuthed())) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const b = await req.json().catch(() => null);
  const id = String(b?.id ?? '');
  const event = b?.event;
  if (event !== 'new' && event !== 'ready' && event !== 'failed') {
    return NextResponse.json({ error: 'unknown-event' }, { status: 400 });
  }

  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  if (b?.action === 'mark-sent') {
    await markNotified(id, event === 'new' ? 'new' : 'ready');
    return NextResponse.json({ ok: true });
  }

  if (b?.action === 'compose') {
    // The ready message names the sheet, so it needs the newest token and its
    // finding count — announcing a report without a link to it is half a message.
    const token = currentSheetOf(client);
    const sheet = event === 'ready' && token ? await getSheet(token).catch(() => null) : null;
    const notice = await tellOperator(event, client, {
      sheetToken: token ?? undefined,
      findings: sheet?.findings?.findings?.length ?? 0,
    });
    return NextResponse.json(notice);
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
