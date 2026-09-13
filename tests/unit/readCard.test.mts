import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCompCard, io } from '@/lib/talent/readCard';

/**
 * The card reader returns a draft and never a saved fact. These tests hold it
 * to the two things that make that safe: every value passes the same range
 * check a typed one does, and a value that fails is named rather than lost.
 * No network — `io.read` is scripted, and the Vertex project variable is set
 * so `backend()` believes a backend exists.
 */

const IMG = { bytes: Buffer.from([0xff, 0xd8, 0xff, 0x00]), mimeType: 'image/jpeg' };

async function withReply<T>(reply: unknown, fn: () => Promise<T>): Promise<T> {
  const real = io.read; const proj = process.env.VERTEX_PROJECT;
  process.env.VERTEX_PROJECT = 'pravda-jo';
  io.read = async () => (typeof reply === 'string' ? reply : JSON.stringify(reply));
  try { return await fn(); } finally {
    io.read = real;
    if (proj === undefined) delete process.env.VERTEX_PROJECT; else process.env.VERTEX_PROJECT = proj;
  }
}

test('a card in any order, any spelling, comes out as clean attributes', async () => {
  const r = await withReply({
    phone: '0787084099', nameEn: 'YARA', nameAr: null,
    shoeEu: 37, size: 'M', heightCm: 160, weightKg: 64, hipsCm: null, bustCm: null, waistCm: null,
  }, () => readCompCard({ image: IMG }, 'model'));
  assert.ok(r.ok); if (!r.ok) return;
  assert.deepEqual(r.attributes, { heightCm: 160, weightKg: 64, size: 'M', shoeEu: 37 });
  assert.equal(r.name?.en, 'YARA');
  assert.equal(r.phone, '0787084099');
  assert.deepEqual(r.unread, [], 'nulls are blanks, not failures');
});

test('a value outside its range is refused and named, never stored', async () => {
  const r = await withReply({ heightCm: 16, weightKg: 52, size: 'xs-s' }, () => readCompCard({ image: IMG }, 'model'));
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.attributes.heightCm, undefined);
  assert.equal(r.attributes.weightKg, 52);
  assert.equal(r.attributes.size, 'XS–S', 'the range is normalised like a typed one');
  assert.deepEqual(r.unread, ['Height: read as “16”']);
});

test('a field from another trade, or one the schema does not know, is dropped', async () => {
  const r = await withReply({ heightCm: 170, drone: true, iq: 140 }, () => readCompCard({ image: IMG }, 'model'));
  assert.ok(r.ok); if (!r.ok) return;
  assert.deepEqual(Object.keys(r.attributes), ['heightCm']);
});

test('garbage, an array, and a thrown request all refuse rather than throw', async () => {
  const a = await withReply('I cannot read this image', () => readCompCard({ image: IMG }, 'model'));
  assert.deepEqual(a, { ok: false, why: 'unparseable' });
  const b = await withReply([1, 2], () => readCompCard({ image: IMG }, 'model'));
  assert.deepEqual(b, { ok: false, why: 'unparseable' });
  const real = io.read; const proj = process.env.VERTEX_PROJECT; process.env.VERTEX_PROJECT = 'pravda-jo';
  io.read = async () => { throw new Error('ECONNRESET'); };
  const c = await readCompCard({ image: IMG }, 'model');
  io.read = real; if (proj === undefined) delete process.env.VERTEX_PROJECT; else process.env.VERTEX_PROJECT = proj;
  assert.deepEqual(c, { ok: false, why: 'request' });
});

test('with no backend configured it says so instead of pretending to read', async () => {
  const saved = { p: process.env.VERTEX_PROJECT, g: process.env.GOOGLE_CLOUD_PROJECT, k: process.env.GEMINI_API_KEY };
  delete process.env.VERTEX_PROJECT; delete process.env.GEMINI_API_KEY; process.env.GOOGLE_CLOUD_PROJECT = 'pravda-jo-local';
  const r = await readCompCard({ image: IMG }, 'model');
  for (const [k, v] of [['VERTEX_PROJECT', saved.p], ['GOOGLE_CLOUD_PROJECT', saved.g], ['GEMINI_API_KEY', saved.k]] as const) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  assert.deepEqual(r, { ok: false, why: 'unconfigured' });
});

test('a pasted message reads the same way as a picture', async () => {
  let seen: unknown[] = [];
  const real = io.read; const proj = process.env.VERTEX_PROJECT; process.env.VERTEX_PROJECT = 'pravda-jo';
  io.read = async (parts) => { seen = parts; return JSON.stringify({ heightCm: 160, weightKg: 60, nameEn: 'Merna' }); };
  const r = await readCompCard({ text: '160 60 18 Merna' }, 'model');
  io.read = real; if (proj === undefined) delete process.env.VERTEX_PROJECT; else process.env.VERTEX_PROJECT = proj;
  assert.ok(r.ok); if (!r.ok) return;
  assert.deepEqual(r.attributes, { heightCm: 160, weightKg: 60 });
  assert.equal(r.name?.en, 'Merna');
  assert.ok(seen.some((p) => 'text' in (p as object) && String((p as { text: string }).text).includes('160 60 18 Merna')),
    'the pasted message reaches the model as text, not as an image');
});
