import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, verifyQuote, io, type ClassifyInput } from '@/lib/teardown/classify';
import { urlFromBio, pickWebsite } from '@/lib/meta/website';

/**
 * The classifier's contract, and one property in particular: a model does not
 * get to assert anything. Everything it offers as evidence is checked against
 * the text that was actually read, and an answer whose evidence does not
 * survive is thrown away in favour of the keyword lexicon.
 *
 * No network. `io.generate` is the seam, replaced per test the same way
 * `discovery.ts`'s fetch is in `discovery.test.mts`.
 */

const KEY = 'GEMINI_API_KEY';

/** Run `fn` with a scripted model reply and a key present. */
async function withModel<T>(reply: unknown, fn: () => Promise<T>): Promise<T> {
  const realGenerate = io.generate;
  const realKey = process.env[KEY];
  process.env[KEY] = 'test-key-not-real';
  io.generate = async () => (typeof reply === 'string' ? reply : JSON.stringify(reply));
  try {
    return await fn();
  } finally {
    io.generate = realGenerate;
    if (realKey === undefined) delete process.env[KEY]; else process.env[KEY] = realKey;
  }
}

/** A business the nine-vertical list genuinely does not cover. */
const WASLA: ClassifyInput = {
  handle: 'wasla.jo',
  name: 'WASLA',
  bio: 'Where customer loyalty meets smarter growth.\nBuilt for brands that value every customer',
  captions: [
    'Every merchant on WASLA sees repeat purchase rate in one dashboard',
    'Loyalty that works without a plastic card',
    'Onboarding a new brand takes under a week',
  ],
};

test('a verbatim quote verifies; a fabricated one does not', () => {
  const hay = 'Loyalty that works without a plastic card';
  assert.equal(verifyQuote('without a plastic card', hay), 1);
  assert.equal(verifyQuote('punch cards for every cafe', hay), 0);
});

test('a quote too short to be evidence is refused', () => {
  // Three characters occur in almost any text by accident, so a fabricated
  // answer must not pass verification on a coincidence.
  assert.equal(verifyQuote('the', 'the quick brown fox'), 0);
  assert.equal(verifyQuote('quick brown', 'the quick brown fox'), 1);
});

test('Arabic verifies through normalisation, not despite it', () => {
  // The quote is spelled with ة and the caption with ه — the same word to a
  // reader, two strings to a computer. `normaliseAr` is what closes that.
  assert.equal(verifyQuote('محمصة قهوة', 'عنا محمصه قهوه في اللويبدة'), 1);
});

test('a model answer with verifiable evidence is used, and capped below certainty', async () => {
  const out = await withModel({
    vertical: 'b2b',
    confidence: 1,
    runnerUp: 'pro',
    evidence: ['repeat purchase rate in one dashboard', 'Onboarding a new brand'],
    summaryEn: 'A loyalty and rewards platform sold to retail brands.',
    summaryAr: 'منصة ولاء ومكافآت بتنباع للعلامات التجارية.',
  }, () => classify(WASLA));

  assert.equal(out.source, 'model');
  assert.equal(out.guess, 'b2b');
  assert.equal(out.evidence.length, 2);
  // A model is never certain. Only an operator saying so is worth a 1.
  assert.ok(out.confidence <= 0.95, `confidence ${out.confidence} must be capped`);
  assert.equal(out.summary?.en, 'A loyalty and rewards platform sold to retail brands.');
});

test('an answer whose evidence is all fabricated falls back to the lexicon', async () => {
  const out = await withModel({
    vertical: 'food',
    confidence: 0.9,
    runnerUp: 'retail',
    // None of this appears anywhere in WASLA's text.
    evidence: ['قهوة مختصة', 'our breakfast menu', 'fresh baked daily'],
    summaryEn: 'A cafe in Amman.',
    summaryAr: 'كافيه في عمان.',
  }, () => classify(WASLA));

  assert.equal(out.source, 'lexicon', 'unverifiable evidence must void the model answer');
  assert.notEqual(out.guess, 'food');
  assert.equal(out.summary, undefined, 'a voided answer carries no summary either');
});

test('"none" is a real answer and needs no quote to support it', async () => {
  const out = await withModel({
    vertical: 'none',
    confidence: 0.8,
    runnerUp: 'none',
    evidence: [],
    summaryEn: 'A B2B loyalty platform; none of the nine trades fit it.',
    summaryAr: 'منصة ولاء للشركات، وما بتنطبق عليها أي فئة من التسع.',
  }, () => classify(WASLA));

  assert.equal(out.source, 'model');
  assert.equal(out.guess, null);
  assert.equal(out.outsideTaxonomy, true);
  assert.ok(out.summary?.en.includes('loyalty'), 'the summary survives a null guess');
});

test('a vertical outside the enum is refused rather than stored', async () => {
  const out = await withModel({
    vertical: 'crypto', confidence: 0.9, runnerUp: 'none',
    evidence: ['Loyalty that works'], summaryEn: 'x', summaryAr: 'س',
  }, () => classify(WASLA));
  assert.equal(out.source, 'lexicon');
});

test('unparseable output, a thrown request and no key all fall back quietly', async () => {
  const notJson = await withModel('sorry, I cannot help with that', () => classify(WASLA));
  assert.equal(notJson.source, 'lexicon');

  const realGenerate = io.generate;
  const realKey = process.env[KEY];
  process.env[KEY] = 'test-key-not-real';
  io.generate = async () => { throw new Error('ECONNRESET'); };
  const threw = await classify(WASLA);
  io.generate = realGenerate;
  if (realKey === undefined) delete process.env[KEY]; else process.env[KEY] = realKey;
  assert.equal(threw.source, 'lexicon');

  const saved = process.env[KEY];
  delete process.env[KEY];
  const noKey = await classify(WASLA);
  if (saved !== undefined) process.env[KEY] = saved;
  assert.equal(noKey.source, 'lexicon');
});

/* ── the bio URL extractor ────────────────────────────────────────────────── */

test('a domain written into the bio is found', () => {
  assert.equal(urlFromBio('محمصة قهوة · habbeh.jo · شحن لكل الأردن'), 'https://habbeh.jo/');
  assert.equal(urlFromBio('order at www.example.com'), 'https://www.example.com/');
  assert.equal(urlFromBio('https://shop.example.co/store'), 'https://shop.example.co/store');
});

test('what is not a website is not mistaken for one', () => {
  assert.equal(urlFromBio('For inquiries 0798118880'), null);
  assert.equal(urlFromBio('مفتوحين 24.7'), null);
  assert.equal(urlFromBio('من 8.50 دينار'), null);
  assert.equal(urlFromBio('hello@example.com'), null, 'an email is not a website');
  assert.equal(urlFromBio(''), null);
  assert.equal(urlFromBio(null), null);
});

test('a link aggregator is not a site to audit', () => {
  assert.equal(urlFromBio('all our links linktr.ee/somebrand'), null);
  assert.equal(urlFromBio('واتساب wa.me/962790000000'), null);
});

test('the three website sources rank operator, then link field, then bio text', () => {
  assert.deepEqual(
    pickWebsite('typed.example.com', 'https://field.example.com', 'bio.example.com'),
    { url: 'https://typed.example.com/', source: 'operator' },
  );
  assert.deepEqual(
    pickWebsite('', 'https://field.example.com', 'bio.example.com'),
    { url: 'https://field.example.com/', source: 'bio-link' },
  );
  assert.deepEqual(
    pickWebsite('', '', 'our shop is bio.example.com'),
    { url: 'https://bio.example.com/', source: 'bio-text' },
  );
  // An aggregator in the link field falls through — businesses that use one
  // often write their real domain out in the bio as well.
  assert.deepEqual(
    pickWebsite('', 'https://linktr.ee/brand', 'real site: bio.example.com'),
    { url: 'https://bio.example.com/', source: 'bio-text' },
  );
  assert.equal(pickWebsite('', '', 'call us on 0790000000'), null);
});
