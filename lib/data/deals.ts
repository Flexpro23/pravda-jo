/**
 * The commercial model: talent, deals, bookings.
 *
 * One rule shapes all three, and it is a schema constraint rather than a UI
 * rule because a UI rule is one careless render away from being broken:
 *
 *   PRAVDA is always the connector. A client never learns what a provider
 *   costs. A provider never learns what the client was charged.
 *
 * The way that is enforced here is by absence. A Booking has no field for the
 * client's price — not a hidden one, not a nulled one, none. A talent portal
 * reading a booking document straight out of Firestore and rendering every key
 * it finds still cannot leak the spread, because the number is not in the
 * document it is allowed to read. The client's total lives on the Deal, which
 * talent can never read at all.
 *
 * The same absence carries the second rule: talent sees the client's name only
 * after the deal is signed and paid. `clientName` is written onto the booking
 * at that moment and is simply not there before it.
 */

import type { Attributes } from '@/lib/data/talentFields';
import type { Consent, TalentImage } from '@/lib/data/media';

type B = { ar: string; en: string };

// ── talent ──────────────────────────────────────────────────────────────────

export const DISCIPLINE_RATE = {
  /** The published rate card. PRAVDA sets these; talent never proposes them. */
  videographer: 35,   // shoots and edits, per day
  model: 50,          // per shooting day
  voiceover: 40,      // per day, set 27 Aug 2026
  /**
   * No published rate yet, so none is written here. Zero is not a price — it
   * is the absence of one, and `rateIsSet` turns it into "unbookable" rather
   * than into somebody who can be cast for nothing a day. A photographer can be
   * added to the library, photographed and profiled today; they reach a sheet
   * the day a rate is set here or on their own record.
   */
  photographer: 0,
} as const;

export type TalentDiscipline = keyof typeof DISCIPLINE_RATE;

/**
 * A discipline we can quote. Photographers are the fourth discipline and have
 * no rate yet, which is exactly the case this check exists for: they surface as
 * unbookable rather than as somebody who can be hired for nothing a day.
 */
export const rateIsSet = (d: TalentDiscipline) => DISCIPLINE_RATE[d] > 0;

/**
 * Where someone is, for booking purposes. Deliberately coarse: a producer needs
 * to know whether they can be on a set on a date, not where they are.
 */
export type Availability = 'available' | 'busy' | 'abroad';

export type Talent = {
  id: string;
  name: B;
  discipline: TalentDiscipline;
  /** What PRAVDA pays them per day. Never leaves the booking side. */
  dayRateJOD: number;
  phone: string;
  availability: Availability;
  /** Set when they marked it, so a stale "available" can be distrusted. */
  availabilitySetAt?: string;
  /**
   * What they are actually good for, as trades and traits.
   *
   * Discipline alone says "a model"; eight of those are interchangeable to a
   * sorting function and not remotely interchangeable on a set. Somebody who
   * works skin clinics and knows which frames cannot be shot is the wrong
   * person for a car detailer, and casting either into the other's job is how
   * a shoot day gets bought twice.
   *
   * Free-form on purpose: these are matched against concept verticals and
   * against the words a concept uses about itself, so a tag that matches
   * nothing simply does not pull, rather than breaking a cast.
   */
  tags?: string[];
  /**
   * When a `busy`/`abroad` provider expects to be free again (ISO date).
   *
   * The three-value enum stays the coarse present-tense signal; this is the
   * "until when" it never had. Its absence means unknown, which is honest —
   * and a `busy` whose date has already passed is shown as stale rather than
   * trusted, which `availabilitySetAt` alone could never do.
   */
  availableFrom?: string;
  /** Their own portal sign-in, hashed. Never the phone number itself. */
  passCodeHash?: string;
  /**
   * Folded into the talent session signature, so bumping it invalidates every
   * cookie already issued to this person. Reissuing a code and "sign out
   * everywhere" both bump it; absent reads as 0.
   */
  sessionEpoch?: number;
  /** A reel or an Instagram — whatever they show work with. */
  portfolioUrl?: string;
  /**
   * Contractor basics an operator will need whatever the classification turns
   * out to be: the name that goes on a receipt, and an ID or passport number
   * kept as an opaque string. Deliberately no bank or wallet field — that is a
   * step up in sensitivity that needs its own ask and its own Firestore rules.
   */
  legalName?: string;
  idNumber?: string;
  /** The field for everything the schema did not anticipate. */
  note?: string;

  // ── the library ───────────────────────────────────────────────────────────
  /**
   * The comp-card fields for their discipline — height and shoe size for a
   * model, kit and whether they edit for a videographer. Shaped by
   * `lib/data/talentFields.ts` and cleaned against it on every write, so a key
   * left over from a discipline they no longer have is dropped rather than
   * kept. Operator-only.
   */
  attributes?: Attributes;
  /** Their photographs. Held in Storage; see `lib/data/media.ts` for who may see them. */
  images?: TalentImage[];
  /**
   * What they agreed each photograph may be used for, and until when. Absent
   * means nothing was agreed, and nothing is shown — not even in the console.
   */
  consents?: Consent[];

  active: boolean;
  placeholder?: boolean;
  createdAt: string;
};

// ── deals ───────────────────────────────────────────────────────────────────

export type DealStatus =
  | 'proposed'    // a proposal exists and has been sent
  | 'negotiating' // Khaled is in it
  | 'signed'      // agreed, not yet paid
  | 'paid'        // money received — the point at which talent learns the name
  | 'delivered'
  | 'lost';

/** A concept as sold: what was agreed, and — when there is one — for how much. */
export type SoldConcept = {
  /** Its number in the library, so the brief can be looked up in full. */
  conceptN: number;
  name: string;
  /**
   * Absent for anything sold off a sheet, and that absence is the truth.
   *
   * A sheet sells a pack — so many videos at so much each — and the three
   * ideas are how those videos get made, not three line items. Splitting the
   * agreed total across them would write down a per-idea price nobody agreed
   * to, and the first person to quote it back would be quoting us.
   */
  priceJOD?: number;
};

// ── what a client can choose ────────────────────────────────────────────────

/**
 * The published rate card, client side.
 *
 * "A single video from 150 JOD, ads management from 400 a month" is what the
 * pricing page says, so those are the numbers here — not a rate invented to
 * make an arithmetic nicer. A pack is priced at the same per-video figure
 * because no discounted rate has been published; when one is, it changes here
 * and nowhere else.
 */
export const VIDEO_JOD = 150;
export const RETAINER_JOD = 400;
/** Packs a client can subscribe to, as videos per month. */
export const PACKS = [6, 8] as const;
export type Pack = (typeof PACKS)[number];

export type Selection = {
  /** Indexes into the teardown's own concepts array. */
  concepts: number[];
  /** Videos a month, ongoing. Zero means no subscription. */
  perMonth: 0 | Pack;
  /** Ads management, the thing that is never marketed as AI. */
  ads: boolean;
};

/**
 * Price a selection.
 *
 * Exported and pure so the page and the server compute it the same way — the
 * server recomputes rather than trusting a submitted total, and a second
 * implementation would eventually disagree with the first.
 */
export function priceSelection(
  sel: Selection, conceptPrices: number[],
): { onceJOD: number; monthlyJOD: number } {
  const once = sel.concepts.reduce((a, i) => a + (conceptPrices[i] ?? 0), 0);
  const monthly = sel.perMonth * VIDEO_JOD + (sel.ads ? RETAINER_JOD : 0);
  return { onceJOD: once, monthlyJOD: monthly };
}

export type Deal = {
  id: string;
  /** The teardown this came out of, when it came out of one. */
  teardownToken?: string;
  /** The sheet it was won from, which holds the offer verbatim. */
  sheetToken?: string;
  clientName: string;
  clientHandle?: string;
  clientPhone?: string;
  concepts: SoldConcept[];
  /** What the client pays. Never copied onto a booking. */
  clientTotalJOD: number;
  /** Monthly ads management, when taken. Published as "from 400". */
  retainerJOD?: number;
  /** Ongoing production, as videos a month. Absent means a one-off. */
  perMonth?: number;
  /** What the client picked, kept verbatim so a proposal can be re-read. */
  selection?: Selection;
  /** How this arrived: won off a sheet, submitted by a client, or typed in. */
  source?: 'configurator' | 'operator' | 'sheet';
  contactName?: string;
  contactPhone?: string;
  status: DealStatus;
  /** Why it went away, when it did. Picked from a short list, or typed. */
  lostReason?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  signedAt?: string;
  paidAt?: string;
};

// ── bookings ────────────────────────────────────────────────────────────────

/**
 * Every way a shooting day can end.
 *
 * The first five were the whole vocabulary and production has at least two
 * more: PRAVDA pulls a day after offering it (the client moved the shoot), and
 * somebody accepts and then does not turn up — which is materially different
 * from declining up front and must not sit in the ledger looking like an
 * unpaid `accepted` day forever.
 *
 * A reschedule is deliberately NOT a status: it is a relationship between two
 * bookings, so the new day is an ordinary `offered` booking carrying
 * `rescheduledFrom` and the old one moves to `cancelled`.
 */
export type BookingStatus =
  | 'offered' | 'accepted' | 'declined' | 'cancelled' | 'no_show' | 'done' | 'paid';

/**
 * Where a booking may go from where it is.
 *
 * Written down once, here, rather than re-derived by each screen that offers
 * buttons. `markBooking` was a bare `update`, which meant an operator could
 * walk a paid day back to offered with one mis-tap and nothing would object.
 *
 * `declined`, `cancelled`, `no_show` and `paid` are terminal. A day that needs
 * to happen after one of those is a new booking, not this one reopened —
 * otherwise the record of what actually happened is edited away.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  offered:   ['accepted', 'declined', 'cancelled'],
  accepted:  ['done', 'cancelled', 'no_show'],
  done:      ['paid'],
  declined:  [],
  cancelled: [],
  no_show:   [],
  paid:      [],
};

export const canTransition = (from: BookingStatus, to: BookingStatus) =>
  BOOKING_TRANSITIONS[from].includes(to);

/**
 * The same idea for a deal, which had no table at all.
 *
 * A booking has been guarded since it existed, because a mistyped booking is a
 * message on somebody's phone. A deal was not, and a deal has the more
 * expensive mistake in it: `paid` is the transition that writes the client's
 * name onto every booking against the job, so a stray "paid" — a double-tapped
 * button on a proposal nobody has signed, a console POST replayed — tells the
 * crew who they are shooting for before the money has arrived, and there is no
 * transition back that un-tells them.
 *
 * The shape follows the money. Nothing skips `signed`, because signing is what
 * makes a price a debt; nothing leaves `delivered`, because the job is over.
 * `lost → proposed` is the one reopen: a client who said no in March and rings
 * back in September is the same conversation resuming, and the alternative is
 * an operator making a second deal that double-counts the pipeline.
 */
export const DEAL_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  proposed:    ['negotiating', 'signed', 'lost'],
  negotiating: ['signed', 'lost'],
  signed:      ['paid', 'lost'],
  paid:        ['delivered'],
  delivered:   [],
  lost:        ['proposed'],
};

/**
 * `hasOwnProperty`, not `in`: `'toString' in DEAL_TRANSITIONS` is true, and a
 * status arriving from a JSON body is a string somebody else chose.
 */
export const canDealTransition = (from: DealStatus, to: DealStatus) =>
  Object.prototype.hasOwnProperty.call(DEAL_TRANSITIONS, from)
  && Object.prototype.hasOwnProperty.call(DEAL_TRANSITIONS, to)
  && DEAL_TRANSITIONS[from].includes(to);

/**
 * One person, one day.
 *
 * Read this type as the list of everything a provider is permitted to know.
 * There is no clientTotalJOD here and there must never be one — if a future
 * change needs the client's price alongside a booking, it belongs on the Deal
 * and the join belongs on the operator side, never in a document a talent
 * session can read.
 */
export type Booking = {
  id: string;
  dealId: string;
  talentId: string;
  /** ISO date of the shooting day. */
  date: string;
  /** What PRAVDA pays for this day. The provider's own number, not the spread. */
  feeJOD: number;
  status: BookingStatus;
  /** What they are turning up to do. Never the commercial context. */
  brief: string;
  location?: string;
  callTime?: string;
  /**
   * Written only once the deal is paid. Its absence before that is the rule,
   * not an oversight — see the header.
   */
  clientName?: string;
  createdAt: string;
  respondedAt?: string;
  /**
   * Why they said no, when they said why. Optional on purpose — a provider in
   * a hurry should not be held at a form to decline a day — but when it is
   * there it is the difference between re-offering them the next one and
   * quietly writing them off.
   */
  declineReason?: string;
  /**
   * The booking this one was knowingly double-booked against. Set only when an
   * operator forced an offer past a clash, so the console can show both sides
   * rather than losing the trail.
   */
  conflictWith?: string;
  /** The two halves of a moved day, as booking ids. */
  rescheduledFrom?: string;
  rescheduledTo?: string;
  /**
   * Every time a reminder was sent by hand. Purely informational — there is no
   * scheduler behind it and this file should not imply one.
   */
  remindedAt?: string[];
  paidAt?: string;
  /**
   * When the provider was actually told. Absent means nobody has been — the
   * console shows that rather than assuming an offer reached anyone, because a
   * booking somebody never heard about is a missed shoot, not a pending one.
   */
  notifiedAt?: string;
  /** Why it did not send, when it did not. */
  notifyNote?: string;
};

// ── arithmetic ──────────────────────────────────────────────────────────────

/** A crew day: one videographer-editor, plus every model on it. */
export const crewDayJOD = (models: number) =>
  DISCIPLINE_RATE.videographer + DISCIPLINE_RATE.model * Math.max(0, models);

/** What PRAVDA keeps. Operator-side only; never rendered to either party. */
export const spreadJOD = (deal: Deal, bookings: Booking[]) =>
  deal.clientTotalJOD - bookings.reduce((a, b) => a + b.feeJOD, 0);

export const DEAL_LABEL: Record<DealStatus, string> = {
  proposed: 'Proposed', negotiating: 'Negotiating', signed: 'Signed',
  paid: 'Paid', delivered: 'Delivered', lost: 'Lost',
};

export const BOOKING_LABEL: Record<BookingStatus, B> = {
  offered:   { ar: 'معروض',       en: 'Offered' },
  accepted:  { ar: 'مقبول',       en: 'Accepted' },
  declined:  { ar: 'مرفوض',       en: 'Declined' },
  cancelled: { ar: 'ملغي',        en: 'Cancelled' },
  no_show:   { ar: 'ما حضر',      en: 'No-show' },
  done:      { ar: 'انتهى',       en: 'Done' },
  paid:      { ar: 'مدفوع',       en: 'Paid' },
};

export const AVAILABILITY_LABEL: Record<Availability, B> = {
  available: { ar: 'متاح',        en: 'Available' },
  busy:      { ar: 'مشغول',       en: 'Busy' },
  abroad:    { ar: 'خارج البلد',  en: 'Abroad' },
};

/**
 * The crew a shoot day needs that the roster does not book.
 *
 * `Recommendation.crewNotes` carries these in the concept library's own
 * English — "editor", "motion designer", "crew driver" — because that is what
 * an operator planning the day reads. A client reading an Arabic page should
 * not be handed English job titles in the middle of it, so the sheet resolves
 * them through here. Keys are lowercased before lookup; a role the library
 * adds and this map has not caught up with falls back to its own words rather
 * than disappearing, because an unnamed person on a call sheet is worse than
 * an untranslated one.
 */
export const CREW_LABEL: Record<string, B> = {
  'editor':               { ar: 'مونتير',                  en: 'Editor' },
  'producer':             { ar: 'منتج منفّذ',               en: 'Producer' },
  'photographer':         { ar: 'مصوّر فوتوغرافي',          en: 'Photographer' },
  'motion designer':      { ar: 'مصمّم موشن جرافيك',        en: 'Motion designer' },
  'sound operator':       { ar: 'فنّي صوت',                 en: 'Sound operator' },
  'ai operator':          { ar: 'مشغّل ذكاء اصطناعي',       en: 'AI operator' },
  'crew driver':          { ar: 'سائق طاقم',                en: 'Crew driver' },
  'second videographer':  { ar: 'مصوّر فيديو ثاني',          en: 'Second videographer' },
};
