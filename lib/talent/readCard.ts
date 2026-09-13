import { Type, ThinkingLevel } from '@google/genai';
import { backend, client } from '@/lib/teardown/classify';
import { cleanAttributes, fieldsFor, type Attributes, type Field } from '@/lib/data/talentFields';
import type { TalentDiscipline } from '@/lib/data/deals';

/**
 * Read a comp card off a photograph of one.
 *
 * Cards arrive as WhatsApp images: a photo of a printed card, a screenshot of
 * somebody's notes, a designed one-pager. The fields are in whatever order
 * the agency wrote them, in Arabic or English or both, with the units left
 * off half the time — height on one line, "waight 64" on the next. Typing
 * eight numbers off such a picture is the tedious part of adding a person,
 * and a keyword lexicon cannot do it: the numbers carry no words to match.
 *
 * So a model reads it. What it returns is a DRAFT, and three things keep it
 * one:
 *
 *   · Nothing here is saved. The route hands the draft to the console, the
 *     operator sees every value in an editable field, and only what they
 *     press Save on is written — through the same endpoint and the same
 *     `cleanAttributes` a hand-typed card goes through.
 *   · Every number is range-checked by `cleanAttributes` before it reaches
 *     the form. A height read as 16 is dropped and named in `unread`, so the
 *     operator is told "height: read as 16 — check the card" rather than
 *     shown a blank that looks like the card had no height.
 *   · The prompt forbids estimating. A card with no waist on it yields no
 *     waist. A comp card is a set of claims about a person's body, and a
 *     plausible number invented to fill a box is the exact failure this whole
 *     codebase is built to refuse.
 *
 * Age is not read even when it is on the card. The record holds a playing
 * age, set by the operator, and nothing birth-adjacent — see `talentFields`.
 */

/** The one seam. Tests replace it; production never touches it. */
export const io = {
  read: async (
    image: { mimeType: string; data: string }, prompt: string, schema: unknown, signal: AbortSignal,
  ): Promise<string | undefined> => {
    const res = await client().models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ inlineData: image }, { text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema as never,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        temperature: 0,
        maxOutputTokens: 1200,
        abortSignal: signal,
      },
    });
    return res.text;
  },
};

const MODEL = 'gemini-3.8-flash';
/** A photo is bigger than a caption list; the ladder in classify.ts is 12s. */
const TIMEOUT_MS = 25_000;

export type CardDraft = {
  ok: true;
  attributes: Attributes;
  name?: { en?: string; ar?: string };
  phone?: string;
  /** Values the card carried that did not survive the range check, for the operator to see. */
  unread: string[];
};
export type CardRefusal = { ok: false; why: 'unconfigured' | 'request' | 'unparseable' | 'timeout' };

/** The schema follows the discipline's own field list, so a new field is one entry in talentFields. */
function schemaFor(fields: Field[]) {
  const properties: Record<string, unknown> = {
    nameEn: { type: Type.STRING, nullable: true, description: 'Their name in Latin letters, exactly as written on the card.' },
    nameAr: { type: Type.STRING, nullable: true, description: 'Their name in Arabic letters, only if the card writes it in Arabic.' },
    phone: { type: Type.STRING, nullable: true, description: 'A phone number, digits as written.' },
  };
  for (const f of fields) {
    const d = { description: `${f.label.en}${f.kind === 'number' && f.unit ? `, in ${f.unit.en}` : ''}. Null if not on the card.` };
    properties[f.key] =
      f.kind === 'number' ? { type: Type.NUMBER, nullable: true, ...d }
      : f.kind === 'list' ? { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true, ...d }
      : f.kind === 'flag' ? { type: Type.BOOLEAN, nullable: true, ...d }
      : { type: Type.STRING, nullable: true, ...d };
  }
  return { type: Type.OBJECT, properties };
}

const PROMPT = (fields: Field[]) => [
  'This image is a talent comp card, or a photo or screenshot of one, from Jordan.',
  'Read the fields off it into the JSON schema. Rules:',
  '',
  '· The fields appear in ANY order, in Arabic or English or both, often with',
  '  spelling mistakes ("waight", "heigh") and often without units. Match by meaning.',
  '· Heights and body measurements are centimetres; weight is kilograms; shoe size is',
  '  EU. If a value is plainly in another unit, convert it.',
  '· A clothing size may be a range like "xs-s". Return it as written.',
  '· Return null for anything not on the card. Never estimate, never infer a',
  '  measurement from a photograph, never fill a blank with a typical value.',
  '· Ignore age and date of birth entirely, even if printed.',
  '',
  'Fields: ' + fields.map((f) => `${f.key} (${f.label.en})`).join(', '),
].join('\n');

export async function readCompCard(
  image: { bytes: Buffer; mimeType: string }, discipline: TalentDiscipline,
): Promise<CardDraft | CardRefusal> {
  if (backend() === 'none') return { ok: false, why: 'unconfigured' };
  const fields = fieldsFor(discipline);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let raw: string | undefined;
  try {
    raw = await io.read(
      { mimeType: image.mimeType, data: image.bytes.toString('base64') },
      PROMPT(fields), schemaFor(fields), controller.signal,
    );
  } catch (e) {
    log({ msg: 'card.failed', why: controller.signal.aborted ? 'timeout' : 'request', detail: msgOf(e) });
    return { ok: false, why: controller.signal.aborted ? 'timeout' : 'request' };
  } finally {
    clearTimeout(timer);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw ?? '');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed;
  } catch {
    log({ msg: 'card.failed', why: 'unparseable' });
    return { ok: false, why: 'unparseable' };
  }

  const attributes = cleanAttributes(discipline, body);

  // What the model read that the range check refused: shown, not silently
  // dropped, because a blank and a refused value are different situations for
  // the person about to press Save.
  const unread: string[] = [];
  for (const f of fields) {
    const v = body[f.key];
    if (v === null || v === undefined || v === '') continue;
    if (attributes[f.key] === undefined) unread.push(`${f.label.en}: read as “${String(v)}”`);
  }

  const str = (v: unknown, max: number) => {
    const s = String(v ?? '').trim().slice(0, max);
    return s || undefined;
  };
  const nameEn = str(body.nameEn, 80);
  const nameAr = str(body.nameAr, 80);
  const phone = str(body.phone, 20)?.replace(/[^\d+]/g, '') || undefined;

  log({ msg: 'card.ok', model: MODEL, discipline, fields: Object.keys(attributes).length, unread: unread.length });
  return {
    ok: true, attributes, unread,
    ...(nameEn || nameAr ? { name: { ...(nameEn ? { en: nameEn } : {}), ...(nameAr ? { ar: nameAr } : {}) } } : {}),
    ...(phone ? { phone } : {}),
  };
}

const msgOf = (e: unknown) => (e instanceof Error ? e.message : 'unknown');
const log = (row: Record<string, unknown>) => console.log(JSON.stringify(row));
