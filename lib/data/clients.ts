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
  /** Teardowns from the older long-form pipeline, same reasoning. */
  teardownTokens: string[];
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
  /** The language they arrived in, so a reply is written in the one they used. */
  lang: 'ar' | 'en';
  createdAt: string;
  updatedAt: string;
};

/** Does this client still owe somebody a message? */
export const owesNotice = (c: Client) =>
  !c.notifiedNewAt || (c.status === 'ready' && !c.notifiedReadyAt);

/** The newest sheet, which is the one the console opens. */
export const currentSheet = (c: Client) => c.sheetTokens[0] ?? null;
