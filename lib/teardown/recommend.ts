import { CONCEPTS, VIDEO_JOD_PER, type ConceptSource, type Vertical } from '@/lib/data/concepts';
import type { Findings } from '@/lib/teardown/findings';
import type { Talent } from '@/lib/data/deals';

/**
 * Five ideas for this business, chosen from the library and never invented.
 *
 * The selection has to be defensible line by line, because Khaled reads it and
 * then defends it on a call. So a concept is ranked by what it answers: each
 * critical finding maps to a trait a concept either has or does not, and the
 * reason a concept appears is assembled from the findings it answers rather
 * than written afterwards to fit.
 *
 * Two hard filters rather than soft preferences. A concept we cannot cast from
 * the actual roster is not a recommendation, it is a promise — eight models
 * when four exist is how a studio ends up buying its way out of its own
 * proposal. And a discipline with no published rate cannot be quoted at all.
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
  /** Nobody on the roster fits. Shown, but cannot be sent. */
  uncastable?: string;
};

/** "Client-fronted — no models" → 0; "2 models" → 2. */
const modelsNeeded = (c: ConceptSource): number => {
  if (/no models|client-fronted/i.test(c.production.cast)) return 0;
  return Number(c.production.cast.match(/(\d+)\s*models?/i)?.[1] ?? 1);
};
const needsVoice = (c: ConceptSource) => /voice actor/i.test(c.production.crew);

/**
 * What a concept does, inferred once from its own text.
 *
 * Heuristic, and deliberately narrow: each trait is checked against the words
 * the library actually uses for that idea, not against a general notion of it.
 */
const traits = (c: ConceptSource) => {
  const all = `${c.name} ${c.hook} ${c.premise} ${c.format}`.toLowerCase();
  return {
    // Narrow on purpose. The first version matched "ask", "camera" and "order"
    // and so was true of nearly every concept — which produced five
    // recommendations carrying five identical reasons, and a sheet that gave
    // Khaled nothing to choose between.
    answersQuestions: /\b(question|objection|faq|inbox|asked)\b/.test(all),
    statesPrice: /\b(price|priced|pricing|how much|fils|the number)\b/.test(all),
    drivesToMessage: /\b(whatsapp|dm|direct message)\b/.test(all),
    showsAFace: modelsNeeded(c) > 0 || /\b(principal|owner|staff|talking.head|to camera)\b/.test(all),
    isShortVideo: /\breel/.test(c.format.toLowerCase()),
  };
};

const TIER_ORDER = { light: 0, standard: 1, premium: 2 } as const;

export function recommend(
  fx: Findings,
  roster: Talent[],
  vertical: Vertical | null,
  want = 5,
): Recommendation[] {
  const ids = new Set(fx.findings.map((f) => f.id));
  const bookable = roster.filter((t) => t.active && t.dayRateJOD > 0);
  const have = (d: string) => bookable.filter((t) => t.discipline === d);
  const modelsOnRoster = have('model').length;
  const voicesOnRoster = have('voiceover').length;

  const scored = CONCEPTS.map((c) => {
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

    if (vertical && c.verticals.includes(vertical)) score += 18;

    // A cheap yes beats a bigger first invoice, and more pieces from one crew
    // day is both better margin and more to run as ads afterwards.
    score += (2 - TIER_ORDER[c.tier]) * 6;
    score += Math.min(c.economics.originations, 12);

    return { c, score, answers, models: modelsNeeded(c), voice: needsVoice(c) };
  })
    // Hard filters, not preferences.
    .filter((x) => x.models <= modelsOnRoster || x.models === 0)
    .filter((x) => !x.voice || voicesOnRoster > 0)
    .sort((a, b) => b.score - a.score || b.c.economics.originations - a.c.economics.originations);

  const shortlist = scored.slice(0, want);

  // What distinguishes a concept is what the OTHERS on the shortlist do not
  // also answer. Every one of them answers the biggest finding — that is why
  // each made the list — so leading with it gives five identical
  // justifications and nothing to choose between.
  const freq = new Map<string, number>();
  for (const x of shortlist) for (const a of x.answers) freq.set(a, (freq.get(a) ?? 0) + 1);
  const rarest = (answers: string[]) =>
    [...answers].sort((a, b) => (freq.get(a) ?? 0) - (freq.get(b) ?? 0))[0];

  return shortlist.map(({ c, answers, models, voice }) => {
    const videos = c.economics.originations;
    return {
      conceptN: c.n,
      name: c.name,
      tier: c.tier,
      videos,
      priceJOD: videos * VIDEO_JOD_PER,
      hook: c.hook,
      premise: c.premise,
      format: c.format,
      because: reason(rarest(answers), c),
      answers,
      models,
      needsVoice: voice,
      cast: castFor(c, models, voice, bookable),
    };
  });
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

/**
 * Why this idea rather than the other four.
 *
 * One deciding reason, not a list, and it is the answer RAREST across the
 * shortlist rather than the heaviest. Every concept here answers the biggest
 * finding — that is what got it onto the list — so the heaviest one is the
 * thing they all have in common and says nothing about which to pick. What
 * only this concept does is the thing worth reading.
 */
function reason(deciding: string | undefined, c: ConceptSource): B {
  const top = deciding ? WHY[deciding] : undefined;
  if (!top) {
    return {
      ar: `مناسب لقطاعهم، وبيطلع ${c.economics.originations} مقاطع من يوم تصوير واحد.`,
      en: `Fits their trade, and yields ${c.economics.originations} pieces from a single crew day.`,
    };
  }
  return top;
}

/** Who from the roster, and why them. Availability is shown, never a filter —
 *  a producer offers the day and the person answers it themselves. */
function castFor(
  c: ConceptSource, models: number, voice: boolean, roster: Talent[],
): CastPick[] {
  const picks: CastPick[] = [];
  const taken = new Set<string>();

  const take = (discipline: string, why: B) => {
    const who = roster
      .filter((t) => t.discipline === discipline && !taken.has(t.id))
      // Whoever has said they are free, first.
      .sort((a, b) => (a.availability === 'available' ? -1 : 1)
        - (b.availability === 'available' ? -1 : 1))[0];
    if (!who) return;
    taken.add(who.id);
    picks.push({ talentId: who.id, name: who.name, discipline, why });
  };

  take('videographer', {
    ar: 'بيصوّر وبيركّب نفس الشغلة، فاليوم بيخلص بيوم.',
    en: 'Shoots and cuts the same piece, so a day finishes in a day.',
  });
  for (let i = 0; i < models; i++) {
    take('model', {
      ar: 'قدّام الكاميرا، وبيعرف يخلّي غير المحترف يرتاح.',
      en: 'On camera, and gets a non-performer to settle.',
    });
  }
  if (voice) {
    take('voiceover', {
      ar: 'تعليق صوتي بالعمّاني وبالفصحى.',
      en: 'Voiceover in Ammani dialect and in MSA.',
    });
  }
  return picks;
}
