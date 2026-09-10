import { CONCEPTS, VIDEO_JOD_PER, type ConceptSource, type Shape, type Vertical } from '@/lib/data/concepts';
import type { Findings } from '@/lib/teardown/findings';
import type { Talent } from '@/lib/data/deals';
import { arPieces, enPieces } from '@/lib/format/num';

/**
 * Five ideas for this business, chosen from the library and never invented.
 *
 * The selection has to be defensible line by line, because Khaled reads it and
 * then defends it on a call. So a concept is ranked by what it answers: each
 * critical finding maps to a trait a concept either has or does not, and the
 * reason a concept appears is assembled from the findings it answers rather
 * than written afterwards to fit.
 *
 * Three things this file is careful about, each of which it got wrong before:
 *
 * 1. It names real people or it names nobody. A placeholder is an invented
 *    person; putting one on a sheet is a promise the studio cannot keep, and
 *    `convert.ts` will happily book them. So `bookable` drops them, and a
 *    concept the roster cannot fill is marked `uncastable` rather than quietly
 *    cast short.
 * 2. It reads the crew the library actually asked for. Taking a videographer
 *    unconditionally cast one onto a screen-recording with no camera, and
 *    silently dropped the photographer, producer and sound operator a day
 *    genuinely needs.
 * 3. Five ideas have to be five ideas. Ranking alone returned five
 *    client-fronted talking heads carrying two distinct sentences between
 *    them, which gives the reader nothing to choose between — so shape and
 *    reason are constrained after scoring, not hoped for.
 */

type B = { ar: string; en: string };

export type CastPick = {
  talentId: string;
  name: B;
  discipline: string;
  why: B;
};

export type Recommendation = {
  conceptN: number;
  name: string;
  tier: ConceptSource['tier'];
  /** How it is shot. Carried through so the sheet can show the mix. */
  shape: Shape;
  /** Finished pieces this produces. The unit the client is sold. */
  videos: number;
  /** videos × 150. The only pricing the client ever sees. */
  priceJOD: number;
  hook: string;
  premise: string;
  format: string;
  /** Why this one, for this business — assembled from findings it answers. */
  because: B;
  /** Which findings it answers, so the sheet can show the link. */
  answers: string[];
  models: number;
  needsVoice: boolean;
  cast: CastPick[];
  /**
   * Crew the day needs that the roster does not book — editor, producer,
   * photographer and the rest. Said plainly rather than pretended away: the
   * cast block understated every shoot while these were dropped on the floor.
   */
  crewNotes: string[];
  /** Nobody on the roster fits. Shown, but cannot be sent. */
  uncastable?: string;
};

export type RecommendOptions = {
  /**
   * How sure we are of the vertical. A guess inferred from a bio nudges the
   * ranking; it does not decide it, which is what an unscaled +18 did.
   */
  verticalConfidence?: number;
};

/**
 * How many people this needs in front of the camera.
 *
 * `null` means the library said something this function does not understand,
 * which is not the same as one model. Defaulting to 1 quietly cast a single
 * person onto a day that wanted eight; unknown is now uncastable and says so.
 */
export const modelsNeeded = (c: ConceptSource): number | null => {
  const cast = c.production.cast;
  if (/no models|client-fronted/i.test(cast)) return 0;
  const m = cast.match(/(\d+)\s*models?/i);
  return m ? Number(m[1]) : null;
};

/** The two crew roles the roster actually books, and what the library calls them. */
const CREW_CAST: Record<string, 'videographer' | 'voiceover'> = {
  'videographer': 'videographer',
  'second videographer': 'videographer',
  'female videographer': 'videographer',
  'voice actor': 'voiceover',
};

/**
 * What a shoot day needs, read off the library rather than assumed.
 *
 * Everything that is not a videographer or a voice is noted, not cast: PRAVDA
 * books three disciplines, and an editor or a producer on a call sheet is a
 * fact about the day rather than a person to be offered one.
 */
export type CrewNeed = {
  videographers: number;
  voices: number;
  /** In the library's own words, so the sheet can quote it. */
  notes: string[];
};

export const crewOf = (c: ConceptSource): CrewNeed => {
  const need: CrewNeed = { videographers: 0, voices: 0, notes: [] };
  for (const raw of c.production.crew.split(',')) {
    const role = raw.trim();
    if (!role) continue;
    const cast = CREW_CAST[role.toLowerCase()];
    if (cast === 'videographer') need.videographers++;
    else if (cast === 'voiceover') need.voices++;
    else need.notes.push(role);
  }
  return need;
};

/**
 * What a concept does, inferred once from its own text.
 *
 * Heuristic, and deliberately narrow: each trait is checked against the words
 * the library actually uses for that idea, not against a general notion of it.
 * A trait true of 80% of the library is not a trait, it is a constant, and the
 * weight attached to it stops choosing anything — so `_traits-measure.mts`
 * holds every one of these to between 15% and 60% of the thirty.
 */
export const traits = (c: ConceptSource) => {
  const all = `${c.name} ${c.hook} ${c.premise} ${c.format}`.toLowerCase();
  // Price talk is matched on what the piece DOES, never on what it is called:
  // "The Forty Fils Number" and "Out The Door Number" put the word in a title
  // and told the engine the piece states a price when it may not.
  const does = `${c.premise} ${c.format}`.toLowerCase();
  const models = modelsNeeded(c) ?? 0;
  return {
    // Narrow on purpose. The first version matched "ask", "camera" and "order"
    // and so was true of nearly every concept — which produced five
    // recommendations carrying five identical reasons, and a sheet that gave
    // Khaled nothing to choose between.
    answersQuestions: /\b(question|objection|faq|inbox|asked)\b/.test(all),
    statesPrice: /\b(price|priced|pricing|how much|fils)\b/.test(does),
    drivesToMessage: /\b(whatsapp|dm|direct message)\b/.test(all),
    // A face means a face. A model in frame or a piece shot to camera — but a
    // concept built on never showing one is not a face-forward idea however
    // many people it books, and "owner|staff|principal" appears in almost
    // every premise in the library, which is what made this 80% true.
    showsAFace: (models > 0 || /talking.head|to camera|straight to lens/.test(all))
      && !/no face|hands only|never rises above the chin|never above the chin/.test(all),
    isShortVideo: /\breel/.test(c.format.toLowerCase()),
  };
};

const TIER_ORDER = { light: 0, standard: 1, premium: 2 } as const;

/** At most two of a shape, and at most two answering exactly the same findings. */
const PER_SHAPE = 2;
const PER_ANSWER_SET = 2;

type Scored = {
  c: ConceptSource;
  score: number;
  answers: string[];
  models: number | null;
  crew: CrewNeed;
  uncastable?: string;
};

export function recommend(
  fx: Findings,
  roster: Talent[],
  vertical: Vertical | null,
  want = 5,
  opts?: RecommendOptions,
): Recommendation[] {
  const ids = new Set(fx.findings.map((f) => f.id));
  const bookable = roster.filter((t) =>
    t.active && t.dayRateJOD > 0 && !t.placeholder);
  const have = (d: string) => bookable.filter((t) => t.discipline === d);
  const videographersOnRoster = have('videographer').length;
  const modelsOnRoster = have('model').length;
  const voicesOnRoster = have('voiceover').length;
  const verticalWeight = Math.round(18 * (opts?.verticalConfidence ?? 1));

  const scored: Scored[] = CONCEPTS
    // The library forbids some of its own entries as headline picks. Keep them
    // out of the pool entirely rather than filtering them at the end, where a
    // rejected one still consumed a slot.
    .filter((c) => c.headline !== false)
    .map((c) => {
      const t = traits(c);
      const answers: string[] = [];
      let score = 0;

      // Each critical finding pulls in the concepts that answer it. The weights
      // say which problem is worth solving first, not which idea is nicer.
      if (ids.has('ig-ask') && (t.answersQuestions || t.drivesToMessage)) {
        score += 30; answers.push('ig-ask');
      }
      if ((ids.has('web-pixel') || ids.has('web-none')) && t.drivesToMessage) {
        score += 25; answers.push(ids.has('web-none') ? 'web-none' : 'web-pixel');
      }
      if (ids.has('web-price') && t.statesPrice) { score += 20; answers.push('web-price'); }
      if (ids.has('ig-engagement') && t.showsAFace) { score += 20; answers.push('ig-engagement'); }
      if (ids.has('ig-format') && t.isShortVideo) { score += 15; answers.push('ig-format'); }
      if (ids.has('web-whatsapp') && t.drivesToMessage) { score += 10; answers.push('web-whatsapp'); }

      if (vertical && c.verticals.includes(vertical)) score += verticalWeight;

      // A cheap yes beats a bigger first invoice, and more pieces from one crew
      // day is both better margin and more to run as ads afterwards.
      score += (2 - TIER_ORDER[c.tier]) * 6;
      score += Math.min(c.economics.originations, 12);

      const models = modelsNeeded(c);
      const crew = crewOf(c);
      return {
        c, score, answers, models, crew,
        uncastable: whyUncastable(
          c, models, crew, videographersOnRoster, modelsOnRoster, voicesOnRoster,
          bookable.length > 0),
      };
    })
    // `c.n` last, so the order does not depend on the order of the library
    // array. A sheet that re-ranked itself because somebody re-sorted the
    // source file would be unreviewable.
    .sort((a, b) =>
      b.score - a.score
      || b.c.economics.originations - a.c.economics.originations
      || a.c.n - b.c.n);

  // Passes, in the order the sheet's honesty depends on. Castable and diverse
  // first; then castable at the cost of a repeated answer set and finally of a
  // repeated shape, because an idea we can crew beats an idea we cannot; then
  // the next-best uncastable ones, marked, so the sheet is never short — five
  // ideas with two "cast to confirm" is honest, three looks like a failure.
  //
  // The shape cap is the last thing given up. It is the one the reader
  // actually feels: five ideas that answer nothing in common still read as
  // five ideas, where five identically-shot films read as one.
  const castable = scored.filter((x) => !x.uncastable);
  const rest = scored.filter((x) => x.uncastable);
  const shortlist: Scored[] = [];
  const take = pick(shortlist, want);
  for (const from of [castable, rest]) {
    take(from, 'both');
    take(from, 'shape');
  }
  for (const from of [castable, rest]) take(from, 'none');

  // What distinguishes a concept is what the OTHERS on the shortlist do not
  // also answer. Every one of them answers the biggest finding — that is why
  // each made the list — so leading with it gives five identical
  // justifications and nothing to choose between.
  const freq = new Map<string, number>();
  for (const x of shortlist) for (const a of x.answers) freq.set(a, (freq.get(a) ?? 0) + 1);

  // One counter for the whole shortlist — see castFor.
  const load = new Map<string, number>();
  const used = new Set<string>();
  let genericUsed = false;

  return shortlist.map(({ c, answers, models, crew, uncastable }) => {
    const videos = c.economics.originations;
    const deciding = rarest(answers, freq, used);
    if (deciding) used.add(deciding);
    const because = reason(deciding, c, genericUsed,
      !!vertical && c.verticals.includes(vertical));
    if (!deciding && !genericUsed) genericUsed = true;
    return {
      conceptN: c.n,
      name: c.name,
      tier: c.tier,
      shape: c.shape,
      videos,
      priceJOD: videos * VIDEO_JOD_PER,
      hook: c.hook,
      premise: c.premise,
      format: c.format,
      because,
      answers,
      models: models ?? 0,
      needsVoice: crew.voices > 0,
      cast: uncastable ? [] : castFor(c, models ?? 0, crew, bookable, load),
      crewNotes: crew.notes,
      ...(uncastable ? { uncastable } : {}),
    };
  });
}

/**
 * Whether the actual roster can fill this day, and if not, in whose words.
 *
 * The reason is the point. "Cannot cast" on a sheet tells an operator nothing;
 * "needs 8 models, 4 bookable" tells them whether to widen the roster or drop
 * the idea, which is a decision they can act on this afternoon.
 */
function whyUncastable(
  c: ConceptSource,
  models: number | null,
  crew: CrewNeed,
  videographers: number,
  modelsOnRoster: number,
  voices: number,
  anyBookable: boolean,
): string | undefined {
  // Nothing is castable off an empty roster, not even the concepts that ask
  // for nobody in front of the camera: an editor-only piece still needs an
  // editor, and a studio with no bookable person has no one to hand it to.
  // The sheet then says "cast confirmed before the shoot" rather than naming
  // people, which is the only honest thing it can say.
  if (!anyBookable) return 'nobody bookable on the roster';
  if (models === null) return `cast requirement not understood: "${c.production.cast}"`;
  if (crew.videographers > videographers) {
    return videographers === 0
      ? 'no videographer on the roster'
      : `needs ${crew.videographers} videographers, ${videographers} bookable`;
  }
  if (models > modelsOnRoster) {
    return `needs ${models} ${models === 1 ? 'model' : 'models'}, ${modelsOnRoster} bookable`;
  }
  if (crew.voices > voices) return 'needs a voiceover, none bookable';
  return undefined;
}

/**
 * Take the best, refusing to take the same film twice.
 *
 * Greedy down the ranking with two buckets: a shape may appear twice and no
 * more, and so may an identical set of answered findings. Measured on the real
 * library, three of five were the same client-fronted talking head — all
 * correctly ranked, and collectively one idea offered five times.
 *
 * Returns a `take` bound to one shortlist, because the caps have to hold
 * across every pass rather than within each one, and the caps come off one at
 * a time: for a clean account nothing answers anything, so every candidate
 * shares the empty answer set and that cap alone would stop the list at two.
 * Five ideas of one shape is a poor sheet, four ideas is a broken one.
 */
type Caps = 'both' | 'shape' | 'none';

function pick(into: Scored[], n: number) {
  const shapes = new Map<string, number>();
  const sets = new Map<string, number>();
  const key = (x: Scored) => [...x.answers].sort().join('+');
  const chosen = new Set<number>();
  return (from: Scored[], caps: Caps) => {
    for (const x of from) {
      if (into.length >= n) return;
      if (chosen.has(x.c.n)) continue;
      if (caps !== 'none' && (shapes.get(x.c.shape) ?? 0) >= PER_SHAPE) continue;
      if (caps === 'both' && (sets.get(key(x)) ?? 0) >= PER_ANSWER_SET) continue;
      into.push(x);
      chosen.add(x.c.n);
      shapes.set(x.c.shape, (shapes.get(x.c.shape) ?? 0) + 1);
      sets.set(key(x), (sets.get(key(x)) ?? 0) + 1);
    }
  };
}

/**
 * Why this idea, for this business.
 *
 * Assembled from the findings it answers. A concept that answers nothing gets
 * the honest version rather than an invented one — it is on the list because it
 * fits their trade and costs little, and saying so is better than a sentence
 * that sounds like a reason and is not.
 */
const WHY: Record<string, B> = {
  'ig-ask': {
    ar: 'لأنه بيطلب من المتفرّج إشي، وهاد بالضبط اللي ما بتعمله كابشناتهم.',
    en: 'Because it asks the viewer for something, which is exactly what their captions never do.',
  },
  'web-none': {
    ar: 'لأنه بينهي بمحادثة، وما عندهم موقع يوصّلوا عليه أصلًا.',
    en: 'Because it ends in a conversation, and they have no site to send anyone to.',
  },
  'web-pixel': {
    ar: 'لأنه بينهي بمحادثة، وموقعهم ما بيقيس أي إشي.',
    en: 'Because it ends in a conversation, and their site measures nothing.',
  },
  'web-price': {
    ar: 'لأنه بيحطّ السعر على الشاشة، والسعر مش مكتوب عندهم بأي مكان.',
    en: 'Because it puts the price on screen, and no price appears anywhere they publish.',
  },
  'ig-engagement': {
    ar: 'لأنه بيحطّ وجه إنسان بالكادر، وهاد أكتر إشي بيرفع تفاعلهم.',
    en: 'Because it puts a human face in frame, which is what lifts their engagement most.',
  },
  'ig-format': {
    ar: 'لأنه بنفس الشكل اللي أصلًا بيشتغل معهم.',
    en: 'Because it is the format already working for them.',
  },
  'web-whatsapp': {
    ar: 'لأنه بيوصل الزبون على الواتساب، وما في رابط واتساب على موقعهم.',
    en: 'Because it lands the buyer on WhatsApp, which their site offers no link to.',
  },
};

/** A stable order for equally rare answers, so the sheet does not shuffle. */
const WHY_ORDER = Object.keys(WHY);

/**
 * Why this idea rather than the other four.
 *
 * One deciding reason, not a list, and it is the answer RAREST across the
 * shortlist rather than the heaviest. Every concept here answers the biggest
 * finding — that is what got it onto the list — so the heaviest one is the
 * thing they all have in common and says nothing about which to pick.
 *
 * `used` is what makes it actually work. Sorting by frequency alone put the
 * whole shortlist on the same minimum, which is how five ideas ended up
 * carrying two sentences between them; a reason another recommendation has
 * already given distinguishes nothing and is skipped.
 */
function rarest(
  answers: string[],
  freq: Map<string, number>,
  used: Set<string>,
): string | undefined {
  return [...answers]
    .filter((a) => !used.has(a))
    .sort((a, b) =>
      (freq.get(a) ?? 0) - (freq.get(b) ?? 0)
      || WHY_ORDER.indexOf(a) - WHY_ORDER.indexOf(b))[0];
}

/**
 * What to say about a concept that answers none of their findings.
 *
 * It is on the list because it suits their trade and pays for itself, and
 * saying so is better than a sentence that sounds like a reason and is not.
 * But only once: two recommendations opening "fits their trade" reads as the
 * engine having run out of things to say, so after the first, the honest thing
 * left to describe is how the piece is made — which genuinely differs, and is
 * the thing the reader is choosing between anyway.
 */
const PLAIN: Record<Shape, B> = {
  'talking-head': {
    ar: 'إعداد تصوير واحد وصاحب الشغل بحكي بلسانه — بدون ديكور وبدون ممثلين.',
    en: 'One setup and the principal in their own words — nothing built, nobody cast.',
  },
  'ugc': {
    ar: 'مصوّر ليطلع كأنه متصوّر بالتلفون، لأنه هيك بيتفرّجوا عليه أصلًا.',
    en: 'Shot to look self-filmed, because that is how the feed is watched.',
  },
  'screen-record': {
    ar: 'تسجيل شاشة، بلا كاميرا وبلا يوم تصوير.',
    en: 'A screen recording — no camera and no shoot day.',
  },
  'product': {
    ar: 'إضاءة وحدة على طاولة وحدة، والمنتج نفسه هو الكادر.',
    en: 'One light on one surface, with the thing itself carrying the frame.',
  },
  'observational': {
    ar: 'الكاميرا بتتفرّج على شغل حقيقي، بلا تعليق وبلا تمثيل.',
    en: 'The camera watching real work, with nothing narrated and nothing performed.',
  },
  'documentary': {
    ar: 'ناس حقيقيين بيحكوا عن نتيجة صارت فعلًا، مش عن وعد.',
    en: 'Real people describing a result that already happened, not a promise.',
  },
  'graphics': {
    ar: 'الرقم على الشاشة والباقي بيتبنى بالمونتاج، فبيتكرّر برخص.',
    en: 'The number on screen and the rest built in post, so it repeats cheaply.',
  },
};

/**
 * Why this idea, in one line the client reads.
 *
 * `fitsTrade` is passed rather than assumed. The last branch used to be an
 * unconditional "Fits their trade", reached whenever a concept had no finding
 * left to claim and the plain line was already spent — so a concept that the
 * library never tagged for this vertical still told the client it suited their
 * trade. It surfaced on a real read: a loyalty platform set to `b2b` was shown
 * a real-estate concept, tagged `property` and nothing else, over the sentence
 * "Fits their trade". That is an invented justification on the one page a
 * client actually reads, which is the thing this engine may never do.
 */
function reason(
  deciding: string | undefined, c: ConceptSource, genericUsed: boolean, fitsTrade: boolean,
): B {
  const top = deciding ? WHY[deciding] : undefined;
  if (top) return top;
  if (genericUsed) {
    const p = PLAIN[c.shape];
    return {
      ar: `${p.ar} ${arPieces(c.economics.originations)} من يوم واحد.`,
      en: `${p.en} ${enPieces(c.economics.originations)} from one day.`,
    };
  }
  // Nothing left to claim and the plain line is spent. Only a concept the
  // library actually tagged for this trade may say so; everything else falls
  // back to the shape, which is true of any concept regardless of vertical.
  if (!fitsTrade) {
    const p = PLAIN[c.shape];
    return {
      ar: `${p.ar} ${arPieces(c.economics.originations)} من يوم واحد.`,
      en: `${p.en} ${enPieces(c.economics.originations)} from one day.`,
    };
  }
  return {
    ar: `مناسب لقطاعهم، وبيطلع ${arPieces(c.economics.originations)} من يوم تصوير واحد.`,
    en: `Fits their trade, and yields ${enPieces(c.economics.originations)} from a single crew day.`,
  };
}

/** Who from the roster, and why them. Availability is shown, never a filter —
 *  a producer offers the day and the person answers it themselves. */
/**
 * How well somebody fits this idea.
 *
 * Their tags against the concept's verticals and against the words the concept
 * uses about itself. Deliberately crude — it only has to beat "whoever the
 * sort put first", which is what this replaced and which named the same
 * videographer on all five ideas.
 */
const fitOf = (t: Talent, c: ConceptSource): number => {
  if (!t.tags?.length) return 0;
  const text = `${c.name} ${c.hook} ${c.premise} ${c.format} ${c.production.cast}`.toLowerCase();
  let fit = 0;
  for (const tag of t.tags) {
    // A vertical match is the strong signal: it is the library's own
    // classification rather than a word that happened to appear.
    if ((c.verticals as readonly string[]).includes(tag)) fit += 3;
    else if (tag.length > 3 && text.includes(tag.replace(/-/g, ' '))) fit += 1;
  }
  return fit;
};

/**
 * Who is on this one.
 *
 * `load` counts how many ideas on this shortlist have already named each
 * person, and is shared across the five. It is a tie-break rather than a
 * filter: the same videographer on three ideas is perfectly normal and is
 * three shooting days, which the conversion to a job already relies on. What
 * it prevents is five ideas naming one person purely because they sort first,
 * which gives Khaled nothing to choose between and hides everyone else on the
 * roster from the client.
 *
 * Order: fit, then least-used, then who has said they are free, then id — the
 * last so the same roster and the same concept always produce the same cast,
 * because a sheet that re-cast itself on every render would be unreviewable.
 */
function castFor(
  c: ConceptSource, models: number, crew: CrewNeed, roster: Talent[],
  load: Map<string, number>,
): CastPick[] {
  const picks: CastPick[] = [];
  // Per concept, not across the shortlist: one person cannot be two of the
  // three models on the same shoot.
  const taken = new Set<string>();

  const take = (discipline: string, why: B) => {
    const who = roster
      .filter((t) => t.discipline === discipline && !taken.has(t.id))
      .sort((a, b) =>
        fitOf(b, c) - fitOf(a, c)
        || (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)
        || Number(b.availability === 'available') - Number(a.availability === 'available')
        || a.id.localeCompare(b.id))[0];
    if (!who) return;
    taken.add(who.id);
    load.set(who.id, (load.get(who.id) ?? 0) + 1);
    picks.push({ talentId: who.id, name: who.name, discipline, why });
  };

  // Only as many as the library asked for. Concept 4 has no camera at all and
  // was being cast a videographer regardless; concept 20 wants two and got one.
  for (let i = 0; i < crew.videographers; i++) {
    take('videographer', {
      ar: 'بيصوّر وبيركّب نفس الشغلة، فاليوم بيخلص بيوم.',
      en: 'Shoots and cuts the same piece, so a day finishes in a day.',
    });
  }
  for (let i = 0; i < models; i++) {
    take('model', {
      ar: 'قدّام الكاميرا، وبيعرف يخلّي غير المحترف يرتاح.',
      en: 'On camera, and gets a non-performer to settle.',
    });
  }
  for (let i = 0; i < crew.voices; i++) {
    take('voiceover', {
      ar: 'تعليق صوتي بالعمّاني وبالفصحى.',
      en: 'Voiceover in Ammani dialect and in MSA.',
    });
  }
  return picks;
}
