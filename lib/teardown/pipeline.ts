import {
  advanceClient, attachToClient, getClient, resumeAfterRead, setBusinessName,
} from '@/lib/store/clients';
import { runRead } from '@/lib/teardown/run';
import { tellOperator } from '@/lib/notify/operator';
import type { Client, ReadFailure } from '@/lib/data/clients';
import type { Vertical } from '@/lib/data/concepts';

/**
 * Read one claimed account and file everything that comes out of it.
 *
 * This is the body that used to live inside the lead route's `after()`, and the
 * reason it moved is that three callers need it and only one of them is a
 * response. The public form runs it as a fast path, the cron sweeper runs it
 * for everything the fast path dropped, and the console's "Re-run read" button
 * runs it on demand. Three copies of "read, attach, name, advance, notify"
 * would drift within a month, and the drift would be invisible: the client
 * would read one version's sheet while Khaled defended another's.
 *
 * It assumes the claim has already been taken — `claimForRead` is what makes it
 * safe to call from two places at once, and calling this without a claim is how
 * a lead gets read twice and Khaled gets told twice.
 *
 * It does not send the `new` notice. That one is time-critical and belongs on
 * the response path, before the visitor's form has even settled; sending it
 * from here would be sending it late, and sending it from here on a *sweep*
 * would be sending it twice.
 */

export type FiledOk = { ok: true; token: string; site: boolean };
export type FiledFail = { ok: false; reason: ReadFailure };
export type Filed = FiledOk | FiledFail;

/**
 * One structured line per transition.
 *
 * Cloud Logging parses a JSON-shaped stdout line into queryable fields on its
 * own, so this needs no library and no configuration — and it is what lets
 * either of them find a stuck lead by grepping for an outcome instead of
 * opening the console and scrolling. The handle and the outcome go in; the
 * contact name and the phone number never do, because a log is the one place
 * personal data ends up copied into a system nobody thought to lock.
 */
const log = (row: Record<string, unknown>) => console.log(JSON.stringify(row));

export async function readAndFile(
  client: Client, opts?: { vertical?: Vertical | null },
): Promise<Filed> {
  const t0 = Date.now();
  const handle = client.handle;
  log({ msg: 'read.start', handle, clientId: client.id });

  try {
    // The operator's answer beats the account's remembered one, and both beat
    // the guesser — a vertical somebody confirmed is not re-derived on a re-run.
    const vertical = opts?.vertical ?? client.vertical ?? null;
    const run = await runRead({ handle, website: client.website, vertical });

    if (!run.ok) {
      await advanceClient(client.id, 'failed', run.reason);
      // A forced re-read of a client Khaled had already sent to borrowed that
      // status to hold the lease; a read that failed is not grounds to keep it.
      await resumeAfterRead(client.id, run.reason).catch(() => null);
      log({
        msg: 'read.done', handle, clientId: client.id,
        durationMs: Date.now() - t0, outcome: 'failed', reason: run.reason,
        siteRead: false, metaCallsUsed: 1,
      });
      // Re-read, so the message carries the failure reason that was just written
      // rather than the stale copy the caller was holding.
      const failed = await getClient(client.id);
      if (failed) await tellOperator('failed', failed);
      return { ok: false, reason: run.reason };
    }

    await attachToClient(client.id, 'sheet', run.sheet.token);
    if (run.sheet.clientName) await setBusinessName(client.id, run.sheet.clientName);
    // `advance`, not `force`: a client Khaled has already sent to, won or lost
    // keeps that status while this sheet is filed underneath it. `advance`
    // cannot see through a forced claim, though — by now the account really is
    // `reading`, which is behind `ready` — so the status the claim borrowed is
    // handed back here, after the sheet has been filed.
    await advanceClient(client.id, 'ready');
    await resumeAfterRead(client.id).catch(() => null);

    log({
      msg: 'read.done', handle, clientId: client.id,
      durationMs: Date.now() - t0, outcome: 'ok',
      siteRead: run.site, metaCallsUsed: 1,
    });

    const ready = await getClient(client.id);
    if (ready) {
      await tellOperator('ready', ready, {
        sheetToken: run.sheet.token,
        findings: run.sheet.findings.findings.length,
      });
    }
    return { ok: true, token: run.sheet.token, site: run.site };
  } catch (e) {
    // A background failure must leave a mark rather than vanish. The console
    // reads `failed` as a queue to work, so the lead surfaces either way.
    await advanceClient(client.id, 'failed', 'network').catch(() => {});
    await resumeAfterRead(client.id, 'network').catch(() => null);
    log({
      msg: 'read.done', handle, clientId: client.id,
      durationMs: Date.now() - t0, outcome: 'failed', reason: 'network',
      siteRead: false, metaCallsUsed: 1,
      err: e instanceof Error ? e.message : 'unknown',
    });
    const failed = await getClient(client.id).catch(() => null);
    if (failed) await tellOperator('failed', failed).catch(() => {});
    return { ok: false, reason: 'network' };
  }
}
