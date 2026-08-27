/**
 * The concept library — thirty pieces, researched and red-teamed.
 *
 * The rule this file exists to enforce: the engine SELECTS AND ADAPTS from
 * here. It never invents a concept. An invented idea cannot be costed against
 * a real crew day, cannot be cast from a real roster, and has not survived
 * anyone asking whether it is legal to shoot in Jordan — all three of which
 * every entry below has.
 *
 * English only, and deliberately so. This is source material for an operator,
 * not copy for a recipient: a concept becomes bilingual when it is adapted
 * into a specific teardown, where the Arabic is written for that business
 * rather than translated from stock. `toReportConcept` seeds the English and
 * marks the Arabic unwritten, so an untranslated concept cannot ship.
 *
 * The economics are the library's own modelling at the published rate card —
 * 35 JOD a videographer-editor, 50 per model per day. They are a guide to what
 * a piece is worth quoting, not a price to paste into a proposal unread.
 *
 * Extracted from the Concept Library artifact, 27 Aug 2026.
 */

/** What a piece costs to make, in crew and days rather than money. */
export type Tier = 'light' | 'standard' | 'premium';

/** The eight verticals the library was written against. */
export type Vertical =
  | 'food' | 'retail' | 'body' | 'fitness'
  | 'property' | 'auto' | 'edu' | 'pro';

export const VERTICAL_LABEL: Record<Vertical, { ar: string; en: string }> = {
  food:     { ar: 'أكل ومشروبات',   en: 'Food & drink' },
  retail:   { ar: 'تجزئة وأزياء',    en: 'Retail & fashion' },
  body:     { ar: 'عيادات وتجميل',   en: 'Clinics & beauty' },
  fitness:  { ar: 'نوادي ولياقة',    en: 'Gyms & fitness' },
  property: { ar: 'عقارات',          en: 'Real estate' },
  auto:     { ar: 'سيارات',          en: 'Automotive' },
  edu:      { ar: 'تعليم وتدريب',    en: 'Education' },
  pro:      { ar: 'خدمات مهنية',     en: 'Professional services' },
};

export type ConceptSource = {
  /** Its number in the library, so a conversation can name one unambiguously. */
  n: number;
  name: string;
  tier: Tier;
  verticals: Vertical[];
  /** What actually gets shot, and in how many days. */
  format: string;
  /** Modelled at the published rate card. A guide, never a quote. */
  economics: {
    costJOD: number; originations: number;
    billedJOD: number; grossJOD: number; marginPct: number;
  };
  /** The first two seconds. */
  hook: string;
  /** The whole idea, shot by shot. */
  premise: string;
  why: string;
  production: { cast: string; crew: string; location: string; kit: string };
  castingNotes: string;
  /** Arabic, dialect, and the Jordanian legal edges specific to this piece. */
  localeNotes: string;
};

export const CONCEPTS: ConceptSource[] = [
  {
    n: 1, name: "The Inbox Twelve",
    tier: "light", verticals: ["body", "property", "auto", "edu", "pro"],
    format: "Talking-head batch. 10-12 Reels of 20-40s plus 5 twelve-second price cutdowns, all from one half-day (5-6 hours) on one setup. Budget 1.5 editor days for the batch.",
    economics: { costJOD: 35, originations: 10, billedJOD: 1500, grossJOD: 1465, marginPct: 98 },
    hook: "A full-screen card carrying the customer's own question in their own words, zero branding — then the person is already talking before second two.",
    premise: "Pre-production is the concept: PRAVDA exports 90 days of the client's real WhatsApp Business inbox and pulls the twelve questions customers actually type. Single setup, never moved: the principal in their own room, chest up, off-centre with the question burned into the empty side. Frame one is a full-screen card holding the question verbatim in dialect ('ليش أسعاركم أغلى؟') for 1.2s. Cut in with them already mid-answer — no greeting. Three beats: direct answer, reason, then the number or the caveat. Two 1.5s inserts of the thing discussed. End on the answer as text plus a WhatsApp line. Reset, next question. Five of the twelve are re-cut as 12s price versions: the question card, a 3s making-of cutaway, the number slamming full-screen with a sound hit, one beat back to the principal — 'شفت؟ سهلة.' Jacket on/off at the halfway point so eight weeks of drip does not look like one afternoon.",
    why: "Both platforms function as search, so answer-first clips stating the query as literal on-screen text keep surfacing for months instead of dying in 72 hours. This is the only compounding asset in the library. The harvest is what makes it uncopyable and Teardown-native: PRAVDA shows the owner their own dead messages, then shoots the answers. Highest yield per crew day in the set, and the ads team gets twelve entry points to test which objection actually blocks the sale.",
    production: {
      cast: "Client-fronted — no models",
      crew: "videographer, editor",
      location: "client premises",
      kit: "lav mic plus backup shotgun · two-point key and fill, or one large window and bounce · 85mm or 50mm prime · stool · printed harvested question list · physical objects for the inserts · price cards on heavy stock for the cutdowns",
    },
    castingNotes: "The client's own principal — for clinics and dentists this is mandatory, never a hired presenter, because a non-staff face quoting prices for a regulated service is a misrepresentation and syndicate exposure. Choose the partner with warmth over the most senior. Coach them to skip the greeting; schedule the two easiest questions first, never open with money. Pre-shoot screening call plus a 48-hour reschedule fee: a principal who collapses on camera is the only way this concept loses money.",
    localeNotes: "Harvest from the real WhatsApp inbox, not a brainstorm — in Jordan WhatsApp is where the sale closes. Answer in dialect, write the cards in dialect, let technical terms land in English or MSA where professionals actually say them. Clinics price only defined services and always with 'من'; check the dental or medical council position before publishing any regulated price. Never AI-generate this face. Arabic RTL caption burn-in is slow — budget a 100% check pass on all twelve.",
  },
  {
    n: 2, name: "The Forty Fils Number",
    tier: "light", verticals: ["food", "retail", "auto", "edu", "pro"],
    format: "Reel 15-45s shot to look self-filmed. 4-6 originations per visit; 15s and 8s retargeting trims bundled free, not counted as assets.",
    economics: { costJOD: 35, originations: 4, billedJOD: 600, grossJOD: 565, marginPct: 94 },
    hook: "An owner mid-sentence in an unglamorous back room, phone-height and off-centre, opening on a concession: 'بصراحة، إحنا مش الأرخص بعمّان.' Cut hard, let the silence sit.",
    premise: "The owner, chef or nineteen-year mechanic, filmed at arm's length and phone height in the part of the business nobody photographs — the prep line, the stockroom, the workshop floor, the back office with the invoices on it. Handheld on purpose, ambient noise in, no visible lav, no ring light. Three questions asked off camera and never heard: why did you open this, what does everyone get wrong, what would you say to someone hesitating right now. The hard rule is the concept: no take ships without one specific checkable number the owner volunteers — 'هاي بتكلفنا ٤٠ فلس زيادة عالكاسة، وبضل نعملها'. Keep rolling until a number arrives or drop the asset. Shoot 6-8 minutes, cut mid-sentence twice, keep 45 seconds, cover the jumps with tight inserts of their own hands working.",
    why: "Founder-style UGC tops the longest-running creatives in nearly every vertical, so it is table stakes; the falsifiable number is what makes it a concept. A number is checkable, and checkable claims read as true in a feed made of adjectives. Opening on a concession disarms the reflexive scepticism a viewer brings to any ad. Highest asset-value-to-cost ratio in the library: one hour of someone already on site, never needs recasting.",
    production: {
      cast: "Client-fronted — no models",
      crew: "videographer, editor",
      location: "client premises",
      kit: "a phone or small camera — a cinema rig destroys the format · hidden lav or nearby recorder · small LED bounced off the ceiling · nothing else, deliberately",
    },
    castingNotes: "The owner and only the owner; a cast model performing the owner is the exact thing this format exists to avoid. PRAVDA's job is direction, not casting: one story, one number, roll ten minutes, keep the fourth take. Talk them out of scripting. If the owner is genuinely unusable, promote the longest-serving staff member introduced as themselves — never a model introduced as staff.",
    localeNotes: "Their own dialect including Palestinian-Jordanian and Ammani variations; correcting toward MSA guts it, and let them code-switch. A founder naming their neighbourhood ('من ١٩ سنة بجبل عمّان') buys more credibility than any production value. For female owners in conservative-adjacent verticals offer a voice-and-hands variant. Never AI-clone this face or voice. If the client wants the 7am prep line, it is the first and only stop of the day — otherwise shoot the afternoon lull and accept a different room.",
  },
  {
    n: 3, name: "We Say No To This",
    tier: "light", verticals: ["body", "fitness", "property", "edu", "pro"],
    format: "Talking-head Reel 30-45s with two inserts. Sold only as a same-setup add-on to an Inbox Twelve day, where its marginal cost is thirty minutes. 1-2 per client.",
    economics: { costJOD: 35, originations: 1, billedJOD: 150, grossJOD: 115, marginPct: 77 },
    hook: "Straight to lens, unblinking, first words: 'ما بنشتغل مع كل حدا.' No music, no motion, no titles — stillness as the pattern interrupt.",
    premise: "Principal framed tighter than anything else the firm has — head and shoulders, slightly low angle, plain background, one key with negative fill. 0-4s: they name a service they actually sell — 'فيلر الخدود', the annual membership, a retainer tier — and immediately say who should not buy it. 4-25s: two or three specific disqualifications, each genuinely costly and each real: under this budget we are the wrong choice; in two weeks we cannot do it properly; if this is your case I will tell you no. Cut to two short inserts of the equipment or the work while they explain what they would do instead — those inserts are the safety net that rescues a fumbled take from a non-performer. 25-40s: back to camera for the turn — 'بس إذا…' — and one tight sentence naming exactly who they ARE right for. End frame: no discount, just 'إذا هاد أنت، احكيلي.'",
    why: "Costly signalling. Every competitor is selling; an account that visibly declines revenue reads as an expert rather than a shop, and expertise is what a paid consultation is sold on. It attacks the real bottleneck, which is not lead volume but hours burned on enquiries that were never closing. Naming who you are not for makes the qualified viewer self-identify, so the DM opens with 'I think I'm the one you described'. It is also the video that gets screenshotted into a family WhatsApp group.",
    production: {
      cast: "Client-fronted — no models",
      crew: "videographer, editor",
      location: "client premises",
      kit: "single key plus negative fill · 35mm or 50mm at a slightly low angle · lav mic · stool · plain wall",
    },
    castingNotes: "Cannot be cast — a hired actor declining business on a firm's behalf is theatre and reads as theatre. Owner, managing partner or senior practitioner only. Hardest performance in the library: calm, not arrogant. Budget 8-12 takes and real director time, and write the disqualifications in a pre-production call — only ones they will actually honour.",
    localeNotes: "Register is where this fails in Jordan. Direct refusal delivered wrong reads as arrogance in a business culture built on relationship, so frame it as protecting the client from a bad fit — 'بضيّع عليك وقتك' lands where 'we only work with serious clients' does not. Use 'إحنا', never corporate third person. Never name or imply a competitor as the home for the rejected segment; the Amman clinic and professional scene is small enough that it will be identified. Keep clinical disqualifications case-specific.",
  },
  {
    n: 4, name: "The Thread",
    tier: "light", verticals: ["food", "body", "property", "auto", "pro"],
    format: "Screen-recorded WhatsApp video 10-15s. 8-10 in one editor afternoon, no camera and no cast. Priced visibly below a shot video and normally bundled into the ads retainer.",
    economics: { costJOD: 35, originations: 8, billedJOD: 1200, grossJOD: 1165, marginPct: 97 },
    hook: "A WhatsApp thread already open and mid-scroll with the three dots pulsing — the most familiar visual in Jordanian daily life, appearing where an ad should be.",
    premise: "A real screen recording of a conversation staged live across two agency-owned phones on a desk, so typing indicators, keyboard lag and delivery ticks are real rather than animated. Recording opens mid-scroll on a thread with voice-note bubbles visible further up. The customer's message types out live: 'مرحبا، بدي أستفسر عن السعر'. Three dots. The business replies with the actual price and a photo of the actual product. The customer sends a location pin. The business replies with a time slot. Ends on the sent tick. Overlay lands on the last beat: 'هيك بتحجز. بتاخد دقيقة.' Portrait capture at native resolution, trim and overlay only. Variants: booking, price enquiry, delivery, availability, reschedule.",
    why: "WhatsApp is the actual conversion surface for most Jordanian SMEs, so this demonstrates the transaction rather than describing it. It removes the friction the funnel really dies on: people do not know how easy the booking is. Cheapest true cost in the library, which is exactly why it must never be priced like a shot video — it is retainer filler and an ads add-on, never one of three headline concepts in a Teardown.",
    production: {
      cast: "Client-fronted — no models",
      crew: "editor",
      location: "none",
      kit: "two phones on the same OS and language setting · the client's real price and real product photo · screen-recording app · fabricated contact names and numbers",
    },
    castingNotes: "No cast. Producer and editor stage the conversation on agency devices with plausible fictional contact names. Never screen-record a real customer's thread — that is a privacy breach regardless of consent, and one real number visible for a frame is a real problem.",
    localeNotes: "Both phones set to Arabic so the interface renders RTL — an English UI with Arabic messages reads as staged instantly. Generative models cannot render Arabic RTL interface text, so every variant is built by hand; there is no AI route here. Confirm WhatsApp brand-asset usage before running it as paid Meta creative, since the interface IS the creative. Plausible phrasing: 'مرحبا' rather than 'السلام عليكم' for a business enquiry, 'تمام' as confirmation, voice notes in the scrollback. Build one English-UI variant for the bilingual West Amman segment.",
  },
  {
    n: 5, name: "Send Us Your Contract",
    tier: "light", verticals: ["property", "edu", "pro"],
    format: "Overhead vertical 20-35s, hands only. Series of 10-12 from one three-hour desk session, built from audience-submitted documents. Booking gated on the signed document pack.",
    economics: { costJOD: 85, originations: 10, billedJOD: 1500, grossJOD: 1415, marginPct: 94 },
    hook: "A bare desk, then a hand slides a contract in and a red pen circles one clause hard before a word is spoken. Text: 'هاي الفقرة كلّفت واحد ٤٠٠٠ دينار.'",
    premise: "Camera locked directly overhead on a desk, one large softbox with a flag to kill pen glare. 0-2s: a hand slides a real Jordanian document into frame — a lease, an employment contract, a sales tax return, a supplier invoice — redacted with clean black bars. Burned text names it: 'عقد إيجار — الفقرة اللي بتكلّفك.' 2-25s: the hand works down the page with a red pen. Three circles, three beats; each time a circle closes, punch to a macro of that clause and state in one plain sentence what it costs the reader in money or risk. 25-32s: the document slides out and a blank sheet replaces it with one line — the thing to do before you sign. End card: 'ابعتلنا عقدك' on WhatsApp. Camera never moves between documents. The CTA is the engine: the audience supplies the next episode's documents, so every episode arrives as an inbound lead with a contract already on the desk.",
    why: "Professional services sell an invisible product, which is why their marketing defaults to stock handshakes. This makes expertise physically visible: you watch someone see something you would have missed. Hands-only removes both blockers — the principal who will not go on camera and the compliance risk of a named professional making claims. An approaching pen creates continuous anticipation, which is strong retention geometry. The submission CTA makes the series inexhaustible and structurally uncopyable by a competitor with no audience.",
    production: {
      cast: "1 model",
      crew: "videographer, editor, voice actor, producer",
      location: "studio or client premises",
      kit: "overhead rig or C-stand with horizontal arm · large softbox plus flag · macro or 50mm · two identical red pens · 10-12 real redacted documents, signed off in writing five days before the shoot · plain matte desk",
    },
    castingNotes: "One hand model: clean unremarkable hands, no loud watch, professional shirt cuff, steady enough to close a circle on take two rather than take nine. The client's principal can do the hands, but a hand model is faster and the VO stays the principal's voice, which keeps authority where it belongs.",
    localeNotes: "Documents must be Jordanian-real; an imported template is spotted by exactly the audience being targeted. There is no AI route — generative models cannot render legible Arabic legal text and the document is the entire asset. Redact obsessively; a visible client name for four frames is a professional-conduct incident. VO in dialect, clause wording left in the document's formal Arabic — that contrast is the point. Bar Association and syndicate advertising rules apply: educational and general only. Do not book crew until the signed document pack is in; this is the concept most likely to slip a shoot date.",
  },
  {
    n: 6, name: "Five Dinars Gets You",
    tier: "light", verticals: ["food", "retail", "body", "fitness"],
    format: "Reel 12-18s with an on-screen running counter. Endless series at different price points. Loop and counter template built once, then amortised across every client.",
    economics: { costJOD: 85, originations: 6, billedJOD: 900, grossJOD: 815, marginPct: 91 },
    hook: "A 5 JD note slapped on the counter and pushed toward the lens, and a counter starting to tick.",
    premise: "Locked-off on the counter, one overhead light. A hand places a real 5 JD note down and slides it toward the lens. Hard cut. Items land beside the note one at a time — a manaeesh, a coffee, a side, a dessert — while a corner counter ticks the running total: 2.00, 3.25, 4.50, 5.20. The overshoot is the mechanic: the counter crosses the number, a beat of silence, and a hand removes one item to bring it back under. Each item gets its own real sound: paper bag, cup on saucer, tray. Final frame: everything the 5 JD bought framed with the note still in shot, card reading 'خمس دنانير — ٤ أشياء' plus location and hours. Series versions with no new idea required: 10 JD, 20 JD, '٥ دنانير فطور', 'طاولة لستة — قديش بتكلف', and a gym, salon or car-wash version at the relevant number.",
    why: "The overshoot converts a montage into a question — the viewer stays to see what gets removed — and completion on a fifteen-second video is the strongest signal the algorithm rewards. The price on screen does what most Amman F&B pages refuse to do: West Amman customers assume expensive by default, and a visibly small total is itself the offer. The per-table variant answers what a night out for six actually costs, which is the question that stops the phone call. Repeats indefinitely, so one concept becomes a monthly retainer line item.",
    production: {
      cast: "1 model",
      crew: "videographer, editor",
      location: "client premises",
      kit: "real Jordanian dinar notes and coins · the actual menu or product items · clean counter · one overhead light · tray · counter graphic template",
    },
    castingNotes: "Hand model only, or the client's own counter staff. If a face appears at all, cast local and unglamorous — a value message dies the moment a fashion-model face delivers it. One hand model covers several clients in one booking day.",
    localeNotes: "Real JD notes on screen are the recognition trigger and a graphic is not — but confirm the Central Bank of Jordan position on reproducing banknote imagery in commercial video before this runs as paid media, and keep an approved prop or graphic fallback ready. Burn ٥ د.أ into the card, write 5 JD in the caption. Do not sell this to a premium venue: it reframes them as cheap and that is very hard to walk back. Client supplies and bears the food cost; schedule food last-in, first-shot; leftovers go to the client's staff.",
  },
  {
    n: 7, name: "Phone Kit Friday",
    tier: "light", verticals: ["food", "retail", "body", "auto", "pro"],
    format: "No crew day at all. PRAVDA ships a kit and directs over WhatsApp; the client shoots on their own phone. 6-10 assets per cycle, edit-only cost, the floor product below every shot concept.",
    economics: { costJOD: 35, originations: 6, billedJOD: 900, grossJOD: 865, marginPct: 96 },
    hook: "Whatever the client's own hands are doing, framed correctly for the first time in their life — the difference is legible in frame one because the tape does the directing.",
    premise: "PRAVDA couriers a physical kit to the shop: a phone clamp, a roll of floor tape, a small LED, a laminated framing card showing the exact frame, and a printed shot list of six things. Each shot is one line and one taped mark — 'ضع الكوب على العلامة، صوّر ٧ ثواني، ما تحرك التلفون'. The owner or a staff member shoots on Thursday, sends the raw clips to a dedicated WhatsApp number, and PRAVDA's editor returns finished vertical assets with burned bilingual captions inside 48 hours. The producer reviews the first two clips live on a WhatsApp video call and corrects framing before the rest are shot, which is the entire quality-control mechanism. The tape stays down, so every subsequent cycle matches the first and the library builds a consistent look with no crew ever attending.",
    why: "Nothing else in the library reaches a genuinely small budget, because every other concept carries a crew day. This is pure editor margin with zero travel, zero cast and zero location, and it converts the hardest objection an SME has ('we can't afford a shoot') into a subscription. It also solves premises PRAVDA cannot schedule around — restaurants that only close after midnight, salons open six days, workshops that will not stop. The taped marks make it the natural month-30 and month-60 refresh mechanism for every other concept in the library.",
    production: {
      cast: "Client-fronted — no models",
      crew: "editor, producer",
      location: "client premises, unattended",
      kit: "phone clamp and mini tripod · gaffer tape · one small LED · laminated framing card · printed shot list in Arabic · dedicated WhatsApp intake number",
    },
    castingNotes: "Nobody is cast. The client's own staff hold the phone and appear in frame as hands only unless the owner volunteers. Success depends on the producer's WhatsApp direction, not on the client's talent, so budget the review call as real billable time.",
    localeNotes: "Shot list written in Jordanian dialect, not MSA, and short enough to read on a phone screen. Anchor the shoot day to Thursday and the delivery to Sunday, which fits the Friday-Saturday weekend and lands assets for the week ahead. Captions returned in both AR and EN. Do not let the client shoot faces of customers — the kit instructions must say hands, product and room only, which also removes every consent problem.",
  },
  {
    n: 8, name: "The Menu Day",
    tier: "light", verticals: ["food", "retail", "body", "auto"],
    format: "Stills-led half day: 30-40 finished stills plus 8-10 six-second locked-off loops from one lighting setup. The photographer is the deliverable, not a secondary.",
    economics: { costJOD: 85, originations: 8, billedJOD: 1200, grossJOD: 1115, marginPct: 93 },
    hook: "An audible slam of the product hitting a hard surface in frame one, no logo, no face, no intro — and the still of the same item is already on the client's grid.",
    premise: "One surface — marble counter, dark wood, glass shelf — one key light plus white bounce, taped so nothing moves for three hours. The photographer works through the client's full menu or SKU list: each item lands on the mark, gets a straight-down still, a 45-degree still and a detail macro. Between stills the videographer rolls six seconds of the same item: hand enters fast from frame right, sets it down hard with a real thud, a six-frame whip push-in, one satisfying use beat — cheese pull, lid lift, ring turning under the light, key fob thunk — then both hands sweep it out to land on the identical empty surface that opened the shot, so the clip loops invisibly. Ten SKUs equal thirty-plus grid stills, ten loops, a delivery-app image set and a cut-together menu version. Nothing else changes between takes but the item.",
    why: "Every SME buys product photography every month and almost none of them buy video, so this is the cheapest door into the roster and the most natural upsell into a retainer. One lighting setup amortised across forty sellable assets is the arithmetic that makes a small per-asset price real. The loops rewatch, and rewatch is the signal short form pays for; the stills feed the grid, the delivery apps and the paid creative library at the same time.",
    production: {
      cast: "1 model",
      crew: "photographer, videographer, editor",
      location: "client premises",
      kit: "blank index cards and a thick marker · gaffer tape marking the exact item position · tripod with overhead or 45-degree arm · one LED plus white bounce · the client's 8-10 hero items, plated fresh",
    },
    castingNotes: "Hands only. Short clean nails, no watch or rings, neutral rolled sleeve, decisive movement — the hands must never become the subject. One hand model covers an entire batch and can cover multiple clients in one booking day. Match skin tone roughly to the client's own staff so it reads as their counter.",
    localeNotes: "Handwrite any price in Arabic-Indic numerals (٥) on the card and set Western numerals (5) in the overlay. Use د.أ, not JOD. No voiceover, so the batch is dialect-neutral and reusable for Gulf audiences. Seasonal re-versions (Ramadan, winter, Eid backgrounds) are a compositing job billed as post hours, not a prompt — clients will not accept AI food and the surface swap needs roto. Budget three to four plated repeats for any food item that has to be hot, and schedule food last-in, first-shot.",
  },
  {
    n: 9, name: "Status Thirty",
    tier: "light", verticals: ["food", "retail", "body", "auto", "pro"],
    format: "Vertical 20-30s built for WhatsApp Status and broadcast lists, not for the feed. 6-8 per cycle, cut from footage already shot on any other concept day.",
    economics: { costJOD: 35, originations: 6, billedJOD: 900, grossJOD: 865, marginPct: 96 },
    hook: "No hook, deliberately. A familiar face already talking to you as if you had asked — the pattern interrupt is that it does not behave like an ad.",
    premise: "Different physics from a Reel: no algorithm, an audience of saved contacts only, watched with sound on, and the viewer already knows who you are. So the piece opens with no hook and no branding — it starts as if mid-conversation. The owner or staff member holds the phone at arm's length in the actual room and says one thing that is only useful to someone who already has the number: what came in today, what is left, what time they close tonight, the two slots free tomorrow, the price change starting Sunday. One vertical shot, one take, sound on, no music, no captions. The last three seconds are a static card with nothing but the item and 'رد على هالستوري' — because a Status reply lands directly in the business's inbox as a thread, not as a comment. Posted daily by the client from a batch PRAVDA delivers weekly.",
    why: "Status is one of the largest distribution surfaces in Jordan and no agency deck in Amman contains a concept designed for it. Its physics reward the opposite of feed creative: intimacy over production, sound on, no need to earn attention because the viewer already opted in by saving the number. A Status reply arrives as a WhatsApp thread with a real phone number attached, which is the highest-intent contact an SME can receive and costs nothing in media spend. It also gives the retainer something to deliver daily without a new shoot.",
    production: {
      cast: "Client-fronted — no models",
      crew: "editor",
      location: "client premises, unattended or batched onto another shoot day",
      kit: "the client's own phone · whatever is genuinely in the shop that day",
    },
    castingNotes: "The owner or a named staff member, always the same person so the contact list learns the face. No performance required — the register is a voice note with a picture. Explicitly brief them not to greet the camera or say the business name; the audience already knows both.",
    localeNotes: "Sound-on and dialect-only; this is the one format where captions are optional and can feel over-produced. Never post Status content that reads as a broadcast blast — Jordanian users mute businesses that treat Status like a mailing list, so cap it at one post a day and make each one genuinely informational. Do not import contacts into broadcast lists without the customer having saved the business number first.",
  },
  {
    n: 10, name: "The Bad Review, Answered",
    tier: "light", verticals: ["food", "body", "fitness", "auto", "pro"],
    format: "Reel 25-40s, single take plus one insert. 2-3 per client, shot on any existing talking-head setup.",
    economics: { costJOD: 35, originations: 2, billedJOD: 300, grossJOD: 265, marginPct: 88 },
    hook: "A real one-star complaint about the business held silent and legible on screen for three seconds, published by the business itself.",
    premise: "Frame one is a screenshot of a real negative review or comment about the business, unedited, with the reviewer's name and photo blacked out but the complaint left fully legible — 'انتظرت ٤٠ دقيقة وما حدا سألني'. Held three full seconds in silence. Cut to the owner in the room where it happened, not against a wall: 'هاي كانت يوم الخميس. صح.' They do three things in order — accept it without qualification, explain what actually went wrong in one concrete sentence, then show the fix physically. Cut to the fix: the new second till, the extra staff member on the rota board, the timer now sitting on the pass, the reworked booking sheet. Back to camera for one line and no apology tour: 'اللي صار صار. هيك حليناها.' End card names the change and the date it started.",
    why: "Amman SMEs live and die in public comment sections and every one of them handles criticism the same way — silence, a defensive reply, or a quiet delete. Publishing the complaint yourself is a costly signal no competitor is willing to copy, and it converts the single asset a business is most afraid of into proof of operational seriousness. It also pre-empts the objection new customers arrive with, because the negative review they were going to find has already been answered on the business's own terms. Cheap to shoot and the highest share rate of anything in the library, because people forward it as a novelty.",
    production: {
      cast: "Client-fronted — no models",
      crew: "videographer, editor",
      location: "client premises",
      kit: "screenshot of the real review, name and photo redacted · lav mic · one LED · the physical evidence of the fix",
    },
    castingNotes: "The owner or the manager who actually owns the fix — a hired presenter apologising on a business's behalf is worse than saying nothing. Coach them hard against the two failure modes: arguing with the reviewer, and over-apologising. The register is flat and factual.",
    localeNotes: "Never name, tag or identify the reviewer, and never reply to them inside the video — in a city this size they will be recognised and the concept flips into a public dispute. Do not use a review that alleges a health, hygiene or medical harm; those get answered privately and never filmed. Dialect only, and avoid the formal apology register ('نعتذر عن أي إزعاج') which reads as a call-centre script. Get the client's written agreement on which review is used before the shoot, because this is the asset they will get cold feet about at approval.",
  },
  {
    n: 11, name: "Order Direct",
    tier: "light", verticals: ["food", "retail", "auto"],
    format: "Graphics-led vertical 20-30s over counter footage. Set of 3-4 per client, built largely in post from a template.",
    economics: { costJOD: 85, originations: 3, billedJOD: 450, grossJOD: 365, marginPct: 81 },
    hook: "Two phones side by side on a counter showing the same dish at two different prices, before anyone has said a word.",
    premise: "0-3s: a phone on the counter showing the client's own dish inside a delivery app, the app price supered large. 3-6s: a hand slides a second phone in beside it showing the same dish on WhatsApp at the direct price, and the two numbers sit side by side. 6-16s: the gap between them is drawn as a bar that fills, and one plain line of VO in dialect explains where the difference goes — the commission, not the kitchen. Cut to the kitchen: the same dish being made, hands only, four seconds. 16-25s: the offer lands as text — order direct, this is the number, this is the delivery time from this street — with the WhatsApp number held long enough to type. Last frame is the direct price alone. No mention of the aggregator by name anywhere on screen or in the audio.",
    why: "Aggregator commission is the live commercial fight every restaurant owner in West Amman is having right now, and nothing else in the category speaks to it. Showing the customer the gap recruits them into the owner's own interest, which is a far stronger ask than a discount code because it feels like a favour rather than a promotion. Every direct order recovers margin permanently and moves a customer onto WhatsApp, which the business owns, so the asset pays on every subsequent order rather than once.",
    production: {
      cast: "1 model",
      crew: "videographer, editor, voice actor, motion designer",
      location: "client premises",
      kit: "two phones · the client's real app listing and real direct price · the dish · one LED · comparison bar graphic template",
    },
    castingNotes: "Hands only, plus one VO. No face required, which keeps it cheap and keeps the tone matter-of-fact rather than aggrieved. Can be shot inside a Menu Day booking using the same hand model and the same counter lighting.",
    localeNotes: "Never name or show the aggregator's logo, brand colours or interface — blur or rebuild the listing frame, since the client usually still needs that channel and a visible attack invites removal from it. Keep the VO free of resentment; 'نفس الأكل، سعر أقل لما تطلب مننا مباشرة' converts, complaining does not. State the delivery radius honestly, because a direct order that arrives late costs more trust than the commission saved. Numbers in Western numerals, VO in dialect.",
  },
  {
    n: 12, name: "What 95K Buys",
    tier: "light", verticals: ["property"],
    format: "Vertical Reel 30-45s, price-first walkthrough. Two properties per crew day, three to four assets.",
    economics: { costJOD: 35, originations: 3, billedJOD: 450, grossJOD: 415, marginPct: 92 },
    hook: "The real, unflattering view out of the master bedroom window, held for three seconds, with the price stamped across it — the shot nobody else in the category will publish.",
    premise: "0-3s: agent stands dead-centre in the open front door and says the price flat in dialect while it slams on screen in huge numerals. 3-7s: gimbal pushes straight down the hallway into the salon in one unbroken move. 7-22s: four hard cuts, 2.5s each, no music swells — a hand tapping the kitchen stone, the bathroom, the numbered parking bay with a car in it, and the master bedroom window showing the ACTUAL view out of it: rooftops, water tanks, the neighbour's wall. That window shot is the hero, held longest, because it is the frame every other listing video refuses to shoot. Each cut carries one burned card: area in m2, floor, finishing level, monthly service charge. 22-30s: agent to camera in the salon, tone drops — 'الشي اللي مش حلو فيها…' — and names ONE genuine flaw: no generator backup, the second bedroom is small, it faces Mecca Street and it is loud. 30-35s: static end card, send 'مخطط' on WhatsApp for the floor plan.",
    why: "Standard listing videos withhold price to force a DM, which filters nobody and irritates everybody. Leading with the number means every viewer still watching at second four has accepted the budget, so DM count falls and DM quality rises — the agent's real constraint is wasted viewings. The honest window and the named flaw buy credibility for everything else and pre-empt the discovery that would otherwise happen at the viewing and end in a ghost. The keyword CTA gives a WhatsApp opener that is not 'interested?' and a countable trigger for the ads team.",
    production: {
      cast: "Client-fronted — no models",
      crew: "videographer, editor",
      location: "client premises",
      kit: "gimbal · one LED panel with bounce for bathroom and hallway · lav mic · tripod for the end card · floor plan PDF loaded into the WhatsApp auto-reply",
    },
    castingNotes: "The client's own agent, alone. The silent model buyer walking ahead of the lens has been cut — it is a stock device that adds a casting fee to a cheap asset and contributes nothing the gimbal move does not. A bilingual roster presenter can front it where the agent has no screen presence, but the concept loses its trust mechanic and should be priced as a fallback.",
    localeNotes: "Dialect — MSA on a walkthrough sounds like a government announcement. Burn Arabic captions right-aligned, prices in Western numerals, say '٩٥ ألف' rather than the full figure. Verify any transfer or registration fee with the client's lawyer before it goes on screen. Anchor the price against a felt reference: 'بخلدا هاي ٩٥، بعبدون نفس المتراج قصة تانية.' Shoot before 11am for window light. Get the flaw line agreed in writing at pre-production — it is the trust mechanic and it is exactly the line the client vetoes at approval. Booking condition: units vacant, tidy, powered and accessible, or a third of the day is lost.",
  },
  {
    n: 13, name: "Curtain Cut",
    tier: "light", verticals: ["retail"],
    format: "Reel 12-18s plus five stills and five story cutdowns from one 90-minute setup. Anchored as a fixed weekly Thursday restock ritual.",
    economics: { costJOD: 85, originations: 1, billedJOD: 150, grossJOD: 65, marginPct: 43 },
    hook: "A hand yanks the fitting-room curtain closed and it reopens on a completely different outfit, with the remaining sizes already on screen.",
    premise: "One corner of the shop, one fitting-room curtain, camera locked at chest height, two LED panels. The model steps out in look 1, turns, and the curtain sweeps hard across the lens — the sweep IS the transition — reopening on look 2 exactly on the beat. Five looks in what reads as one continuous take. Each look holds two seconds: a turn, a fabric flick, and a corner card carrying the piece name, the sizes ACTUALLY on the rail right now, and the price in JD. When a size has one unit left the card says so. Final frame strobes all five looks, then the store name and 'وصل اليوم — المقاسات بالفيديو'. The photographer shoots one static per look during the same setup, yielding the carousel and five stories. If the shop has no curtain, hang one.",
    why: "The transition is technique; live stock is the concept. Five priced looks with real-time size availability kills the single most common boutique DM — 'متوفر مقاسي؟' — which owners currently burn hours answering by hand, and converts the question into a store visit. Because stock changes weekly, the format becomes a standing appointment rather than a one-off, which is what a retainer needs. One 90-minute setup produces a Reel, a carousel and five stories: a full week of content from one booking, and the cheapest entry product PRAVDA can sell to retail.",
    production: {
      cast: "1 model",
      crew: "videographer, photographer, editor",
      location: "client premises",
      kit: "fitting-room curtain, hung if the shop lacks one · steamer · two LED panels · clean wall · shoes and bags to complete each look · full-length mirror off camera · the shop's own price tags and a printed stock count taken that morning",
    },
    castingNotes: "One model sized to the store's actual customer, not sample size — clothes that visibly fit read as buyable, and PRAVDA must confirm the roster genuinely carries the EU 42-48 range before promising this. Must change fast and hit marks; presence over range. For modest-wear clients cast a hijabi model who styles her own scarf. For the weekly series book the same model for the whole run — swapping her breaks the ritual.",
    localeNotes: "Modest styling is the default across most of Amman outside a handful of Abdoun and Sweifieh boutiques — shoot a modest alternate of every look at no extra cost and let the client choose. Put both EU and local sizing on the card, since Amman boutiques buy from Turkey, China and Europe onto one rail. Prices burned on screen, always. Anchor the series to Thursday and post between 8pm and 11pm: the weekend is Friday and Saturday, so Thursday evening is when people plan and shop.",
  },
  {
    n: 14, name: "Hook Farm",
    tier: "light", verticals: ["food", "retail", "body", "fitness", "edu"],
    format: "Creative-refill pack for the ads retainer, not a Teardown concept. 12 finished ads welded from one 90-minute block plus a full editor day. Never sold as twelve separate videos.",
    economics: { costJOD: 85, originations: 12, billedJOD: 1800, grossJOD: 1715, marginPct: 95 },
    hook: "The model is already mid-sentence when the frame lands, client's real space over their shoulder: 'لا تدفع فلسك بأي [كوفي/جيم/عيادة] بعمّان قبل ما تشوف هالشي.'",
    premise: "One model, one location, shot vertical at arm's-length eyeline so it reads as phone-shot. BLOCK A: twelve separate 2-second openers straight to lens, standing on the same mark, same wardrobe, same light, each a different first line, every take slated. BLOCK B: ONE 14-second body take where the model walks three steps through the client's space and performs the single demonstrative action — pours the coffee, racks the plate, pushes the treatment-room door, opens the car hood — while delivering the value line. BLOCK C: three CTA tails — 'اللينك بالبايو', 'ابعتلنا واتساب هلق', and a silent card. The editor welds each of the twelve hooks onto the same body and rotates the CTA. Four ads ship to Meta day one, four to TikTok, four held for the day-ten fatigue refresh.",
    why: "Hook rate gates every downstream metric — if the first two seconds fail, nothing else is seen. Fixing the body and varying only the opener isolates the highest-leverage variable instead of guessing which of five changed things worked. TikTok creative fatigues in seven to fourteen days against roughly ninety on Meta, so the account needs a refill queue rather than a hero asset. This is the machinery that justifies the monthly ads retainer, and it is sold as one testing pack because a client who lines twelve variants up side by side will correctly say it is one video.",
    production: {
      cast: "1 model",
      crew: "videographer, editor",
      location: "client premises",
      kit: "gimbal or phone rig · clip-on lav or shotgun off-frame · small LED for fill · slate or phone showing take numbers · the client's hero product for the body take",
    },
    castingNotes: "Mid-20s to mid-30s, genuinely fluent and natural in Jordanian dialect — the hardest cast on the roster, because twelve openers in a row exposes anyone reading rather than talking. Cast for conversational energy over face. Book the same model across two client premises in one day to amortise the fee; a third move is where the day dies in Amman traffic.",
    localeNotes: "Jordanian dialect only — MSA in a hook reads as a news bulletin and kills the UGC illusion. Burn Arabic captions in and write them in dialect, not as a formal translation of what was said; twelve welds plus RTL caption burn-in across two aspect ratios is a full editor day and must be priced as one. Keep one or two hooks in English for the bilingual West Amman segment and let the algorithm split-test. Do not synthesise this model.",
  },
  {
    n: 15, name: "No Face, Real Proof",
    tier: "standard", verticals: ["body", "fitness"],
    format: "Reel 15-25s, one continuous unbroken move, no face above the jawline. 3-4 assets per session, 15-25 takes budgeted for the reveal move.",
    economics: { costJOD: 85, originations: 3, billedJOD: 450, grossJOD: 365, marginPct: 81 },
    hook: "A single pin coming out and hair dropping in slow motion filling the whole frame — then a before-photo tilting down into the live after in one unbroken shot. No cut means no edit trickery, and viewers read that instantly.",
    premise: "Framing never rises above the chin. Shot 1 (2s): a hand pulls a clip and one length of hair drops loose, cropped at the nape — or a hand holds a phone into frame showing the client's own 'before' photo at the exact distance and angle matching the live shot behind it. Shots 2-5 (8s): practitioner's hands only, tight — sectioning, foils, the wand, the brush pass, the polish cup. Shot 6 (5s): the camera does not cut. The hand tilts the phone down and in the same continuous move the live 'after' is revealed in the identical frame. Hold two seconds. Shot 7 (3s): the client's own hand comes into frame and runs through the finished work. Audio is her real WhatsApp voice note, unpolished. Card: service, duration, price from, and 'بإذن العميلة — الوجه محفوظ'. The match only works if the before photo was shot to spec, so PRAVDA sends the salon a framing guide and floor tape weeks ahead and the befores are taken on the marks.",
    why: "A large share of the female clients these businesses most want will not consent to their face online, so the salon or clinic literally has no footage of its best work. Building the format around that constraint gets far more clients to say yes, which produces more proof — it is a consent-conversion tool disguised as a creative. It kills the 'is that even their client' doubt because the hands and the room are unmistakably theirs, and removes every privacy and comment-moderation exposure at once. This is the transformation concept nobody else in Amman can produce, and it should lead the library.",
    production: {
      cast: "1 model",
      crew: "female videographer, editor",
      location: "client premises",
      kit: "gimbal · small LED with diffuser · plain dark cape · phone and hand mirror · floor tape fixing lighting and camera distance so every asset matches · framing guide sent to the salon in pre-production · hand cream, clean towels",
    },
    castingNotes: "Two priced options, never one muddy line: real client (0 models, no fee, contingent on scheduled appointments) or cast (1 model, priced with fee). Cast purely on hair length, texture, skin and hands, since the face is never used. Hands are the co-star — nails and cuticles read hard on macro, check before rolling. Cast for calm control rather than expressiveness. Contract a minimum of four scheduled appointments inside the shoot window or bill a day rate; a quiet Tuesday otherwise turns a full crew day into one asset.",
    localeNotes: "The highest-value format for conservative and hijabi clientele in Amman and the safe default for women's-only gyms and salons. A female operator is a commercial precondition, not a courtesy — confirm PRAVDA has one before this is offered. Written per-asset consent in Arabic naming the specific platforms; a verbal yes is not enough and people change their minds. Never use 'علاج' or claim a medical outcome. Must never be AI-generated: a fabricated result is a regulatory exposure and the fastest way to destroy a clinic locally, where referrals move through family networks.",
  },
  {
    n: 16, name: "Out The Door Number",
    tier: "standard", verticals: ["property", "auto", "pro"],
    format: "Graphics-led vertical 25-40s over slow-push car footage. Set of 6-8, one per model on the lot. One-time template build charged as a setup fee, then cheap per car.",
    economics: { costJOD: 35, originations: 6, billedJOD: 900, grossJOD: 865, marginPct: 96 },
    hook: "The showroom sticker price fills the whole screen for three seconds, then a red line is drawn straight through it and the VO says, flat: 'هاد مش السعر.'",
    premise: "0-4s: the car three-quarter front, slow four-second push on a slider or gimbal, showroom price supered large. 4-6s: record-scratch beat, the price struck through with a red line. 6-24s: the real cost stack builds line by line, each typed on with a hard sound cue and held 2.5s, VO reading each — customs and special tax at the current band for that powertrain, clearance, ترخيص, plates, first-year insurance, the first service interval. Numbers are the dealer's real numbers, taken from their clearing agent and signed off in writing before the graphics build starts. 24-32s: everything collapses into one figure in a different colour, filling the frame, with the date it was calculated stamped beside it. End on the CTA — send the model name on WhatsApp, get the full breakdown as a PDF. No closing dialogue scene and no cast. One videographer shoots eight cars in a morning; the graphics are the real work and happen entirely in post.",
    why: "In Jordan the biggest friction in a car purchase is that the advertised price is not the price — customs, special tax, clearance, ترخيص and insurance add a punishing fraction, and every buyer knows it, which is why they call five dealers and trust none. Publishing the all-in number before being asked inverts the category's default at the moment of maximum suspicion. Crossing out a number is one of the few genuinely un-scrollable openings, because it promises a correction. Commercially it is a qualification machine: anyone who reaches the final figure and still messages has accepted the true budget.",
    production: {
      cast: "Client-fronted — no models",
      crew: "videographer, editor, voice actor, motion designer",
      location: "client premises",
      kit: "gimbal or slider · two LED panels · polariser for glass and paint · the dealer's actual cost sheet from their clearing agent, signed · dealer plate · one clean bay with lot clutter moved out of frame",
    },
    castingNotes: "No cast. The scripted closing exchange between a buyer and a salesman has been cut — it was written like a 1990s TV spot and undercut thirty seconds of hard-won credibility in two lines. The VO is a roster voice actor in dialect, or the dealer's own principal if they can read numbers cleanly.",
    localeNotes: "This is a motion-graphics build, not a shoot: eight animated cost stacks with per-line typing and sound cues is real labour, and two LED panels will not neutralise a showroom's fluorescent-green ceiling across a large space — fix it in the grade and budget the pass. Jordan's vehicle tax structure moved materially in 2025, with special tax bands cutting across petrol, hybrid and EV and age limits on EV imports; pull current figures the week of the shoot, put the date on screen, and treat re-cuts as billable with a stated validity window. VO in dialect, numbers in Western numerals, say 'ألف' rather than full figures.",
  },
  {
    n: 17, name: "Inside The Skin",
    tier: "standard", verticals: ["body", "fitness", "pro"],
    format: "AI-generated explainer 20-30s, practitioner voice-over with live-action bookends. Four to six built from one 30-minute VO session and one ten-minute bookend visit.",
    economics: { costJOD: 35, originations: 4, billedJOD: 600, grossJOD: 565, marginPct: 94 },
    hook: "An abstract macro interior nobody can identify, over the practitioner's own voice asking 'بتعرف شو بصير تحت الجلد لما...'",
    premise: "The practitioner records 25 seconds of voice-over in Jordanian dialect explaining what a treatment physically does — what filler actually sits on, why a scaler reaches what a brush cannot, what happens to a muscle fibre in the 48 hours after a session, why a follicle stops producing, what a whitening agent does to enamel. The visuals are AI-generated: a stylised interior in the clinic's brand colours — collagen strands under tension, a follicle in cross-section, plaque under a gumline, a fibre repairing — cut tight to the voice, one visual idea per sentence. Two live-action bookends filmed at the clinic: the practitioner at the top asking the question straight to camera, and at the end holding the actual instrument. Every generated biological visual goes back to the practitioner for written sign-off before it ships. Final card: clinic name, area, WhatsApp.",
    why: "Explaining the mechanism is what justifies the price, and every clinic in this bracket wants to do it but cannot afford medical animation, so they use ugly stock or say nothing. Generation makes a 25-second mechanism explainer economic at this budget for the first time. It is also the safest AI use in a medical context: nothing depicts a real person, patient or result, so there is no deception risk, while credibility comes from a real licensed face and voice on the bookends. This is the concept that makes the AI partnership genuinely valuable rather than a cost-saving substitute.",
    production: {
      cast: "Client-fronted — no models",
      crew: "editor, AI operator, videographer",
      location: "client premises for the bookends, none for the generated section",
      kit: "lav mic and a quiet room · brand colour references for the AI operator · the instrument for the closing shot · one LED panel for the bookends",
    },
    castingNotes: "Practitioner voice-over plus two bookend shots — their voice carries the piece, so record it clean in a quiet room with a lav. A roster voice actor is an upcharge, not baseline, and the trade-off is losing the credibility of a licensed voice. No AI-generated humans anywhere in the piece.",
    localeNotes: "The real cost is operator attempts, not compute — abstract medical interiors take many passes, so budget named operator hours and a revision cap or the 'no shoot day' saving evaporates. Generated anatomy is frequently wrong in ways a dentist or dermatologist spots instantly, and this audience will spot it: practitioner sign-off on every visual is a hard gate. Never generate a face or body that could read as a patient outcome and label nothing as a result. Never let AI render Arabic text into a frame; composite every overlay manually and check at 100 percent. Cut an English VO over identical visuals for Gulf and expat medical tourism at near-zero extra cost.",
  },
  {
    n: 18, name: "The Silent Inspection",
    tier: "standard", verticals: ["property", "auto"],
    format: "Observational near-ASMR vertical 45-75s, diegetic sound only. Four to five cars in one crew day, sold as a dealer inventory service where the inspection sheet is a deliverable.",
    economics: { costJOD: 35, originations: 4, billedJOD: 600, grossJOD: 565, marginPct: 94 },
    hook: "Black frame, then a torch beam sweeps across the underside of a car in a dark workshop and the only sound is a socket wrench.",
    premise: "A used car on a lift, one mechanic, the real pre-sale inspection. No presenter, no VO, no music. 0-5s: the blank checklist clipped to a board, camera tilts up as the mechanic walks in. Then the work: torch beam across the underbody, a thumb pressed into a tyre wall, the OBD reader plugged in with its number held long enough to read, brake pad thickness on a gauge, the paint depth meter on each panel with every reading supered, bonnet up, dipstick, door hinge checked for weld marks, the door closed twice — once so you hear it. Each check gets four to six seconds and one text card with the reading and a pass mark. The only edit rhythm is the work's own. 60-70s: the mechanic signs the sheet and clips it to the driver's window. Final frame: the completed sheet, car soft behind it. Card: 'كل سيارة عنا بتمرّ بهاد. اطلب التقرير على واتساب.'",
    why: "The used-car category in Jordan runs on the buyer's assumption that they are being lied to about the car's history, and no amount of assertion fixes it because every dealer asserts the same thing. Showing the inspection converts a claim into evidence, and the deliberate absence of music, VO and pace signals that nothing is being sold. Process content with tactile sound is among the highest completion-rate formats on short form, and completion buys reach. The dealer values the second life more: the sheet becomes what the salesperson sends on WhatsApp when a buyer hesitates, so one day produces top-of-funnel reach and a mid-funnel closing document per car.",
    production: {
      cast: "Client-fronted — no models",
      crew: "videographer, sound operator, editor",
      location: "client premises",
      kit: "two camera bodies — one gimbal, one locked for macro inserts · two LED panels plus a practical torch used in shot · external recorder and shotgun mic · paint depth gauge, brake pad gauge, OBD reader, tyre tread gauge · branded inspection sheet on a clipboard",
    },
    castingNotes: "The client's own mechanic, always — hands, overalls and competence, and competence cannot be cast. Real oil under the nails is the point. Brief them to work at normal speed and specifically not to perform; the single failure mode is a mechanic who starts presenting. No face required, so this works with staff who would never otherwise be filmed. If the workshop is genuinely unfilmable, decline rather than staging it in a borrowed garage — the credibility is location-bound.",
    localeNotes: "The sound IS the asset, so a dedicated sound operator is in the crew and not optional — one videographer cannot run a gimbal and a recorder at once. Agree with the dealer in advance what happens when the paint meter reveals a repainted panel, or you shoot a five-car day and deliver nothing. Text cards in dialect, plain numerals for readings, trade vocabulary as the trade says it — 'فحص', 'بويا', 'دوزان', 'كمبيوتر'. The paint depth meter is the most persuasive check for a Jordanian buyer because repainted panels signal accident history, so give it the most screen time. Post-2025 import rules banned fire- and flood-damaged vehicles: build one film around exactly those checks. Amman bays mix fluorescent and daylight — budget the second panel and a white balance pass.",
  },
  {
    n: 19, name: "Ten Minute Radius",
    tier: "standard", verticals: ["food", "body", "fitness", "property", "auto", "edu"],
    format: "Driver-POV vertical 20-60s with a live unbroken timer. Four to five routes per crew day, published as rush-hour and off-peak pairs. Owned by PRAVDA as a catchment library and licensed to multiple clients in the same area.",
    economics: { costJOD: 85, originations: 4, billedJOD: 600, grossJOD: 515, marginPct: 86 },
    hook: "A named Amman landmark on screen with a live timer punching to 00:00 and one line: 'من باب العمارة — عشر دقايق.' No face, no agent, no intro.",
    premise: "Camera clamped to the passenger headrest and a second on the passenger-side dash, looking forward through the windscreen; nothing in the driver's field of view. Text sets the origin — 'من الدوار السابع' — and a timer starts at 00:00 and never stops. The drive is real and never cuts: a recognisable landmark slides past, traffic, one turn, another. Cut-in text names each destination as it appears through the glass — the school, the supermarket, the pharmacy, the hospital, the on-ramp, the mosque, the gym — and the timer is frozen and stamped as each enters frame: 2:40, 4:15, 7:02. No music in the first half; engine, indicator tick and real street sound only. Final beat: the car pulls up, the timer freezes hard, and one cut to the single thing you came for held two seconds — the coffee landing, the squat rack, the chair reclining, the key in the door. End card stacks every destination and its time. The identical route is shot twice, at 8am and at 2pm, and both are published as a pair.",
    why: "Jordanians navigate by circles and landmarks, not addresses, and proximity beats quality as a purchase driver for cafes, gyms, clinics and property. Listing photos cannot answer 'how far is it really' and neither can a map, because everyone here knows a map lies about Amman traffic. A running timer that never cuts away is verifiable proof, and locals check it against their own mental map — that verification instinct is what holds them to the end. Publishing both the rush-hour and off-peak versions pre-empts the comment-section audit that a single claim invites. The drive is evergreen, so one shoot services every listing or catchment in that area and the same asset licenses to several businesses on the same street.",
    production: {
      cast: "1 model",
      crew: "videographer, crew driver, editor",
      location: "outdoor",
      kit: "headrest clamp and passenger-side dash mount — nothing in the driver's field of view · two camera bodies, shot as sequential passes with one operator · ND filter and polariser for glare · external recorder for street and engine sound · a clean unbranded mid-range car · timer graphic template",
    },
    castingNotes: "A crew driver drives — never a model. A performer operating a vehicle on Mecca Street during a continuous take is an insurance and liability problem with no cover. One model rides in the passenger seat for two brief cutaways and for the hands-on-wheel inserts, which are shot separately while the car is parked. Cast for calm; a jerky or aggressive drive reads as stressful and kills the easy-life message.",
    localeNotes: "Landmark choice is the strategy: a Khalda family video names the school, the supermarket and the mosque; a Sweifieh video names the gym, the specialty coffee and the Mecca Street on-ramp. Use the names people say — الدوار السابع، دوار الواحة، الصويفية، خلدا، تلاع العلي — never formal street names. Put the real hour on screen ('٨ الصبح، أيام الدوام'); a ten-minute claim shot at Friday noon will be publicly demolished in the comments. Each route is a 10-minute drive plus a 10-15 minute reset and a retake when traffic ruins a run, so four to five is the honest day. Do not point a camera at embassy perimeters, compounds or military sites.",
  },
  {
    n: 20, name: "The Free Minute",
    tier: "standard", verticals: ["body", "edu"],
    format: "Single-take instructional vertical 45-70s. Six to eight lessons from one classroom half-day.",
    economics: { costJOD: 35, originations: 6, billedJOD: 900, grossJOD: 865, marginPct: 96 },
    hook: "Instructor mid-sentence, marker already moving, no titles, value inside two seconds and no throat-clearing.",
    premise: "The client's actual instructor, in their actual classroom, lab or workshop, teaching one small complete thing. No introduction of the centre, no course name, no logo until the last frame. 0-3s: instructor already mid-motion at the whiteboard or the machine, stating the thing as a promise. The lesson must clear a specificity bar or it is not shot — 'أسرع طريقة تعرف فيها إذا الشيك بيرجع قبل ما تودّعه' is the bar; 'أهمية إدارة الوقت' is not. 3-50s: the lesson taught for real. A camera locked wide holding the instructor and the room; B camera tight on the hands, the screen, the weld, the code. Cuts follow the teaching beat. 50-60s: the instructor stops, does not pitch, and says the honest thing — this is one of eleven things in week one, here is the next. End card: course, next intake date, WhatsApp keyword.",
    why: "Every training centre in Amman advertises with the same three assets — a smiling classroom photo, a certificate handover, a list of course names — and none answers the only question a prospective student has, which is whether this person can teach. That is unanswerable in text and self-evident in forty seconds of them actually teaching. Giving away one complete useful thing triggers reciprocity and demonstrates the product at once; the sample IS the proof. It filters correctly, because someone who watches a full minute of instruction wants to learn the subject. People forward tax tips and technique clips in a way they never forward an enrolment ad.",
    production: {
      cast: "Client-fronted — no models",
      crew: "videographer, second videographer, editor",
      location: "client premises",
      kit: "two camera bodies — wide locked-off plus handheld tight · two LED panels plus a practical to lift flat ceiling light · two lav mics or a boom · markers that actually work · the real course materials, nothing dressed in",
    },
    castingNotes: "Cast students have been cut. Either film real consenting students in a genuine session with signed releases, or frame tight on the instructor and the work so the room is never read as empty — three hired students in a wide shot look like a failing class and cost a model fee each. The instructor is always the client's own; if the best teacher is camera-shy, film them teaching real students and never to lens.",
    localeNotes: "Teach in dialect with technical vocabulary in whatever language the trade actually uses — a coding instructor code-switches constantly and sanitising that makes the centre look less credible. For English or IELTS centres teach in English with Arabic captions, which doubles as proof of standard. Decide the gender composition of the room deliberately with the client; a women-only or mixed room is a positioning statement here. Verify accreditation and ministry rules before any claim about outcomes or certificate equivalence. Shoot outside class hours, or with written consent from every student in frame.",
  },
  {
    n: 21, name: "Sixty Days",
    tier: "standard", verticals: ["food", "retail", "body"],
    format: "Wedding-season series: one hero Reel 30-45s plus six 15s countdown cutdowns, shot across two suppliers in one day. Runs March-September, sold as a season package in January.",
    economics: { costJOD: 135, originations: 1, billedJOD: 150, grossJOD: 15, marginPct: 10 },
    hook: "'٦٠ يوم' stamped over a hand pinning a seam, and a bride's voice off camera asking whether there is still time.",
    premise: "A countdown number opens every asset — '٦٠ يوم', '٣٠ يوم', '٧ أيام' — burned over the bride's or groom's actual task for that week, and the whole series follows one real couple's preparation calendar across the supplier's chair. At 60 days: the first fitting, chalk on a seam, the tailor's hands pinning at the waist, the bride's face never above the chin if she prefers. At 30: the trial makeup or the skin plan, the practitioner's hands, a mirror held up. At 14: the hall walkthrough with the coordinator counting chairs out loud. At 7: the ring resized, tongs in the jeweller's hand, the stone under the loupe. At 2: the suit collected and shouldered out the door. Each cutdown carries one card — what this step is, how long before the date it must happen, and the price from. The hero cuts all six together against the falling counter and ends on the empty chair the morning after.",
    why: "Wedding season is one of the largest concentrated consumer spend windows in Jordan and the library had nothing for it, while the roster is built for it. The countdown is a timetable disguised as content: it tells a bride what she should be doing this week and which supplier does it, which converts an aspirational category into a booking calendar. It also sells the supplier's real constraint honestly — resizing takes ten days, a skin plan needs six weeks — which pulls bookings forward instead of losing them to a panic that arrives too late to serve.",
    production: {
      cast: "2 models",
      crew: "videographer, photographer, editor, producer",
      location: "client premises, two suppliers per crew day",
      kit: "the supplier's real fitting room, chair or bench · steamer and pins · macro lens for rings and fabric · two LED panels · countdown graphic template · hand mirror",
    },
    castingNotes: "A bride and groom pair, 24-34, cast to the supplier's actual clientele and comfortable being filmed in close-up for hours. The bride must be castable in both a face-visible and a face-free version, because the same footage sells to conservative and non-conservative audiences and many real brides will not appear. Hijabi and non-hijabi casting are both normal; pick per the supplier's market. Book the same pair across every supplier in the series or the calendar illusion collapses.",
    localeNotes: "Never show the dress in full before the wedding-day beat if the client's audience is traditional — the reveal taboo is real and a full-length dress reveal will cost the supplier customers. Shoot a face-free alternate of every bride setup at no extra cost. Dialect only, and keep the register warm rather than aspirational-English. Sell the season package in January: by March the good suppliers are booked and by May the couples are. Ramadan pauses the category almost completely, so plan around it rather than through it.",
  },
  {
    n: 22, name: "After Dark",
    tier: "standard", verticals: ["food", "retail", "fitness", "auto"],
    format: "Low-light vertical 20-35s shot on practicals only, 7pm-midnight. Winter and night-trade concept. Four to six assets per evening block.",
    economics: { costJOD: 35, originations: 4, billedJOD: 600, grossJOD: 565, marginPct: 94 },
    hook: "Warm light spilling out of an open door onto wet night pavement, with the room's real noise arriving before any image of the product.",
    premise: "No lighting kit is brought into the room, which is the rule that makes it work. The videographer shoots wide open on a fast prime using only what the venue already has — the pass lamp, the neon sign, the shisha coal glow, a phone screen, the headlights outside the window. 0-4s: the exterior at night, the sign on, the door opening and warm light spilling onto wet Amman pavement. 4-20s: four handheld beats inside at the hour the business is actually busy — steam off a cup under a hanging bulb, coal being carried across frame, a hand sliding a plate onto a full table, condensation on glass, someone laughing out of focus in the background. Nobody looks at camera. 20-30s: one static wide of the full room from the doorway, held long. End card is minimal: the hours the venue is open tonight and the WhatsApp number, nothing else. Ambient sound only — no music track, or one low bed under the last beat.",
    why: "Amman F&B, retail and shisha lounges do most of their trade after dark, and every other concept in the library assumes daylight or a controlled interior. It is also the winter fallback: December to February strips every outdoor and golden-hour format, and this one gets better in the cold and wet because the light is doing the work. Shooting on practicals alone is what makes it look like a place rather than a set — the viewer reads it as a night they could have, and the busy room is the social proof, gathered at zero cast cost from real customers.",
    production: {
      cast: "Client-fronted — no models",
      crew: "videographer, editor",
      location: "client premises",
      kit: "fast prime, f1.4 or f1.8 · camera body that holds up at high ISO · small handheld reflector or a phone torch for a single accent if truly needed · no lighting kit",
    },
    castingNotes: "Nobody is cast. The room's real customers are the content, shot deliberately out of focus, from behind, or below the shoulder so nobody is identifiable. If the venue is quiet, do not populate it with models — reschedule to a busier night, because a staged full room at night is exactly the kind of lie a regular will spot.",
    localeNotes: "Do not film identifiable customers, especially women, without consent — shoot backs, hands and bokeh, and have staff mention the filming at the door. Jordanian nights run late: the useful window for a busy room is 9pm-midnight, and for a cafe on a Thursday it is later still. Show shisha only where the venue serves it and wants it visible; the same rule applies to alcohol. Winter is the season this concept exists for, so schedule it November-February when the outdoor formats are unshootable and the wet pavement is an asset.",
  },
  {
    n: 23, name: "Six Weeks Only",
    tier: "standard", verticals: ["food", "body", "property", "auto", "edu"],
    format: "Reel 25-35s, single-location checklist film. Runs May-August, sold in March-April as a pre-booked seasonal slot. One outdoor half-day covers the arrival plate for every client that season.",
    economics: { costJOD: 85, originations: 2, billedJOD: 300, grossJOD: 215, marginPct: 72 },
    hook: "A Gulf licence plate and four suitcases hitting Amman pavement. The target audience identifies itself in frame one and everyone else scrolls past, which is the point.",
    premise: "One location, one arrival, no multi-city day. 0-5s: a real Gulf-plated car — sourced, not prop-plated, since West Amman is full of them in July — pulls into a residential street and the boot pops on four oversized suitcases, one taped shut. A hand drops the cases on the pavement and the frame holds on them. 5-10s: an adult who has just landed sits on a step and opens the notes app on a phone; the checklist types itself on screen in dialect — أسنان، صالون، الشقة، السيارة، عشا العيلة. 10-28s: each line strikes through over a two-to-three second beat shot at the client's own premises on a separate day and cut in — the chair reclining, the foils going in, keys turning in an empty apartment, the rental handover, a table being laid. 28-35s: back to the same step at night, the phone screen showing every line struck through, and the card: '٦ أسابيع بس — احجز من هلق'. Each client gets a cut where their beat expands and the others trim, so one arrival plate serves the whole season.",
    why: "The Gulf-expat summer return is Jordan's largest concentrated spend window — car rental, dentistry, aesthetic clinics, salons, real-estate viewings and restaurant covers all spike from June until the school year pulls families back in September. The audience is precisely reachable by geo-targeting Riyadh, Jeddah, Dubai, Abu Dhabi, Doha and Kuwait with Jordanian-interest signals weeks before they fly, which turns this into a bookings asset rather than an awareness one. The scarcity is real — they genuinely have six weeks — and that deadline converts to an appointment rather than a follow. The original multi-generation family shoot has been cut: it was a 2011 television commercial, and it was unschedulable.",
    production: {
      cast: "1 model",
      crew: "videographer, editor",
      location: "outdoor Amman street for the plate, then client premises beats batched two per day",
      kit: "four suitcases, one taped · a genuinely Gulf-plated car, sourced with the owner's permission · sunglasses · phone for the checklist screen · checklist graphic template",
    },
    castingNotes: "One adult, 30-45, reading as a Jordanian or Palestinian who works in the Gulf and has just landed — not a foreigner. Wardrobe is Gulf-casual: slightly more formal than Amman, good sunglasses, newer luggage. No children, no grandmother, no cast family; the suitcases and the plate carry the read. The client's own staff appear in their own premises beats.",
    localeNotes: "Do not caricature Gulf accents — these are overwhelmingly Jordanians and Palestinians working abroad, and playing them as foreigners insults the exact audience being sold to. Never display a fabricated licence plate on a car on a public road; source a real one or add it in post. Arabic-first copy throughout, dialect not MSA. Start the media plan in May — by the time the plane lands the appointment slots are gone. AI route: the street arrival plate and the night step can be generated for clients added late in the season, but every human beat stays real and no face is synthesised.",
  },
  {
    n: 24, name: "Mama's Verdict",
    tier: "premium", verticals: ["food", "retail", "body", "edu", "pro"],
    format: "PRAVDA-owned recurring review show, 'امتحان امي'. Reel 25-40s, near-single-take. Sold only as a dated monthly kitchen day with pre-paid slots, minimum four clients per day.",
    economics: { costJOD: 135, originations: 2, billedJOD: 300, grossJOD: 165, marginPct: 55 },
    hook: "The bag hitting the counter with a caption already on screen: 'وديت الأكل لإمي'. The tension of an unimpressed mother about to judge needs no setup.",
    premise: "Adult son walks into a real home kitchen carrying the client's takeaway bag or product. Mother is at the counter, back half-turned, does not look up. He sets it down: 'جربي هاي.' She wipes her hands on a towel — slowly. Opens the container. Smells it first. One small forkful. Chews. Camera holds on her face for a genuinely uncomfortable four to five seconds — no cut, no music, ambient kitchen sound only. Then the verdict, one line, flat: 'مش زي تبعي... بس حلو.' Son throws a small fist pump. She is already back at the dishes. Text: 'امتحان امي — نجحنا' with the business name and neighbourhood. It is framed as a recurring show she hosts, not an endorsement she gives, and each episode is titled and numbered so the format carries the repetition rather than her credibility carrying it.",
    why: "In Jordan the mother is the highest-trust authority on food, cleanliness and value, well above any paid influencer, because she has nothing to gain. The mechanism is submission to judgement rather than a claim of excellence, which sidesteps the credibility deficit every SME ad carries. The restrained verdict is the persuasion: 'not like mine, but good' is far more believable than praise. The long silent hold pushes watch-through past the algorithmic threshold. Running it as a show rather than an endorsement is what stops her authority collapsing after the twentieth business — a format survives repetition, an endorser does not.",
    production: {
      cast: "2 models",
      crew: "videographer, editor, producer",
      location: "a real home kitchen — a crew member's apartment or a rented Amman flat, dressed once and reused across the batch",
      kit: "the client's takeaway bag, containers or product · plate, fork, kitchen towel · tea glass · dish rack and everyday kitchen clutter that reads lived-in",
    },
    castingNotes: "Mother 50-65, cast entirely for stillness — she must hold a straight unimpressed face for five seconds and land one dry line in dialect, which is a specific skill most models do not have and which a 40-model roster almost certainly does not contain. She has to be found through theatre or a casting agent at a real fee, on an exclusivity and escalating-fee agreement, and a second mother must be cast so no single face carries every client. Cap her at a set number of businesses per category per season. Son 25-35, warm and slightly anxious.",
    localeNotes: "Her authority is the entire asset — never make her the butt of the joke and never let the son argue with the verdict. Vary the verdict per client so the series does not feel scripted: 'ماشي الحال', 'طيب والله', 'مقبول', and for a genuine win 'هاد بيجي عالبيت'. Dialect only, burned Arabic captions, since the hold works muted. Four or five clients per kitchen day is the ceiling — ten restaurants' takeaway arriving hot in sequence at one flat across Amman does not happen. Reskins cleanly for Ramadan and Eid.",
  },
  {
    n: 25, name: "The Booked Model",
    tier: "premium", verticals: ["body", "fitness"],
    format: "Productised asset day, not a single video: three Reels, one hero, 20-30 stills from one real appointment. Paid-media buy-out is a visible line item, and a maximum treatment length is stated in the package.",
    economics: { costJOD: 85, originations: 4, billedJOD: 600, grossJOD: 515, marginPct: 86 },
    hook: "Gloved hands entering frame on the model's face in the first half second, tight enough that you cannot yet tell what is about to happen.",
    premise: "The clinic or salon books a PRAVDA model in for a real, complete service — a hydrafacial, a colour, a whitening, a lash set, a full PT session — and the model signs a paid-media buy-out in advance. The day is shot as a service, not as an ad: arrival and consult at the desk, the practitioner's hands working, the model's face in the chair with the actual involuntary expressions of the treatment, the mirror moment, the walk out. Gloved hands enter frame in the first half second, framed tight enough that you cannot yet tell what is about to happen. The editor cuts three ways — a 15s reveal, a 40s process piece, a 20s consult-to-result piece — and the photographer pulls stills throughout. Everything is captioned as a filmed session with a booked model, never as a customer result.",
    why: "This solves the consent problem, the quality problem and the paid-creative problem in one day. Real patients will not sign for paid usage, will not sit for a second take, and often do not photograph well under clinic lighting. A cast model does all three. It also fixes the fact that a clinic's own gallery is inconsistently lit and framed — this footage is repeatable, which is what before-and-after content requires, and it gives a year of ad creative instead of a single organic post.",
    production: {
      cast: "1 model",
      crew: "videographer, photographer, editor, producer",
      location: "client premises",
      kit: "model release with explicit paid-media usage · medical consent form · LED panels — clinic fluorescents are almost always green-tinted · clean linen · the clinic's own product line staged · tripod plus floor tape so the reveal frames match",
    },
    castingNotes: "Cast to the clinic's real client, not an aspirational one — usually a woman 25-38 with skin or hair that has something to genuinely respond to; a flawless model destroys the footage because there is nothing to see. Non-negotiable paperwork: a paid-media usage buy-out AND a separate medical consent form, plus a patch test wherever the service requires one. Hard exclusion list: no injectables, no lasers, nothing with downtime, nothing leaving a visible result the model must carry to their next booking. Confirm a female practitioner where required, and confirm PRAVDA's liability position before the first booking, not after the first reaction.",
    localeNotes: "Hard rule, stated to the client in writing: a paid model's result may be shown as process and experience footage but must never be captioned or implied as a customer testimonial. Cast across the roster's range — Jordanian, Palestinian, Iraqi, Syrian and Gulf-reading looks all matter, since Amman clinics serve Gulf and Iraqi medical tourism and a Gulf-read cut of the same day is a second market-specific asset. For paid Meta delivery keep framing on process and experience; the negative-self-perception rule still pulls ads and transformation comparisons remain banned outright for weight-loss and anti-aging. Age-target 18+. Confirm the medical syndicate position before publishing, and keep every treatment room shot free of other patients and identifiable records.",
  },
  {
    n: 26, name: "Room Full At Six",
    tier: "premium", verticals: ["fitness"],
    format: "One-time launch package: hero 45-60s plus four cutdowns and a stills set, priced as a footage library covering a year of the gym's paid creative. Two gyms booked into the same talent day to halve cast cost.",
    economics: { costJOD: 435, originations: 1, billedJOD: 150, grossJOD: -285, marginPct: -190 },
    hook: "The wide shot of a visibly full room with the class's real sound running before a single frame of music.",
    premise: "Shoot a genuinely running class and supplement the room with roster models so it is full but not fabricated. Shot 1: wide from the back corner, the room filling as people walk in and set up. Shot 2: the coach at the front, one line of real instruction in dialect. Shots 3-8: a rotation of tight shots on different bodies and ages — hands on a barbell, a chest rising, a bare foot on a mat, chalk, a towel, someone genuinely struggling on the last rep. Shot 9: the group finishing, hands on knees, somebody laughing. Shot 10: wide again, the room emptying, the coach resetting the equipment alone. Overlay names the class, the time and the drop-in price and makes no attendance claim of any kind. Real class sound — the count, the plates, the breathing — runs before any music enters, and music enters late or not at all.",
    why: "A prospect's actual question is whether they will be alone in there and whether they will be the least fit person in the room. A full, visibly mixed room answers both in one frame. A new or quiet gym cannot generate this footage itself, and the empty-room photos it does have are actively costing it sign-ups. This is the clearest commercial use of a large roster in any vertical, and the footage carries the gym's whole first year including paid, where raw real-looking gym footage consistently cuts CPA against polished studio creative.",
    production: {
      cast: "8 models",
      crew: "videographer, photographer, editor, producer",
      location: "client premises",
      kit: "model releases and activity waivers · the gym's own kit · LED panels or practicals — gym lighting is the worst in any vertical · towels and water bottles · no visible competitor branding on clothing",
    },
    castingNotes: "Deliberately mixed — ages 20 to 55 and a genuine spread of body types; an all-athletic cast reads as an advertisement and repels the beginner who is the actual paying customer. This requires confirmed roster talent over 45, which is a recruitment prerequisite, not a detail. At least three or four must perform the movement correctly so the form does not embarrass the coach. Include modest athletic wear and at least one hijabi participant. Staggered call times, an activity waiver for every model, and a release each — models are exercising under load.",
    localeNotes: "Never state or imply an attendance figure on screen; a cast room presented as attendance is the scenario where a competitor humiliates the client and the agency. Cast to the actual neighbourhood — a Sweifieh studio and a Marj Al-Hamam gym want visibly different rooms. If the gym runs women-only hours, shoot a separate women-only block with a female videographer on a closed set: that footage is worth more than the mixed footage precisely because competitors cannot show it, and it decides a large segment of the Amman market. Coach's instruction in dialect, never MSA.",
  },
  {
    n: 27, name: "The Whole Visit",
    tier: "premium", verticals: ["body", "property", "auto", "edu", "pro"],
    format: "Continuous POV single-take vertical 60-90s, street to chair, no cuts. A full crew day of its own, sold as a premium bolt-on to an Inbox Twelve booking. One deliverable.",
    economics: { costJOD: 135, originations: 1, billedJOD: 150, grossJOD: 15, marginPct: 10 },
    hook: "A hand pushes the door open from the pavement and reception looks straight down the lens and says your name — 'أهلاً أستاذ، تفضل، الدكتورة جاهزة.' You are inside the building in second two.",
    premise: "One take, no cuts, camera at eye height on a gimbal in the position of the person arriving — you see hands enter frame, you never see their face. 0s: the exterior door from the pavement, the sign, the hand pushing it open, street ambience cutting hard to interior quiet. Reception looks up and greets you by name, because the appointment was booked and that is the point. Water offered. Walk past a waiting area with two people in it, comfortable, not staged-perfect. Someone collects you within seconds. Down the corridor, camera glancing into a treatment room or past a certificate wall at reading speed. Into the room. For a clinic, the practitioner tears open a sealed sterilisation pouch on camera and lays the instruments down. The camera lowers into the chair position, looking up at the light. The take ends the instant before a handshake, on their face and their first word. Burned text, one sparse line every fifteen seconds: 'الاستشارة الأولى — ٢٠ دقيقة', 'من غير التزام', 'كل أداة بتنفتح قدامك'.",
    why: "In every high-consideration service the barrier before the first appointment is not price, it is the unknown shape of the encounter — how long, who I meet, whether I will be pressured, what happens in the room. The buyer cannot articulate it and no brochure addresses it, so they simply do not book. An unbroken POV removes the ambiguity and does what a cut sequence cannot: with no edit, the viewer knows nothing was hidden between shots, so the pleasantness becomes evidence rather than advertising. Tearing the sterilisation pouch answers the hygiene question nobody says out loud. The viewer who reaches the end has rehearsed the visit, and the booking becomes a much smaller decision.",
    production: {
      cast: "2 models",
      crew: "videographer, second videographer, editor, producer",
      location: "client premises",
      kit: "gimbal with a wide lens · second op walking backwards ahead of the shot, blocked the day before so they never land in frame or a mirror · three or four small LED panels pre-hidden along the route to even out the street-to-interior exposure ramp · wireless lavs on reception and on the professional · a genuinely sealed sterilisation pouch · an hour budgeted to tidy reception before the camera comes out",
    },
    castingNotes: "The POV performer is a crew member — only hands, a shoulder and occasional reflections are seen, so the money is better spent elsewhere; whoever it is must move at a calm human speed, because a gimbal operator's natural walk reads as anxious. Two models populate the waiting area: an empty room reads as failing and an over-full one reads as a long wait, so two relaxed people, one on a phone, one reading, dressed West Amman ordinary. Reception and the professional are the client's own staff and need four or five rehearsal passes; the greeting is the hardest beat and is almost always why a take fails. Budget 20-40 takes and a full day.",
    localeNotes: "Greeting register is the highest-value detail and must be Jordanian: 'أهلاً وسهلاً، تفضل' with real warmth, never a scripted corporate line, and the honorific matters — 'أستاذ' / 'دكتور' / 'سيدتي' by segment. Shoot on a closed day or before opening; you cannot run twenty takes through a live clinic, and patient privacy is both an ethics issue and direct syndicate exposure. Decide gender composition with the client rather than discovering it on the day: for a women's clinic or salon the POV performer, reception and waiting room should all be women. Walk the route with the client the day before to pre-light and pre-block.",
  },
  {
    n: 28, name: "Five Doors On This Street",
    tier: "premium", verticals: ["food", "retail", "body", "fitness", "pro"],
    format: "Neighbourhood co-op piece: one Reel 25-45s naming five real businesses on one street, sold jointly to all five. Two golden-hour evenings, roughly 45-60 minutes of usable matched light each.",
    economics: { costJOD: 85, originations: 1, billedJOD: 150, grossJOD: 65, marginPct: 43 },
    hook: "Talent already walking, already mid-sentence, naming a street a local will recognise inside two seconds.",
    premise: "The client's business is one of five, which is the point. Talent walks one specific stretch — Rainbow Street below the circle, Wakalat, Weibdeh's back lanes, the Sweifieh strip — and names five real things on it in dialect, ranked identically in tone: where to park, the good coffee, the shop everyone gets wrong, the hour to avoid, and the fifth stop. Each is six to eight seconds, walking, gimbal, and the camera actually points at the thing being named. No music swell on any one business, no upgrade in tone for the paying ones — every co-op partner is introduced exactly like the others, and each partner receives a cut where their door is the last one entered. Last shot: talent steps inside and the door closes. The photographer shoots stills at the same marks between takes.",
    why: "Hyperlocal pieces convert for local service businesses because the geo-signal makes the algorithm serve them to people physically nearby, and because they get saved and sent rather than merely watched. The client earns credibility by association: appearing as one of five recommendations, ranked like the others, is far more convincing than appearing as the only one. Selling it as a co-op to all five businesses on the street is what makes the economics work — the day is expensive and a single buyer cannot carry it, but five neighbours splitting one shoot each get a bespoke cut and each promote it to their own audience, which is distribution no ad budget buys.",
    production: {
      cast: "1 model",
      crew: "videographer, photographer, editor, producer",
      location: "outdoor",
      kit: "gimbal · wireless lav plus wind muff — Amman streets are windy on the hills · reflector · no lighting kit; shoot the hour before sunset · second camera for reverse angles · printed filming permission and the clients' commercial registrations",
    },
    castingNotes: "One walker who genuinely knows the street and can talk about it without notes — a model reading a list of place names is transparently fake to anyone who lives there, and local credibility is the whole value. Age 25-35, dressed like a resident of that specific neighbourhood, which differs meaningfully between Weibdeh and Abdoun. Must walk naturally in public on camera, which is the actual skill; most people over-perform it badly. The fashion runway cut has been removed from this concept — it was a generic street shoot every clothing brand does and it doubled the day.",
    localeNotes: "Budget lead time for Greater Amman Municipality or Royal Film Commission permission and carry it printed — a two-person crew with a gimbal on Rainbow Street or Wakalat is a professional shoot on public commercial property, and assuming otherwise is how a day gets shut down. Get verbal permission before pointing the camera into another business's doorway; a neighbouring owner who feels ambushed is a lasting local problem. Golden hour is roughly 19:15 in July and 16:45 in January, so schedule by month, split across two evenings, and never shoot Friday midday when the frame reads dead. Avoid filming identifiable people, especially women and children, without consent.",
  },
  {
    n: 29, name: "The Last 60 Seconds",
    tier: "premium", verticals: ["food", "retail", "body", "auto", "pro"],
    format: "Reel 15-25s with a real-time countdown. Ramadan seasonal, sold only inside a priced Ramadan campaign bundle alongside the ads retainer. Finished three to four weeks before the month starts.",
    economics: { costJOD: 285, originations: 1, billedJOD: 150, grossJOD: -135, marginPct: -90 },
    hook: "A countdown number burned over an empty plate at an untouched iftar table. Time pressure is the most literal hook available and needs zero explanation during Ramadan.",
    premise: "Locked-off wide of a fully set iftar table — dates in a dish, water poured, everyone seated with hands in their laps, nobody touching anything. On-screen countdown reads 00:58 and runs for real. Cut to the client's kitchen: hands plating fast, lid on, bag sealed, sticker slapped. Cut to a rider's helmet going on, engine turning. 00:31. Cut to a doorbell and a hand taking the bag at the door. 00:12. The last dish lands on the table, a chair scrapes, everyone settles. 00:03, 00:02, 00:01. Cut to black for one full beat of total silence. Then: one hand lifts one date, one bite, eyes close. Freeze. Text: 'وصل قبل الأذان — توصيل عمّان الغربية.' Non-food variants keep the identical structure for anything sold on a deadline — the salon appointment before the family visit, the tailor before Eid.",
    why: "Ramadan iftar delivery is a promise about time, not about food — nobody worries whether the food is good, they worry whether it lands before maghrib. This is the only structure that dramatises the real anxiety instead of showing pretty plates. The silence-then-date beat is a genuinely regional edit rhythm with no Western equivalent, so it cannot read as a translated format. It doubles as a media instruction: consumption spikes after iftar and again toward suhoor, video consumption rises across the month and CPMs climb, so the asset has to exist before anyone else is bidding.",
    production: {
      cast: "5 models",
      crew: "videographer, photographer, editor, producer, motion designer",
      location: "home or apartment set, plus client kitchen and a doorway",
      kit: "full iftar table — dates, soup, jallab or qamar al-din, shared mains · the client's branded delivery bag and sticker · helmet and scooter · wall clock · countdown graphic template",
    },
    castingNotes: "A family unit across three generations that reads as a real Amman household — grandmother, parents, two children. This requires confirmed roster talent aged 50-70 and child talent with guardians, both of which are recruitment prerequisites. Modest Ramadan dress, understated, no styling gloss. Absolute directive on set: nobody eats, drinks or brings anything to their mouth on camera until the final beat, including between takes. Rider is one person, mostly helmet and hands, and can be a crew member. Child blocks capped at four hours with breaks and a guardian present throughout.",
    localeNotes: "Never lay the adhan itself under a commercial post — use silence, room tone or a soft chime. Never show food being eaten before the maghrib beat in a Ramadan-timed post; getting this wrong is a brand-safety failure, not a matter of taste. Qatayef, not only kunafa, is the Levantine Ramadan sweet, and the fanoos lantern is more Egyptian than Jordanian. Budget 30-40 percent more paid spend for the month. Five cast including two children across three locations plus a graphics build is a premium day and must be priced as one; do not schedule the doorway and the home set on the same day as the client kitchen unless all three are in one district.",
  },
  {
    n: 30, name: "The Receipt at Six Months",
    tier: "premium", verticals: ["body", "fitness", "property", "edu", "pro"],
    format: "Documentary vertical 60-90s, two locations, plus three static pull-quote crops. One asset per subject, released fortnightly. Never sold with a fixed shoot date until the subject and the workplace are confirmed in writing.",
    economics: { costJOD: 35, originations: 1, billedJOD: 150, grossJOD: 115, marginPct: 77 },
    hook: "Cold open, mid-sentence, on the number: 'قبل سنة كنت أخذ ٣٠٠. هلأ ٧٥٠.' The face is already talking when the frame appears. No name card, no logo, no music.",
    premise: "Two setups cut against each other. Setup A: the graduate or customer in the room where it started — the classroom, the gym floor, the clinic waiting area — talking about where they were before. Setup B: the same person six months on, at their actual workplace or living the result. Cut B into A, not A then B: open on the payoff, then drop back. The spine is one specific number they volunteer, and the edit never lets go of it — a salary, a client count, a job title, a weight, a time-to-hire. 0-5s: the payoff location, the number, unprompted. 5-35s: the before, in their own words, questions asked off camera and cut out entirely so the answers play as statements. Text pins the number the moment it is spoken. 35-70s: b-roll of them doing the actual thing, under their voice. 70-85s: one sentence straight to lens to the person still hesitating. No music under the interview; music enters only under the b-roll. The intake variant solves the cold-start problem: for a client with no eligible subject yet, PRAVDA films the 'before' interview today at the point of enrolment, banks it, and returns in six months — which converts a one-off into a retainer relationship.",
    why: "Testimonials are the most persuasive element in a high-ticket sale and the effect scales with price, but almost all of them are worthless because they are shot in the lobby on the day, by someone who has not yet experienced the outcome. Filming six months out means the person is describing a result rather than a feeling, and a result has a number attached. Specific falsifiable numbers outperform superlatives. Opening on the claim rather than the introduction reclaims the four seconds every testimonial wastes. This is the asset that belongs beside the price and beside the enrol button.",
    production: {
      cast: "Client-fronted — no models",
      crew: "videographer, editor, photographer, producer",
      location: "client premises plus the subject's real workplace or home",
      kit: "single key plus reflector, travel kit · 85mm prime · two lav mics · tripod · small gimbal for b-roll · signed appearance release from the subject and written permission from their employer",
    },
    castingNotes: "This casts nobody, and that is a hard rule: if the client cannot produce a genuine graduate or customer, the concept is dropped, not recast — a roster model reading a scripted result is a fabricated testimonial, an ad-policy violation and a reputational liability. The honest substitute is a first-visit variant, labelled as a first-time trial. PRAVDA's value here is interview craft: budget a producer who can run a genuine forty-minute conversation off camera and pull the number and the honest sentence out of a nervous person. Brief them not to prepare and never hand them a script.",
    localeNotes: "Interview entirely in dialect and do not clean up the grammar in the subtitles — the roughness is the proof, and a customer switching to formal Arabic instantly sounds coached. Salary disclosure is culturally sensitive in Jordan; nobody is pushed, so prepare a substitute number in the brief — offers received, clients signed, months to hire, kilos, sizes — so the edit always has a spine. Many Jordanian women in clinic and fitness categories will not appear on camera: offer a voice-only cut over venue b-roll with the quote on screen, which still carries the number. Include at least one subject who says it was hard; the honest one gets screenshotted and forwarded.",
  },
];

// ── selection ───────────────────────────────────────────────────────────────

export const byId = (n: number) => CONCEPTS.find((c) => c.n === n) ?? null;

export const forVertical = (v: Vertical) =>
  CONCEPTS.filter((c) => c.verticals.includes(v));

/**
 * A shortlist for a business.
 *
 * Ordered light-first, because the cheapest piece that answers the diagnosis is
 * the one most likely to be said yes to — and a first yes is worth more than a
 * bigger first invoice. Ties break on originations: more finished pieces from
 * one crew day is more to run as ads afterwards.
 */
const TIER_ORDER: Record<Tier, number> = { light: 0, standard: 1, premium: 2 };

export function shortlist(v: Vertical | null, limit = 6): ConceptSource[] {
  const pool = v ? forVertical(v) : CONCEPTS;
  return [...pool]
    .sort((a, b) =>
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier]
      || b.economics.originations - a.economics.originations)
    .slice(0, limit);
}

/**
 * The published rate card, applied. 35 JOD buys a videographer who also edits;
 * each model is 50 for the shooting day. PRAVDA sets these — talent never
 * proposes them — so the arithmetic belongs in code rather than in a habit.
 */
export const crewDayCost = (models: number) => 35 + 50 * Math.max(0, models);

/**
 * What a client pays per finished video, flat.
 *
 * Not a new rule — every one of the thirty concepts already bills at exactly
 * originations × 150, so this is the rule the library was written against, now
 * said out loud. It includes the shoot, the edit, the cast and the marketing;
 * a client never sees a crew day or a rate card.
 */
export const VIDEO_JOD_PER = 150;

// ── adaptation ──────────────────────────────────────────────────────────────

type B = { ar: string; en: string };

/** The marker the console and `needsWriting` both look for. */
const unwritten = (what: string): B => ({
  ar: `⟦يحتاج كتابة: ${what}⟧`,
  en: `⟦Needs writing: ${what}⟧`,
});

/**
 * Seed a report concept from a library entry.
 *
 * English arrives filled from the library; Arabic arrives marked unwritten, on
 * purpose. A teardown is read in Arabic by most of the people it is sent to,
 * and a stock translation of a concept written for a different business reads
 * exactly like what it is. Marking it unwritten means the report cannot be
 * released until someone has written it for this one — `needsWriting` blocks
 * the promotion and the console disables the button.
 */
export function toReportConcept(src: ConceptSource) {
  return {
    name: { ar: '', en: src.name },
    line: { ar: '', en: src.hook },
    idea: { ar: '', en: src.premise },
    cast: [] as { name: B; role: B }[],
    // The library's modelled figure, as a starting number to argue with.
    price: src.economics.billedJOD,
    assets: { ar: '', en: src.format },
    note: unwritten(`الفكرة بالعربي — ${src.name}`),
  };
}
