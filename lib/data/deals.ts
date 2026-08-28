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

type B = { ar: string; en: string };

// ── talent ──────────────────────────────────────────────────────────────────

export const DISCIPLINE_RATE = {
  /** The published rate card. PRAVDA sets these; talent never proposes them. */
  videographer: 35,   // shoots and edits, per day
  model: 50,          // per shooting day
  voiceover: 40,      // per day, set 27 Aug 2026
} as const;

export type TalentDiscipline = keyof typeof DISCIPLINE_RATE;

/**
 * A discipline we can quote. All three are set today, but the check stays: a
 * fourth discipline added without a rate should surface as unbookable rather
 * than as somebody who can be hired for nothing a day.
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
  /** Their own portal sign-in, hashed. Never the phone number itself. */
  passCodeHash?: string;
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
  note?: string;
  createdAt: string;
  updatedAt: string;
  signedAt?: string;
  paidAt?: string;
};

// ── bookings ────────────────────────────────────────────────────────────────

export type BookingStatus = 'offered' | 'accepted' | 'declined' | 'done' | 'paid';

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
  offered:  { ar: 'معروض',  en: 'Offered' },
  accepted: { ar: 'مقبول',  en: 'Accepted' },
  declined: { ar: 'مرفوض',  en: 'Declined' },
  done:     { ar: 'انتهى',  en: 'Done' },
  paid:     { ar: 'مدفوع',  en: 'Paid' },
};

export const AVAILABILITY_LABEL: Record<Availability, B> = {
  available: { ar: 'متاح',        en: 'Available' },
  busy:      { ar: 'مشغول',       en: 'Busy' },
  abroad:    { ar: 'خارج البلد',  en: 'Abroad' },
};
