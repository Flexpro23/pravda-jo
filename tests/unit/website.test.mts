/**
 * Reading a website, without a network.
 *
 * Two halves, tested two ways. `parseSite` is pure, so ten checked-in fixtures
 * pin every fact the sheet is allowed to claim about a site. `readSite` is the
 * I/O half, so its cases are the ones that used to be dangerous or dishonest: a
 * redirect into the cloud metadata service, a 300MB "website", a body buffered
 * whole before it was capped, and a single cold sample presented as the site's
 * speed.
 */
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSite, readSite, privateAddress, io, type SiteFacts } from '@/lib/meta/website';

const sites = new URL('../fixtures/sites/', import.meta.url);
const html = (name: string) => readFileSync(new URL(name, sites), 'utf8');

let realFetch: typeof globalThis.fetch;

before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error('unit tests must not open a socket');
  }) as typeof globalThis.fetch;
});

beforeEach(() => {
  assert.notEqual(io.fetch, realFetch, 'io.fetch must be the stub, never the real one');
  // Every name is a public host. A literal address never reaches the resolver
  // at all now — `resolvable` judges it directly — which is what makes the
  // metadata redirect test a real test.
  io.lookup = async () => [{ address: '93.184.216.34' }];
  io.now = () => Date.now();
});

/* ---------------------------------------------------------------- *
 * privateAddress — the guard's whole judgement, in one table.       *
 * ---------------------------------------------------------------- */

const PRIVATE = [
  '169.254.169.254',        // the cloud metadata service itself
  '10.0.0.1',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '::',
  '::ffff:169.254.169.254', // the one that used to come back 'ok'
  '::ffff:10.0.0.1',
  '::ffff:7f00:1',          // the same mapping, written in hex
  '64:ff9b::a9fe:a9fe',     // NAT64 translation of the metadata service
  '2002:a9fe:a9fe::',       // 6to4 tunnel to the same place
  'fe80::1',
  'fc00::1',
  'fd12::1',
];

const PUBLIC = ['93.184.216.34', '2606:4700::1111'];

for (const addr of PRIVATE) {
  test(`privateAddress refuses ${addr}`, () => {
    assert.equal(privateAddress(addr), true);
  });
}

for (const addr of PUBLIC) {
  test(`privateAddress allows ${addr}`, () => {
    assert.equal(privateAddress(addr), false);
  });
}

test('anything that is not an address at all is refused, not parsed', () => {
  for (const junk of ['', 'localhost', '169.254.169.254.evil.com', '10', 'not-an-ip']) {
    assert.equal(privateAddress(junk), true, junk);
  }
});

/* ---------------------------------------------------------------- *
 * parseSite — ten fixtures, one table.                              *
 * ---------------------------------------------------------------- */

const CASES: [string, string, Partial<SiteFacts>][] = [
  ['shopify-pixel.html', 'https://shop.example.com/', {
    platform: 'shopify',
    metaPixel: true,
    metaPixelId: '123456789012345',
    metaCapiHint: false,
    googleAnalytics: true,
    snapPixel: true,
    googleAdsConversion: true,
    hasProductOffers: true,
    hasLocalBusiness: false,
    canonicalMatchesFinalUrl: true,
    noindex: false,
    showsPrice: true,
    form: true,
    ogImage: true,
    instagram: 'ammanleather',
    hasArabicRoute: false,
    mobileReady: true,
  }],
  ['salla-no-pixel.html', 'https://perfume.example.com/', {
    platform: 'salla',
    metaPixel: false,
    googleAnalytics: false,
    whatsapp: true,
    whatsappNumber: '962791234567',
    phoneInText: false,
    hasArabic: true,
    lang: 'ar',
    showsPrice: true,
  }],
  ['wordpress-noindex.html', 'https://clinic.example.com/', {
    platform: 'wordpress',
    noindex: true,
    robotsMeta: 'noindex, nofollow',
    metaPixel: true,
    metaPixelId: undefined,
    metaCapiHint: true,
    gtm: true,
    telLink: true,
    phoneInText: false,
  }],
  ['http-only.html', 'http://hardware.example.com/', {
    https: false,
    mobileReady: false,
    telLink: true,
    platform: 'custom',
  }],
  ['arabic-only.html', 'https://kitchen.example.com/', {
    hasArabic: true,
    lang: 'ar',
    hreflangs: [],
    hasArabicRoute: false,
    form: true,
  }],
  ['hreflang-pair.html', 'https://rimal.example.com/en/', {
    hreflangs: ['en', 'ar-jo', 'x-default'],
    hasArabicRoute: true,
    canonical: 'https://rimal.example.com/en/',
    canonicalMatchesFinalUrl: true,
    booking: 'calendly',
    mailto: true,
  }],
  ['jsonld-localbusiness.html', 'https://zaytoun.example.com/', {
    hasLocalBusiness: true,
    hasPostalAddress: true,
    hasOpeningHours: true,
    hasAggregateRating: true,
    hasProductOffers: false,
  }],
  ['jsonld-malformed.html', 'https://broken.example.com/', {
    schemaTypes: ['WebSite'],
    hasLocalBusiness: false,
  }],
  ['wa-link.html', 'https://salon.example.com/', {
    whatsapp: true,
    whatsappNumber: '962790000000',
    phoneInText: false,
    hasArabic: true,
  }],
  ['bare-phone.html', 'https://laundry.example.com/', {
    whatsapp: false,
    telLink: false,
    phoneInText: true,
    hasArabic: true,
  }],
];

for (const [file, finalUrl, want] of CASES) {
  test(`parseSite: ${file}`, () => {
    const facts = parseSite(html(file), finalUrl);
    for (const [k, v] of Object.entries(want)) {
      assert.deepEqual(facts[k as keyof SiteFacts], v, `${file} · ${k}`);
    }
  });
}

test('malformed JSON-LD never takes the read down', () => {
  const facts = parseSite(html('jsonld-malformed.html'), 'https://broken.example.com/');
  assert.deepEqual(facts.schemaTypes, ['WebSite']);
});

/* ---------------------------------------------------------------- *
 * The two ways a page could stop the parser.                        *
 * ---------------------------------------------------------------- */

/**
 * The ReDoS shape, generated rather than checked in: three quarters of a
 * megabyte is not a fixture anybody wants in git, and the point of the test is
 * the time, not the bytes.
 *
 * A `<meta` that opens and never closes, filled with the exact attribute the
 * old pattern was hunting for and never the second one. `<meta[^>]+name=...
 * [^>]+content=...` then has two unbounded classes to divide 760 KB between,
 * and tries every division. Bounded tag extraction does not care.
 */
test('a 760 KB body of unclosed meta tags parses in under 200 ms', () => {
  const body = `<html lang="en"><head><title>Slow</title>`
    + `<meta ${'name="robots" '.repeat(55_600)}`
    + `</head><body><p>hello</p></body></html>`;
  const size = Buffer.byteLength(body);
  assert.ok(size >= 760 * 1024 && size < 800_000, `fixture is ${size} bytes`);

  const t0 = performance.now();
  const facts = parseSite(body, 'https://slow.example.com/');
  const ms = performance.now() - t0;

  assert.ok(ms < 200, `parseSite took ${Math.round(ms)}ms`);
  // And it is still a parse, not a bail-out: the well-formed half read fine.
  assert.equal(facts.title, 'Slow');
  assert.equal(facts.lang, 'en');
  // The tag never closed, so it has no content attribute and no robots value.
  assert.equal(facts.robotsMeta, undefined);
  assert.equal(facts.noindex, false);
});

test('a JSON-LD block two hundred thousand arrays deep is capped, not fatal', () => {
  // JSON.parse accepts this without complaint; it was `walk` that overflowed
  // the stack, and it threw outside the per-block try that catches bad JSON.
  const deep = '['.repeat(200_000) + '{"@type":"Buried"}' + ']'.repeat(200_000);
  const body = '<html><head>'
    + `<script type="application/ld+json">${deep}</script>`
    + '<script type="application/ld+json">{"@type":"Restaurant","name":"Zaytoun"}</script>'
    + '</head><body></body></html>';

  const facts = parseSite(body, 'https://deep.example.com/');
  assert.deepEqual(facts.schemaTypes, ['Restaurant'], 'the buried type is past the depth cap');
  assert.equal(facts.hasLocalBusiness, true, 'and the honest block after it is still read');
});

test('the node cap stops a page that offers ten thousand of them', () => {
  const many = JSON.stringify(Array.from({ length: 10_000 }, (_, i) => ({ '@type': `T${i}` })));
  const facts = parseSite(
    `<script type="application/ld+json">${many}</script>`,
    'https://many.example.com/',
  );
  assert.ok(facts.schemaTypes.length <= 2000, `saw ${facts.schemaTypes.length} types`);
  assert.ok(facts.schemaTypes.includes('T0'));
  assert.ok(!facts.schemaTypes.includes('T9999'));
});

/* ---------------------------------------------------------------- *
 * readSite — the I/O half.                                          *
 * ---------------------------------------------------------------- */

type Reply = { status?: number; body?: string; headers?: Record<string, string> };

/** A fetch stub routed by URL, recording every call in order. */
function serve(handler: (url: string, method: string) => Reply | null) {
  const calls: { url: string; method: string }[] = [];
  const fn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ url, method });
    const r = handler(url, method) ?? { status: 404, body: '' };
    return new Response(method === 'HEAD' ? null : (r.body ?? ''), {
      status: r.status ?? 200,
      headers: { 'content-type': 'text/html; charset=utf-8', ...(r.headers ?? {}) },
    });
  };
  return { fn: fn as typeof io.fetch, calls };
}

const page = (body: string): Reply => ({ status: 200, body });

test('a 302 into the cloud metadata service is refused before the second fetch', async () => {
  const s = serve((url) => {
    if (url.startsWith('https://prospect.example.com')) {
      return { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } };
    }
    return page('<html>secrets</html>');
  });
  io.fetch = s.fn;
  const r = await readSite('prospect.example.com');
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, 'blocked');
  assert.equal(s.calls.length, 1, 'the metadata address was never fetched');
});

test('a redirect that drops https for http is refused', async () => {
  const s = serve((url) => (url.startsWith('https://')
    ? { status: 301, headers: { location: 'http://prospect.example.com/' } }
    : page('<html>plain</html>')));
  io.fetch = s.fn;
  const r = await readSite('https://prospect.example.com/');
  assert.equal(r.ok === false && r.reason, 'blocked');
  assert.equal(s.calls.length, 1);
});

test('more than five hops is unreachable', async () => {
  let n = 0;
  const s = serve(() => ({ status: 302, headers: { location: `https://hop${++n}.example.com/` } }));
  io.fetch = s.fn;
  const r = await readSite('https://loop.example.com/');
  assert.equal(r.ok === false && r.reason, 'unreachable');
  assert.equal(s.calls.length, 6, 'the first request plus five hops, and then it stops');
});

test('a video offered as a website is not html', async () => {
  const s = serve(() => ({ status: 200, body: 'binary', headers: { 'content-type': 'video/mp4' } }));
  io.fetch = s.fn;
  const r = await readSite('https://prospect.example.com/');
  assert.equal(r.ok === false && r.reason, 'not-html');
  assert.equal(r.ok === false && r.reason === 'not-html' && r.detail, 'video/mp4');
});

test('a declared length past the ceiling is refused before the body is read', async () => {
  const s = serve(() => ({ status: 200, body: '<html>never read</html>', headers: { 'content-length': '9000000' } }));
  io.fetch = s.fn;
  const r = await readSite('https://prospect.example.com/');
  assert.equal(r.ok === false && r.reason, 'not-html');
  assert.equal(s.calls.length, 1, 'nothing else was fetched');
});

test('a two-megabyte body stops at the cap and still parses', async () => {
  const big = `<html><head><title>Big</title></head><body>${'<p>ما شاء الله</p>'.repeat(100_000)}`
    + '<a href="https://wa.me/962791234567">whatsapp</a></body></html>';
  assert.ok(Buffer.byteLength(big) > 2_000_000);
  const s = serve(() => page(big));
  io.fetch = s.fn;
  const r = await readSite('https://prospect.example.com/', { samples: 1 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.site.truncated, true);
  assert.equal(r.site.bytes, 800 * 1024, 'no content-length, so bytes is what we actually read');
  assert.equal(r.site.title, 'Big', 'the prefix still parses');
  // The link lives past the cap, so the honest answer is that we did not see it.
  assert.equal(r.site.whatsapp, false);
});

test('ms is the median of the two warm samples, never the cold one', async () => {
  // A clock the stub advances, so the numbers are exact rather than nearly.
  let clock = 0;
  const delays = [100, 900, 1100];
  let i = 0;
  io.now = () => clock;
  const s = serve((url, method) => {
    if (method === 'GET' && url === 'https://prospect.example.com/') {
      clock += delays[Math.min(i++, delays.length - 1)];
      return page(html('hreflang-pair.html'));
    }
    return { status: 404 };
  });
  io.fetch = s.fn;
  const r = await readSite('https://prospect.example.com/');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.site.msSamples, [100, 900, 1100]);
  assert.equal(r.site.msCold, 100);
  assert.equal(r.site.ms, 1000);
  assert.equal(r.site.ttfbMs, 1000, 'headers and body land together for a stub');
  assert.equal(r.site.scheme, 'https');
});

test('an https failure falls back to plain http and says so', async () => {
  const s = serve((url, method) => {
    if (url.startsWith('https://')) return null;      // handled by the throw below
    if (method === 'HEAD') return { status: 200 };
    return page(html('http-only.html'));
  });
  const fn: typeof io.fetch = async (input, init) => {
    if (String(input).startsWith('https://')) throw new Error('ECONNREFUSED');
    return s.fn(input, init);
  };
  io.fetch = fn;
  const r = await readSite('hardware.example.com', { samples: 1 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.site.scheme, 'http-only');
  assert.equal(r.site.https, false);
  assert.equal(r.site.finalUrl, 'http://hardware.example.com/');
  assert.equal(r.site.httpRedirectsToHttps, false);
});

test('robots.txt and sitemap.xml are two HEADs, and a 404 is an answer', async () => {
  const s = serve((url, method) => {
    if (url.endsWith('/robots.txt')) return method === 'HEAD' ? { status: 200 } : null;
    if (url.endsWith('/sitemap.xml')) return { status: 404 };
    if (url.startsWith('http://')) return { status: 301, headers: { location: 'https://prospect.example.com/' } };
    return page(html('shopify-pixel.html'));
  });
  io.fetch = s.fn;
  const r = await readSite('https://prospect.example.com/', { samples: 1 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.site.hasRobots, true);
  assert.equal(r.site.hasSitemap, false);
  assert.equal(r.site.httpRedirectsToHttps, true);
  assert.ok(s.calls.some((c) => c.method === 'HEAD' && c.url.endsWith('/robots.txt')));
});

test('a hostname pointed at an internal port is refused before DNS', async () => {
  const s = serve(() => page('<html>redis</html>'));
  io.fetch = s.fn;
  const r = await readSite('https://prospect.example.com:6379/');
  assert.equal(r.ok === false && r.reason, 'blocked');
  assert.equal(s.calls.length, 0);
});

test('a response with no content-type at all is not html', async () => {
  const fn: typeof io.fetch = async () => {
    const res = new Response('<html>who knows</html>', { status: 200 });
    res.headers.delete('content-type');
    return res;
  };
  io.fetch = fn;
  const r = await readSite('https://prospect.example.com/');
  assert.equal(r.ok === false && r.reason, 'not-html');
  assert.equal(r.ok === false && r.reason === 'not-html' && r.detail, 'no content-type');
});

test('the http probe meets the same guard as every other request', async () => {
  // Public while the page is read, private by the time the probe would run:
  // the probe called io.fetch directly and so was the one request in the file
  // that never looked at where it was going.
  let n = 0;
  io.lookup = async () => [{ address: ++n > 1 ? '10.0.0.1' : '93.184.216.34' }];
  const s = serve(() => page(html('hreflang-pair.html')));
  io.fetch = s.fn;
  const r = await readSite('https://prospect.example.com/', { samples: 1 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.site.httpRedirectsToHttps, undefined, 'unasked, not answered false');
  assert.ok(!s.calls.some((c) => c.method === 'HEAD'), 'no HEAD left the process');
});

test('one private answer among several blocks the host', async () => {
  io.lookup = async () => [{ address: '93.184.216.34' }, { address: '169.254.169.254' }];
  const s = serve(() => page('<html>secrets</html>'));
  io.fetch = s.fn;
  const r = await readSite('prospect.example.com');
  assert.equal(r.ok === false && r.reason, 'blocked');
  assert.equal(s.calls.length, 0);
});

test('a host that does not resolve is a prospect without a website, not a threat', async () => {
  io.lookup = async () => { throw new Error('ENOTFOUND'); };
  const s = serve(() => page('<html></html>'));
  io.fetch = s.fn;
  const r = await readSite('nothing.example.com');
  assert.equal(r.ok === false && r.reason, 'no-such-domain');
  assert.equal(s.calls.length, 0, 'DNS is checked before the socket');
});
