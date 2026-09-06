/**
 * A client account — the record everything else hangs off.
 *
 * Before this existed, a teardown was the root object: it was addressed by a
 * token, it carried a handle, and there was nowhere to put the fact that a
 * person had asked for it. Which meant the one thing a stranger can do on the
 * public site — hand over their handle — had nowhere to land, and the form
 * that did it threw the lead away.
 *
 * So the client is the root now. It is created the moment somebody asks, before
 * anything has been read and whether or not the read later succeeds, because a
 * lead that arrives during a Meta outage is still a lead. Everything produced
 * about that business afterwards — every sheet, every teardown, the deal — is
 * attached here rather than living loose in its own collection with a handle
 * copied onto it.
 *
 * The document id is the normalised Instagram handle. That is deliberate: one
 * business is one account, and making that a database constraint rather than a
 * query means a second submission from the same shop cannot produce a second
 * client no matter which code path it arrives through.
 */

import type { Vertical } from '@/lib/data/concepts';

export type ClientStatus =
  /** They asked. Nothing has been read yet. */
  | 'new'
  /** The engine is on it. Set before the read starts so a crash is visible. */
  | 'reading'
  /** A sheet exists and is waiting for Khaled. */
  | 'ready'
  /**
   * The read could not complete. Not a dead end — a personal account is the
   * most common cause and the fix is one message pointing at the helper page,
   * so this is a queue to work rather than a bin.
   */
  | 'failed'
  /** Khaled approved a sheet and sent the link. */
  | 'sent'
  | 'won'
  | 'lost';

export const CLIENT_LABEL: Record<ClientStatus, string> = {
  new: 'New', reading: 'Reading', ready: 'Report ready', failed: 'Read failed',
  sent: 'Sent', won: 'Won', lost: 'Lost',
};

/**
 * Why a read failed, in the engine's own words.
 *
 * Kept verbatim rather than rewritten into something friendlier, because the
 * distinctions are load-bearing: `unreadable` is the prospect's account,
 * `unauthorised` and `no-data` are our token, and telling them apart is what
 * stops somebody spending an afternoon on a healthy account. The console turns
 * each into a sentence and, where there is one, an action.
 */
export type ReadFailure =
  | 'unreadable' | 'throttled' | 'unauthorised' | 'no-data'
  | 'network' | 'too-few-posts' | 'handle';

export const FAILURE_NOTE: Record<ReadFailure, { what: string; do_: string }> = {
  unreadable: {
    what: 'Instagram would not return this account.',
    do_: 'Almost always a personal account. Send them the switch-to-professional page.',
  },
  throttled: {
    what: 'Meta’s hourly budget is nearly spent.',
    do_: 'Re-run it in an hour. Nothing is wrong with the account.',
  },
  unauthorised: {
    what: 'Our token was refused. This is ours, not theirs.',
    do_: 'Check META_ACCESS_TOKEN — it may have expired.',
  },
  'no-data': {
    what: 'The account reports posts and returned none. Also ours.',
    do_: 'The token has probably passed data_access_expires_at. Reissue it.',
  },
  network: {
    what: 'Meta did not answer.',
    do_: 'Re-run it. If it keeps happening, check the Graph API status.',
  },
  'too-few-posts': {
    what: 'Fewer than two posts in the window — nothing defensible to say.',
    do_: 'Not worth a sheet. Worth a message.',
  },
  handle: {
    what: 'That is not a usable Instagram handle.',
    do_: 'Check what they typed and re-run it by hand.',
  },
};

/**
 * A line in the account's own margin.
 *
 * Two people run this studio and they do not sit in the same room. "Called him,
 * he wants to think about it" is the single most valuable thing either of them
 * knows about a lead, and until there was somewhere to put it, it lived in one
 * head. `by: 'system'` is for the notes nobody typed — the ones the sweeper
 * leaves when it gives up on a read.
 */
export type ClientNote = {
  at: string;
  by: 'ali' | 'khaled' | 'system';
  text: string;
};

/** Which way Khaled was actually reached, once the cascade found a way. */
export type NotifyChannel = 'whatsapp' | 'telegram' | 'email' | 'manual';

export type Client = {
  /** The normalised handle. Also the document id — see the header. */
  id: string;
  handle: string;
  contactName: string;
  contactPhone: string;
  /** What they typed, or what their own bio pointed at. */
  website?: string;
  /** The business's own display name, learned from the read rather than asked for. */
  businessName?: string;
  /** How they arrived. `intake` is the public form; `operator` is a handle typed in. */
  source: 'intake' | 'operator';
  status: ClientStatus;
  /**
   * Every sheet run for them, newest first.
   *
   * A list rather than a single token because a business read in March and
   * again in September is the same client with two reads, and the second must
   * not overwrite the first — the whole point of the account is that the
   * history accumulates somewhere.
   */
  sheetTokens: string[];
  /**
   * Tokens from the older long-form pipeline.
   *
   * Nothing writes this any more — the report, its routes and its store went
   * with the retirement of `/r`. The field stays optional so documents written
   * before that still parse and nobody has to run a migration over the whole
   * collection to delete a key nobody reads.
   */
  teardownTokens?: string[];
  /** The deal, once a sheet has been won. */
  dealId?: string;
  /** Why the last read failed, if it did. */
  readError?: ReadFailure;
  /**
   * When Khaled was told, per event. Absent means he has not been.
   *
   * Two separate fields rather than one, because the two notifications answer
   * different questions — "somebody wants us" and "there is something to
   * review" — and a lead whose read is still running has had the first and not
   * the second. Recording them here rather than on a queue means a message that
   * failed to send stays visibly unsent instead of being assumed delivered.
   */
  notifiedNewAt?: string;
  notifiedReadyAt?: string;
  /**
   * When the `new` notice was last *attempted*, sent or not.
   *
   * Separate from `notifiedNewAt`, which only ever records a success. Without
   * it the sweeper's retry is unbounded: an account whose every channel is
   * down never gets a `notifiedNewAt`, so every invocation of the cron — once
   * a minute — tries the whole cascade again, and a WhatsApp window that has
   * closed is retried sixty times an hour forever. This is what makes that
   * retry hourly instead.
   */
  notifyNewAttemptedAt?: string;
  /**
   * Which channel carried the last notice. The cascade tries WhatsApp, then
   * Telegram, then email, then gives up and hands a human a link — and "he was
   * told" is a different fact from "he was told by the thing we expected to
   * tell him", which is how a silently dead WhatsApp window gets noticed.
   */
  lastNotifyChannel?: NotifyChannel;

  // ── the read queue ────────────────────────────────────────────────────────
  /**
   * When this account started waiting for a read.
   *
   * Set the moment the account is opened (or re-opened) as `new`, and by the
   * global ceiling when a read is deferred rather than spent. It is the sort
   * order of the sweeper's queue, so oldest waits first: without it a busy
   * hour would serve whichever document Firestore happened to return.
   */
  queuedAt?: string;
  /** When the current read claimed it. */
  readStartedAt?: string;
  /**
   * How long that claim is good for.
   *
   * The whole point of the lease: an instance that dies mid-read cannot tell
   * anybody, so the claim has to expire on its own or the lead sits in
   * `reading` forever — which is the exact bug the queue exists to kill.
   */
  readLeaseUntil?: string;
  /** How many times a read has been claimed. Three strikes and it is `failed`. */
  readAttempts?: number;
  /**
   * The status a forced re-read borrowed the account from, to be put back.
   *
   * `claimForRead({force: true})` is the console's "Re-run read", and it has
   * to write `reading` over whatever was there or the lease means nothing.
   * For an account past `ready` that is a lie in progress: the read finishes,
   * files its sheet, advances to `ready` — and a client Khaled had already
   * sent to is back in the queue as work to do. So the borrowed status is
   * written down here and restored once the read has filed, which is the one
   * thing `advanceClient` cannot do for us, because by then the account
   * genuinely is `reading` and `reading` is behind `ready`.
   */
  resumeStatus?: ClientStatus;

  // ── what a human knows about them ─────────────────────────────────────────
  /**
   * The vertical, once somebody has confirmed it. Never asked on the public
   * form; set by the operator and reused on every later read, so a correction
   * made once does not have to be made again.
   */
  vertical?: Vertical;
  notes?: ClientNote[];
  /** Why they said no, in the operator's own words. Only ever set with `lost`. */
  lostReason?: string;
  /**
   * When an unconverted lead is deleted. Cleared the day they become a client,
   * because a customer's record is not a lead's record. A Firestore TTL policy
   * on this field is what actually does the deleting.
   */
  expiresAt?: string;

  /** The language they arrived in, so a reply is written in the one they used. */
  lang: 'ar' | 'en';
  createdAt: string;
  updatedAt: string;
};

/**
 * How far along the pipeline a status sits.
 *
 * The engine may only move an account it is still ahead of. A sheet re-read for
 * a client Khaled already sent to — or won — is filed underneath the status the
 * human put there, because the machine finishing a second read is not news
 * about the relationship. `failed` shares a rank with `reading` on purpose: a
 * read that did not finish leaves the account exactly where it was.
 */
export const STATUS_RANK: Record<ClientStatus, number> = {
  new: 0, reading: 1, failed: 1, ready: 2, sent: 3, won: 4, lost: 4,
};

/** The three the engine is allowed to set by itself. */
export const ENGINE_STATUS: ClientStatus[] = ['reading', 'ready', 'failed'];

/**
 * Three claims and the sweeper stops trying.
 *
 * Not a guess: each attempt spends a Meta call out of a budget of about two
 * hundred an hour, and a handle that has failed three separate reads is
 * telling us something about itself — almost always that it is a personal
 * account — which is a message to send, not a call to repeat every minute
 * until the hour's budget is gone.
 */
export const MAX_READ_ATTEMPTS = 3;

export const outOfAttempts = (c: Client) => (c.readAttempts ?? 0) >= MAX_READ_ATTEMPTS;

/** A claim nobody renewed. The sweeper's whole job, in one predicate. */
export const leaseExpired = (c: Client, at = Date.now()) =>
  c.status === 'reading' && (!c.readLeaseUntil || +new Date(c.readLeaseUntil) <= at);

/** Does this client still owe somebody a message? */
export const owesNotice = (c: Client) =>
  !c.notifiedNewAt || (c.status === 'ready' && !c.notifiedReadyAt);

/** The newest sheet, which is the one the console opens. */
export const currentSheet = (c: Client) => c.sheetTokens[0] ?? null;
