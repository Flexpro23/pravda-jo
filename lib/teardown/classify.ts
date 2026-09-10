import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { VERTICAL_LABEL, type Vertical } from '@/lib/data/concepts';
import { normaliseAr } from '@/lib/teardown/arabic';
import { inferVertical, type VerticalEvidence, type VerticalGuess } from '@/lib/teardown/vertical';

/**
 * What is this business, read off the words it published.
 *
 * `lib/teardown/vertical.ts` answers the same question with a keyword lexicon,
 * and it is honest about being dumb. What it cannot do is notice that a
 * business is something the list has no word for — it can only score the nine
 * verticals it knows, so its two outcomes are "one of these nine" and silence,
 * and silence is what an operator then has to break by picking the nearest
 * wrong answer. A loyalty-card platform came through the funnel and got a
 * dermatology explainer on its shortlist exactly that way.
 *
 * This module reads the captions properly and adds the third outcome: *none of
 * these, and here is what it actually is*. That sentence is the thing an
 * operator needs and the lexicon can never produce.
 *
 * Four rules keep a language model inside a codebase whose first rule is that
 * every claim must be provable.
 *
 * **The model proposes and this file verifies.** Every phrase the model offers
 * as evidence is checked against the text that was actually read, with the same
 * normalisation the lexicon matcher uses, and anything not literally present is
 * dropped. A guess whose evidence does not survive that check is discarded
 * whole and the lexicon answers instead. Nothing reaches a sheet because a
 * model asserted it.
 *
 * **It is a guess, and it is labelled one.** The return type is the lexicon's
 * own `VerticalGuess`, so nothing downstream can tell the difference or needs
 * to. `run.ts` still promotes a guess to `Sheet.vertical` only above 0.7, the
 * recommender still scales its bonus by confidence, and an operator still
 * overrides both.
 *
 * **The summary never reaches the client.** It is a judgement about a business
 * rather than a number computed from its posts, so it is shown in the console
 * and nowhere else. `/s` prints a vertical label only when an operator has
 * confirmed it, and that does not change here.
 *
 * **It cannot break a read.** No key, a refused request, malformed JSON, a
 * vertical outside the enum, a timeout: every one of them falls through to the
 * lexicon. A classifier is worth having and not worth losing a lead over.
 *
 * It is called from `runRead`, never from `composeSheet` — the composer is pure
 * and pinned by a golden fixture, so the classification arrives as an input
 * like the profile and the site read do.
 */

/**
 * Which of the two Gemini backends this deployment talks to.
 *
 * Vertex is the one production uses, and it needs no secret at all: App
 * Hosting's runtime service account already authenticates, exactly as it does
 * for Firestore in `lib/store/firebase.ts`. That is the whole reason it was
 * chosen over an AI Studio key — one fewer credential to rotate, and the spend
 * lands on the Google Cloud project that already carries everything else.
 *
 * The project is named separately from `GOOGLE_CLOUD_PROJECT` because locally
 * that variable points at the Firestore *emulator* (`pravda-jo-local`), which
 * is not a real GCP project and would fail every Vertex call. On App Hosting
 * the two are the same and `VERTEX_PROJECT` can stay unset.
 *
 * `GEMINI_API_KEY` remains supported and wins when set, so a developer with no
 * application-default credentials can still run the classifier from a key.
 */
const vertexProject = (): string =>
  (process.env.VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '').trim();

/** `global` routes to wherever the model is served. Override per data residency. */
const vertexLocation = (): string =>
  (process.env.VERTEX_LOCATION || 'global').trim();

export function backend(): 'api-key' | 'vertex' | 'none' {
  if (process.env.GEMINI_API_KEY?.trim()) return 'api-key';
  // The emulator's project id is not a Vertex project, and calling it would
  // spend twelve seconds discovering that on every read.
  const p = vertexProject();
  if (p && !p.endsWith('-local')) return 'vertex';
  return 'none';
}

/** The one seam. Tests replace it; production never touches it. */
export const io = {
  generate: async (
    prompt: string, system: string, signal: AbortSignal,
  ): Promise<string | undefined> => {
    const ai = backend() === 'vertex'
      ? new GoogleGenAI({
        vertexai: true, project: vertexProject(), location: vertexLocation(),
      })
      : new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseSchema: SCHEMA,
        // A classification is not a reasoning problem, and this one sits on the
        // read path where a person is waiting. The accuracy that matters here
        // comes from having read the captions at all, which the lexicon never
        // did — not from thinking longer about them.
        //
        // `LOW` rather than `MINIMAL`: gemini-3.8-flash on Vertex rejects
        // MINIMAL outright with `400 Thinking level is unsupported`, and LOW is
        // the floor it accepts. Worth knowing before someone lowers it again.
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        // The same account must classify the same way twice. An operator who
        // re-runs a read to check an answer must not get a different one.
        temperature: 0,
        maxOutputTokens: 900,
        abortSignal: signal,
      },
    });
    return res.text;
  },
};

const MODEL = 'gemini-3.8-flash';

/** One request never hangs longer than this, matching `discovery.ts`'s ladder. */
const TIMEOUT_MS = 12_000;

/** Captions past this add cost and nothing else — the trade is obvious by 60. */
const MAX_CAPTIONS = 60;
/** And any single caption past this is a copy-pasted wall, not a sentence. */
const MAX_CAPTION_CHARS = 400;

const VERTICALS = Object.keys(VERTICAL_LABEL) as Vertical[];

export type BusinessSummary = { ar: string; en: string };

export type Classification = VerticalGuess & {
  /** Which of the two answered. The console says so rather than implying one. */
  source: 'model' | 'lexicon';
  /**
   * What this business is, in one sentence, in both languages.
   *
   * Present whenever the model ran, including — especially — when it could not
   * place the business in the taxonomy. Operator-only, see the file docstring.
   */
  summary?: BusinessSummary;
  /**
   * The model read it and said none of the nine fit.
   *
   * Distinct from a `null` guess for want of evidence: this one means the
   * business was understood and the list is what came up short, which is a
   * message to whoever maintains the list rather than to whoever reads the
   * sheet.
   */
  outsideTaxonomy?: boolean;
};

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vertical: {
      type: Type.STRING,
      // `none` is a first-class answer rather than an absence, so the model has
      // somewhere to put a business the list does not cover instead of being
      // pushed into the nearest label.
      enum: [...VERTICALS, 'none'],
      description: 'The single best fit, or "none" if this business is genuinely not any of them.',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Between 0 and 1. How sure you are, given only what you were shown.',
    },
    runnerUp: {
      type: Type.STRING,
      enum: [...VERTICALS, 'none'],
      description: 'The second best fit, or "none".',
    },
    evidence: {
      type: Type.ARRAY,
      description:
        'Two to five short phrases copied VERBATIM from the bio, captions or site text '
        + 'that led you to the answer. Copy exactly, character for character. Do not '
        + 'translate, paraphrase, correct spelling, or invent. A phrase that is not '
        + 'literally in the text will be discarded and may void your answer.',
      items: { type: Type.STRING },
    },
    summaryEn: {
      type: Type.STRING,
      description:
        'One sentence, max 25 words, plain English: what this business sells and to whom. '
        + 'Say only what the text supports. If it is unclear, say that it is unclear.',
    },
    summaryAr: {
      type: Type.STRING,
      description: 'The same sentence in Arabic. Levantine register, not formal MSA.',
    },
  },
  required: ['vertical', 'confidence', 'runnerUp', 'evidence', 'summaryEn', 'summaryAr'],
} as const;

const SYSTEM = [
  'You classify small businesses in Amman, Jordan from what they publish on Instagram.',
  '',
  'You are given a bio, up to sixty captions, and sometimes text from their website.',
  'Most captions are Jordanian Arabic. Some accounts write only in English.',
  '',
  'The trade list you must choose from:',
  ...VERTICALS.map((v) => `  ${v} — ${VERTICAL_LABEL[v].en}`),
  '',
  'Two distinctions people get wrong:',
  '  pro is a licensed individual selling their own judgement to a person: a',
  '    lawyer, an accountant, a dentist, a consultant.',
  '  b2b is a company selling a product or a service to another company:',
  '    software, a platform, a payments or loyalty product, a supplier, an agency.',
  '  A company selling software to clinics is b2b, not body.',
  '',
  'Answer "none" when the business is real and understood but genuinely is not any',
  'of them. That is a useful answer, not a failure. Never stretch to the nearest',
  'label — a wrong trade puts the wrong film on a real client\'s page.',
  '',
  'Set confidence low when the account is thin, the bio is generic marketing',
  'language, or the captions say nothing about what is sold. An eight-post account',
  'with a slogan for a bio does not support a confident answer.',
  '',
  'Every phrase in `evidence` must be copied verbatim from the text you were given.',
  'They are checked against it programmatically and dropped if absent.',
].join('\n');

/** The lexicon's fold, reused so verification matches the way the lexicon matches. */
const fold = (s: string): string => normaliseAr(s ?? '').toLowerCase();

/**
 * How many times this phrase really occurs in what was read.
 *
 * Substring rather than word-boundary, because Arabic glues its articles and
 * pronouns on and a boundary would reject a true quote for grammar. Short
 * fragments are refused outright: a three-character "quote" occurs in almost
 * any text by accident and would let a fabricated answer pass verification on
 * a coincidence.
 */
const MIN_QUOTE_CHARS = 6;

export function verifyQuote(quote: string, haystack: string): number {
  const q = fold(quote);
  if (q.length < MIN_QUOTE_CHARS) return 0;
  const h = fold(haystack);
  let n = 0;
  let i = h.indexOf(q);
  while (i !== -1) { n++; i = h.indexOf(q, i + q.length); }
  return n;
}

const clean = (s: unknown, max: number): string =>
  String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const isVertical = (v: unknown): v is Vertical =>
  typeof v === 'string' && (VERTICALS as string[]).includes(v);

export type ClassifyInput = {
  handle: string;
  name?: string;
  bio?: string;
  captions: string[];
  siteText?: string;
};

/** Everything the model is shown, and the only text a quote may come from. */
function corpus(input: ClassifyInput): { prompt: string; haystack: string } {
  const captions = (input.captions ?? [])
    .map((c) => clean(c, MAX_CAPTION_CHARS))
    .filter(Boolean)
    .slice(0, MAX_CAPTIONS);

  const parts = [
    `Instagram handle: @${input.handle}`,
    input.name ? `Account name: ${clean(input.name, 120)}` : '',
    '',
    'BIO:',
    clean(input.bio, 1000) || '(empty)',
    '',
    `CAPTIONS (${captions.length}):`,
    ...captions.map((c, i) => `${i + 1}. ${c}`),
  ];
  if (input.siteText) {
    parts.push('', 'WEBSITE TEXT:', clean(input.siteText, 2000));
  }

  // The haystack is what a quote is checked against, and it is deliberately
  // only the business's own words — not the handle, not the section headers,
  // not the numbering this function added. A model that quoted "CAPTIONS" back
  // would otherwise verify against scaffolding it was handed rather than
  // against anything the business said.
  const haystack = [
    clean(input.name, 120), clean(input.bio, 1000),
    ...captions, clean(input.siteText, 2000),
  ].filter(Boolean).join('\n');

  return { prompt: parts.join('\n'), haystack };
}

/**
 * Classify, or hand back the lexicon's answer.
 *
 * Never throws and never rejects: every failure is a fallback, and the caller
 * cannot tell an outage from a quiet day except by reading `source`.
 */
export async function classify(input: ClassifyInput): Promise<Classification> {
  const lexicon = (): Classification => ({
    ...inferVertical(input.bio ?? '', input.captions ?? [], input.siteText),
    source: 'lexicon',
  });

  if (backend() === 'none') return lexicon();

  const { prompt, haystack } = corpus(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let raw: string | undefined;
  try {
    raw = await io.generate(prompt, SYSTEM, controller.signal);
  } catch (e) {
    log({ msg: 'classify.failed', handle: input.handle, why: 'request', detail: msgOf(e) });
    return lexicon();
  } finally {
    clearTimeout(timer);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw ?? '');
  } catch {
    log({ msg: 'classify.failed', handle: input.handle, why: 'unparseable' });
    return lexicon();
  }

  // Verify before believing anything else in the answer. An evidence list that
  // does not survive is the signature of a model answering from the handle and
  // the vibe rather than from the captions, and the whole response goes with it.
  const claimed = Array.isArray(body.evidence) ? body.evidence : [];
  const guess = body.vertical === 'none' ? null
    : isVertical(body.vertical) ? body.vertical : undefined;

  if (guess === undefined) {
    log({ msg: 'classify.failed', handle: input.handle, why: 'unknown-vertical' });
    return lexicon();
  }

  const evidence: VerticalEvidence[] = [];
  let rejected = 0;
  for (const q of claimed.slice(0, 8)) {
    const term = clean(q, 160);
    const hits = verifyQuote(term, haystack);
    if (hits > 0 && guess) evidence.push({ vertical: guess, term, hits });
    else if (hits === 0) rejected++;
  }

  // A named trade has to be evidenced. "none" does not: the honest answer for a
  // business the list does not cover is often supported by the absence of any
  // matching words rather than the presence of some, and demanding a quote for
  // it would push the model back into naming a trade to satisfy the check.
  if (guess && evidence.length === 0) {
    log({
      msg: 'classify.failed', handle: input.handle,
      why: 'no-verifiable-evidence', rejected,
    });
    return lexicon();
  }

  const claimedConfidence = Number(body.confidence);
  // A model's stated confidence is its own, but it does not get to be certain:
  // 1.0 would let `run.ts` write the vertical onto the sheet with nobody having
  // agreed. Only an operator saying so is worth a 1.
  const confidence = Number.isFinite(claimedConfidence)
    ? Math.min(Math.max(claimedConfidence, 0), 0.95) : 0;
  const runnerUp = isVertical(body.runnerUp) && body.runnerUp !== guess
    ? body.runnerUp : null;
  const summaryEn = clean(body.summaryEn, 300);
  const summaryAr = clean(body.summaryAr, 300);

  // Both numbers, because they differ whenever the cap bites and a log that
  // printed only the claim would not match the sheet anybody is looking at.
  log({
    msg: 'classify.ok', handle: input.handle, model: MODEL,
    guess: guess ?? 'none', confidence, claimedConfidence,
    evidence: evidence.length, rejected,
  });

  return {
    guess,
    confidence,
    runnerUp,
    evidence: evidence.slice(0, 12),
    source: 'model',
    ...(summaryEn && summaryAr ? { summary: { ar: summaryAr, en: summaryEn } } : {}),
    ...(guess === null ? { outsideTaxonomy: true } : {}),
  };
}

const msgOf = (e: unknown) => (e instanceof Error ? e.message : 'unknown');
/** Same one-line-JSON convention as `lib/teardown/pipeline.ts`. */
const log = (row: Record<string, unknown>) => console.log(JSON.stringify(row));
