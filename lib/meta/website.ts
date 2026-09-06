import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { SITE } from '@/lib/data/company';
import { msisdn } from '@/lib/notify/whatsapp';

/**
 * Reading a prospect's website.
 *
 * The one source besides Instagram we can read cold, with nobody's permission,
 * because it is a public page anyone can open. And for an agency that also runs
 * the advertising it is the richer half: an account tells you what they post, a
 * site tells you whether anything they post can be measured or bought from.
 *
 * Everything here is a fact about markup that is either present or absent. No
 * judgement, no score — the findings layer decides what any of it means, the
 * same separation the Instagram read keeps.
 *
 * The file is in two halves, deliberately. `parseSite` is pure: HTML in, facts
 * out, no clock, no socket, no environment — which is what lets a checked-in
 * fixture pin every claim the sheet makes about a site. `readSite` is the I/O
 * half: DNS, redirects, byte budget, timing. Everything it touches goes through
 * the `io` seam so the unit tests never open a connection.
 *
 * What `ms` is NOT: a page load. It is time-to-HTML for the document alone —
 * no subresources, no JavaScript, no render — measured from outside Jordan. A
 * real LCP number would mean PageSpeed Insights: another external dependency
 * and another API key, deliberately out of scope for a cold read. The copy in
 * findings.ts says "HTML alone" for exactly this reason.
 */

/** The seams. Tests replace these; production never touches them. */
export const io = {
  fetch: (...a: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...a),
  // Every address, not the first one: a host that answers with one public
  // record and one pointing inside is not half safe. See `resolvable`.
  lookup: (hostname: string): Promise<{ address: string }[]> => lookup(hostname, { all: true }),
  now: () => Date.now(),
};

/** Refuse a body bigger than this before reading a byte of it. */
const MAX_CONTENT_LENGTH = 5_000_000;
/** And stop reading a body that never declared its length at this. */
const BODY_CAP = 800 * 1024;
/** A chain longer than this is a loop or a tracker, not a website. */
const MAX_HOPS = 5;
/**
 * One clock for the whole read — every hop, every sample, both HEADs — because
 * a per-hop budget multiplies: five redirects, three samples and two HEADs at
 * twelve seconds each is a request that can hold a serverless invocation for
 * two minutes. A site we cannot finish reading inside twenty seconds is a
 * finding in itself.
 */
const TOTAL_BUDGET_MS = 20_000;
/** The only two ports a website answers on. Anything else is an internal service. */
const PUBLIC_PORTS = new Set(['', '80', '443']);

const HTML_TYPES = ['text/html', 'application/xhtml+xml'];

export type Platform =
  | 'shopify' | 'woocommerce' | 'wix' | 'squarespace'
  | 'salla' | 'zid' | 'wordpress' | 'webflow' | 'custom';

/**
 * Everything the markup says, with nothing about how it was fetched.
 *
 * `parseSite` returns exactly this and nothing else, which is the contract the
 * fixture tests rely on.
 */
export type SiteFacts = {
  https: boolean;
  title?: string;
  description?: string;
  lang?: string;
  /** Arabic anywhere in the visible copy. */
  hasArabic: boolean;
  /** A viewport meta tag. Its absence means the page was never made for a phone. */
  mobileReady: boolean;

  /**
   * Declared language routes, lowercased. Unambiguous in a way `hasArabic` is
   * not: one Arabic word in a footer sets that flag, while a missing `ar`
   * hreflang in Amman is a real gap in how the site is found.
   */
  hreflangs: string[];
  hasArabicRoute: boolean;

  /** Structured data — what a search engine is allowed to show about them. */
  schemaTypes: string[];
  hasLocalBusiness: boolean;
  hasProductOffers: boolean;
  hasOpeningHours: boolean;
  hasPostalAddress: boolean;
  hasAggregateRating: boolean;

  /** Indexability. A live commercial site carrying noindex is the best free finding there is. */
  canonical?: string;
  canonicalMatchesFinalUrl: boolean;
  robotsMeta?: string;
  noindex: boolean;

  /** What is watching. The absence of a pixel is the finding, not its presence. */
  metaPixel: boolean;
  /** The id itself, so an operator can tell a real one from a pasted placeholder. */
  metaPixelId?: string;
  /** fbevents.js loaded and never initialised — a pixel that measures nothing. */
  metaCapiHint: boolean;
  googleAnalytics: boolean;
  gtm: boolean;
  tiktokPixel: boolean;
  snapPixel: boolean;
  googleAdsConversion: boolean;

  /** How somebody buys. */
  whatsapp: boolean;
  /** The number behind the click-to-chat link, in WhatsApp's own format. */
  whatsappNumber?: string;
  telLink: boolean;
  mailto: boolean;
  form: boolean;
  /**
   * A Jordanian number printed in the copy with no tel: link and no wa.me.
   * This is the claim `web-whatsapp` has always made and could never support:
   * "the site gives a number but no way to tap it". No number at all is a
   * different, worse finding, and the copy branches on this flag.
   */
  phoneInText: boolean;

  /** A price, in any of the ways a Jordanian site writes one. */
  showsPrice: boolean;
  /** Social links found, so a teardown knows the rest of their estate. */
  instagram?: string;
  facebook?: string;
  /** Open Graph image — what their link looks like when anyone shares it. */
  ogImage: boolean;

  /**
   * What it was built with. This changes the pitch materially: "your Salla
   * store has no pixel" is a different conversation from "your site has no
   * pixel".
   */
  platform: Platform;
  /** A booking widget, named. */
  booking?: string;
};

export type SiteRead = SiteFacts & {
  url: string;
  finalUrl: string;
  ok: boolean;
  status: number;
  /**
   * Time to the HTML document, in ms: the median of samples two and three.
   * The first request pays for the TCP and TLS handshake and — behind
   * Cloudflare — a cold cache, so it is the worst number we will ever see and
   * is reported separately rather than presented as typical.
   */
  ms: number;
  msSamples: number[];
  msCold: number;
  /** Time to response headers, median of the same two warm samples. */
  ttfbMs: number;
  /** Bytes of HTML we actually read, up to the cap. Never a declared length. */
  bytes: number;
  /** We stopped reading at the cap; the parse saw a prefix of the document. */
  truncated: boolean;
  https: boolean;
  /** `http-only` means https failed outright and plain HTTP answered. */
  scheme: 'https' | 'http-only';
  /** Whether http:// sends a visitor to https://. Undefined when the check failed. */
  httpRedirectsToHttps?: boolean;
  hasRobots: boolean;
  hasSitemap: boolean;
};

export type SiteFailure =
  | { ok: false; reason: 'no-url' }
  | { ok: false; reason: 'blocked' }     // refused for safety, see resolvable()
  | { ok: false; reason: 'no-such-domain' }
  /** Not a web page: wrong content type, or too big to be one. */
  | { ok: false; reason: 'not-html'; detail?: string }
  | { ok: false; reason: 'unreachable'; detail: string };

export type SiteResult = { ok: true; site: SiteRead } | SiteFailure;

/** Accepts what a person types: bare domain, with or without scheme. */
export function normaliseUrl(input: string): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch { return null; }
}

/** Four octets in, private or not out. Anything malformed counts as private. */
function privateV4(p: number[]): boolean {
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;       // this-network, RFC1918, loopback
  if (a === 169 && b === 254) return true;                 // link-local — the metadata service
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;                   // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true;       // carrier-grade NAT
  if (a === 198 && (b === 18 || b === 19)) return true;    // benchmarking
  if (a >= 224) return true;                               // multicast, reserved, broadcast
  return false;
}

/**
 * Eight sixteen-bit groups, or null when the text is not an IPv6 address.
 *
 * Handles the three notations a v6 address actually arrives in: fully written
 * out, compressed with `::`, and mixed with a dotted v4 tail. The v4 tail is
 * folded into two hex groups first so the rest of the function only ever deals
 * in groups.
 */
function expandV6(addr: string): number[] | null {
  let s = addr.toLowerCase();
  const dotted = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
  if (dotted) {
    const q = dotted[1].split('.').map(Number);
    if (q.some((n) => n > 255)) return null;
    s = s.slice(0, s.length - dotted[1].length)
      + ((q[0] << 8) | q[1]).toString(16) + ':' + ((q[2] << 8) | q[3]).toString(16);
  }
  const parts = s.split('::');
  if (parts.length > 2) return null;
  const lead = parts[0] ? parts[0].split(':') : [];
  const trail = parts.length === 2 ? (parts[1] ? parts[1].split(':') : []) : null;
  const groups = trail === null
    ? lead
    : [...lead, ...Array(Math.max(0, 8 - lead.length - trail.length)).fill('0'), ...trail];
  if (groups.length !== 8) return null;
  const out = groups.map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN));
  return out.some(Number.isNaN) ? null : out;
}

/**
 * Is this an address we must refuse to open a socket to?
 *
 * The old test was `address.split('.').length === 4`, and it let
 * `::ffff:169.254.169.254` straight through: four dot-separated pieces, so it
 * took the IPv4 branch, `Number('::ffff:169')` is NaN, every comparison against
 * NaN is false, and the cloud metadata service came back 'ok'. So the first
 * thing this does is ask `net.isIP` which family we are holding, and anything
 * it cannot name is refused rather than guessed at.
 *
 * IPv6 is the whole of the difficulty, because one v4 address can arrive four
 * ways: mapped (`::ffff:169.254.169.254`), mapped in hex (`::ffff:a9fe:a9fe`),
 * translated (`64:ff9b::a9fe:a9fe`) or tunnelled (`2002:a9fe:a9fe::`). We
 * expand to eight groups, decode the v4 hiding inside when there is one, and
 * then allow only global unicast — 2000::/3 less 6to4 — so a range nobody has
 * invented yet is refused by default instead of allowed by omission.
 */
export function privateAddress(addr: string): boolean {
  const bare = (addr ?? '').trim().replace(/^\[|\]$/g, '').split('%')[0];
  const family = isIP(bare);
  if (family === 4) return privateV4(bare.split('.').map(Number));
  if (family !== 6) return true;                 // not an address at all
  const g = expandV6(bare);
  if (!g) return true;
  // ::ffff:a.b.c.d (mapped), ::a.b.c.d (compatible), and `::`/`::1`, which fall
  // out of the same decode as 0.0.0.0 and 0.0.0.1 — both inside 0.0.0.0/8.
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    return privateV4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]);
  }
  if (g[0] === 0x2002) return true;                        // 6to4, 2002::/16
  if (g[0] === 0x0064 && g[1] === 0xff9b) return true;     // NAT64, 64:ff9b::/96
  return (g[0] & 0xe000) !== 0x2000;                       // everything but 2000::/3
}

/**
 * Refuse anything that is not a public host.
 *
 * This endpoint takes a URL from a person and fetches it from inside our own
 * network, which is the exact shape of a server-side request forgery. A
 * prospect's "website" of http://169.254.169.254/ would otherwise hand back
 * cloud credentials. Resolve first, then check every address we might actually
 * connect to — checking the hostname alone is defeated by any DNS record
 * pointing at a private range.
 *
 * What this defends:
 *   · a literal or resolved address in any private, loopback, link-local,
 *     carrier-NAT, multicast or unassigned range, in v4 and in v6, including
 *     the mapped, translated and tunnelled spellings of a v4 address that
 *     `privateAddress` unpicks.
 *   · ALL of a host's addresses, not the first: one public A record beside one
 *     private AAAA record blocks the host outright.
 *   · every hop of a redirect chain is resolved and checked before it is
 *     fetched, and a hop that drops https for http is refused. A public host
 *     that 302s to the metadata service used to be followed without a glance.
 *   · ports other than 80 and 443, so a public hostname cannot be pointed at
 *     an internal service listening on 6379 or 8500.
 *   · the http→https probe, which used to call `io.fetch` directly and so was
 *     the one request in the file that never met this guard at all.
 *   · the chain is capped at five hops; each response is checked for declared
 *     size and for an explicit html content type before a byte of body is read;
 *     and the whole read shares one twenty-second budget.
 *
 * What it does NOT defend, precisely:
 *   · DNS rebinding. `io.lookup()` and `io.fetch()` resolve independently, so a
 *     record with a one-second TTL can answer publicly for the check and
 *     privately for the socket a moment later. Checking every address closes
 *     the multiple-record half of the hole; it does not close the time-of-check
 *     to time-of-use gap, and nothing at this layer can. The named upgrade is a
 *     pinned connector: resolve once, hand undici a `connect` that dials the
 *     address we already vetted and sends the hostname only as the Host header
 *     and the TLS SNI. Until that lands, the exposure is one unauthenticated
 *     GET whose body we parse and never echo back to whoever supplied the URL.
 *   · anything reachable from our egress that is genuinely public-addressed —
 *     a partner API on a routable address is not distinguishable from a website
 *     by IP alone.
 *   · the content of the page. Nothing here is a judgement about what we read,
 *     only about whom we read it from.
 */
async function resolvable(hostname: string): Promise<'ok' | 'blocked' | 'no-such-domain'> {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) return 'blocked';
  // A literal address in the URL never reaches a resolver, so judge it directly.
  if (isIP(host)) return privateAddress(host) ? 'blocked' : 'ok';
  let addresses: { address: string }[];
  try {
    addresses = await io.lookup(host);
  } catch {
    // A domain that does not resolve is not a threat, it is a prospect without
    // a website — and an operator reading "blocked" would go looking for a
    // firewall that is not there.
    return 'no-such-domain';
  }
  if (!addresses?.length) return 'no-such-domain';
  return addresses.some((a) => privateAddress(a.address)) ? 'blocked' : 'ok';
}

const has = (h: string, ...needles: (string | RegExp)[]) =>
  needles.some((n) => (typeof n === 'string' ? h.includes(n) : n.test(h)));

/** Strip script, style and tags so copy can be searched without markup noise. */
const visible = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

/* ------------------------------------------------------------------ *
 * The pure half.                                                      *
 * ------------------------------------------------------------------ */

/**
 * Tags and attributes, read in two bounded steps instead of one unbounded one.
 *
 * `<meta[^>]+name=["']robots["'][^>]+content=["']...["']` is two unbounded
 * classes competing for the same span. Feed it a document that opens a tag and
 * never closes it — trivial to do by accident with a minifier, trivial to do on
 * purpose — and the engine tries every way of splitting the remainder between
 * those two classes. A 760 KB body pins a core for minutes, which on a route
 * anybody can hand a URL to is a denial of service with no packet cost.
 *
 * So: cut the tag out first with ONE class and a hard ceiling, then read its
 * attributes one at a time with anchored alternatives that cannot nest. Both
 * steps are linear in the length of the page, and the ceiling means a tag that
 * is never closed costs 2000 characters rather than the rest of the document.
 */
const TAG_CAP = 2000;

const TAGS = new Map<string, RegExp>();
function tagsNamed(html: string, name: string): string[] {
  let re = TAGS.get(name);
  if (!re) { re = new RegExp(`<${name}\\b[^>]{0,${TAG_CAP}}>`, 'gi'); TAGS.set(name, re); }
  re.lastIndex = 0;
  return [...html.matchAll(re)].map((m) => m[0]);
}

const ATTRS = new Map<string, RegExp>();
/** One attribute of one tag: double-quoted, single-quoted, or bare. */
function attrOf(tag: string, name: string): string | undefined {
  let re = ATTRS.get(name);
  if (!re) {
    re = new RegExp(
      `\\b${name}\\s*=\\s*(?:"([^"]{0,${TAG_CAP}})"|'([^']{0,${TAG_CAP}})'|([^\\s"'>]{1,${TAG_CAP}}))`,
      'i',
    );
    ATTRS.set(name, re);
  }
  const m = re.exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

/** Trim, drop the empty, and hold the field to the length it has always had. */
const clip = (s: string | undefined, n: number): string | undefined => {
  const t = s?.trim();
  return t ? t.slice(0, n) : undefined;
};

/** Every `<link>` tag's attributes, so hreflang and canonical read the same way. */
function links(html: string): { rel: string; href: string; hreflang?: string }[] {
  return tagsNamed(html, 'link').map((tag) => ({
    rel: (attrOf(tag, 'rel') ?? '').trim().toLowerCase(),
    href: attrOf(tag, 'href')?.trim() ?? '',
    hreflang: attrOf(tag, 'hreflang')?.trim().toLowerCase(),
  }));
}

type MetaTag = { name?: string; property?: string; content?: string };

/** Every `<meta>` tag, keyed the two ways the page might have written it. */
function metas(html: string): MetaTag[] {
  return tagsNamed(html, 'meta').map((tag) => ({
    name: attrOf(tag, 'name')?.trim().toLowerCase(),
    property: attrOf(tag, 'property')?.trim().toLowerCase(),
    content: attrOf(tag, 'content'),
  }));
}

/**
 * Schema.org types that are LocalBusiness in everything but the literal string.
 * A dentist marking up `@type: "Dentist"` has done the work; refusing to see it
 * because it is not spelled LocalBusiness would make the finding a lie.
 */
const LOCAL_BUSINESS = new Set([
  'LocalBusiness', 'Restaurant', 'Store', 'Dentist', 'BeautySalon', 'HairSalon',
  'MedicalClinic', 'Hotel', 'CafeOrCoffeeShop', 'ProfessionalService', 'AutoRepair',
  'ClothingStore', 'HealthAndBeautyBusiness', 'FoodEstablishment', 'Bakery',
  'GymOrFitnessCenter', 'SportsActivityLocation', 'RealEstateAgent', 'TravelAgency',
  'Physician', 'Pharmacy', 'NailSalon', 'DaySpa', 'Optician', 'FurnitureStore',
]);

type Node = Record<string, unknown>;

/**
 * A JSON-LD graph describes a business; it is not a data structure.
 *
 * Six levels reaches the address inside the organisation inside the `@graph`
 * with room to spare, and two thousand nodes is more than any real page has.
 * Without the caps a block of two hundred thousand nested arrays — which
 * `JSON.parse` accepts without complaint — recurses until the stack goes, and
 * that throw happens outside the per-block try, so one hostile script tag takes
 * the whole read down.
 */
const LD_MAX_DEPTH = 6;
const LD_MAX_NODES = 2000;

function walk(node: unknown, visit: (o: Node) => void, budget: { left: number }, depth = 0): void {
  if (depth > LD_MAX_DEPTH || budget.left <= 0) return;
  if (Array.isArray(node)) {
    for (const n of node) walk(n, visit, budget, depth + 1);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const o = node as Node;
  budget.left--;
  visit(o);
  for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, visit, budget, depth + 1);
}

const typesOf = (o: Node): string[] => {
  const t = o['@type'];
  if (typeof t === 'string') return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  return [];
};

/**
 * Every JSON-LD block on the page, flattened.
 *
 * Malformed JSON-LD is common — a truncated block, a PHP variable left in a
 * string, a trailing comma — and one bad block must never take the read down,
 * so each parse is caught on its own.
 */
function jsonLd(html: string) {
  const schemaTypes: string[] = [];
  let hasLocalBusiness = false, hasProductOffers = false, hasOpeningHours = false;
  let hasPostalAddress = false, hasAggregateRating = false;

  // One bounded class for the attributes, then a separate test on them: the old
  // `[^>]*type=...[^>]*>` was the same two-unbounded-classes shape as the meta
  // patterns, and just as cheap to hang.
  const blocks = html.matchAll(/<script\b([^>]{0,2000})>([\s\S]*?)<\/script>/gi);
  const budget = { left: LD_MAX_NODES };
  for (const b of blocks) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(b[1])) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(b[2]); } catch { continue; }
    walk(parsed, (o) => {
      const types = typesOf(o);
      for (const t of types) if (!schemaTypes.includes(t)) schemaTypes.push(t);
      if (types.some((t) => LOCAL_BUSINESS.has(t))) hasLocalBusiness = true;
      if (types.includes('Offer') || (types.includes('Product') && 'offers' in o)) hasProductOffers = true;
      if ('openingHours' in o || 'openingHoursSpecification' in o) hasOpeningHours = true;
      if (types.includes('PostalAddress') || 'address' in o) hasPostalAddress = true;
      if (types.includes('AggregateRating') || 'aggregateRating' in o) hasAggregateRating = true;
    }, budget);
  }
  return {
    schemaTypes, hasLocalBusiness, hasProductOffers,
    hasOpeningHours, hasPostalAddress, hasAggregateRating,
  };
}

/** Well-known build markers, most specific first. */
function platformOf(low: string): Platform {
  if (has(low, 'cdn.shopify.com', 'myshopify.com', 'shopify.theme')) return 'shopify';
  if (has(low, 'salla.sa', 'salla.network', 'cdn.salla')) return 'salla';
  if (has(low, 'zid.store', 'zid.sa', 'media.zid')) return 'zid';
  if (has(low, 'woocommerce', 'wp-content/plugins/woocommerce')) return 'woocommerce';
  if (has(low, 'static.wixstatic.com', 'wix.com/website', '_wixcssimports')) return 'wix';
  if (has(low, 'static1.squarespace.com', 'squarespace.com', 'squarespace-cdn')) return 'squarespace';
  if (has(low, 'assets.website-files.com', 'data-wf-page', 'webflow.js', 'assets-global.website-files')) return 'webflow';
  if (has(low, 'wp-content', 'wp-includes', 'wp-json')) return 'wordpress';
  return 'custom';
}

const BOOKING: [string, RegExp][] = [
  ['calendly', /calendly\.com/i],
  ['fresha', /fresha\.com/i],
  ['booksy', /booksy\.com/i],
  ['simplybook', /simplybook\.(me|it|asia)/i],
  ['setmore', /setmore\.com/i],
  ['acuity', /acuityscheduling\.com|squarespacescheduling\.com/i],
  ['zoho-bookings', /bookings\.zoho\.(com|eu|sa)|zohobookings\.com/i],
];

/**
 * A Jordanian mobile number as it is actually printed: 07 9/8/7 and seven more,
 * or the same number with a country code in front of it.
 */
const PHONE_IN_COPY = /(?:\+?962|00962)[\s-]?7[789][\s-]?\d{3}[\s-]?\d{4}|(?:^|[^\d])07[789][\s-]?\d{3}[\s-]?\d{4}(?!\d)/;

/** Compare two URLs the way a search engine does: scheme, host, path, no trailing slash. */
function sameUrl(a: string, b: string): boolean {
  const norm = (u: string) => {
    try {
      const x = new URL(u);
      return `${x.protocol}//${x.host}${x.pathname.replace(/\/+$/, '')}`.toLowerCase();
    } catch { return ''; }
  };
  const na = norm(a);
  return !!na && na === norm(b);
}

/**
 * HTML in, facts out. No clock, no network, no environment — so a checked-in
 * fixture pins every claim the sheet makes about a site.
 */
export function parseSite(html: string, finalUrl: string): SiteFacts {
  const low = html.toLowerCase();
  const copy = visible(html);
  const tags = links(html);
  const metaTags = metas(html);
  const byName = (n: string) => metaTags.find((m) => m.name === n)?.content;

  const hreflangs = tags
    .filter((l) => l.rel.includes('alternate') && l.hreflang)
    .map((l) => l.hreflang as string);

  const canonicalRaw = tags.find((l) => l.rel === 'canonical' && l.href)?.href;
  let canonical: string | undefined;
  if (canonicalRaw) {
    // A canonical is allowed to be relative, and half of them are.
    try { canonical = new URL(canonicalRaw, finalUrl).toString(); } catch { canonical = canonicalRaw; }
  }

  // Attribute order stopped mattering the moment the tag is parsed rather than
  // pattern-matched, so the two mirrored robots patterns collapse into one read.
  const robotsMeta = clip(byName('robots'), 200);

  // `lang` is validated rather than clipped: half a tag is not a language.
  const langRaw = attrOf(tagsNamed(html, 'html')[0] ?? '', 'lang')?.trim();
  const lang = langRaw && /^[a-zA-Z-]{2,8}$/.test(langRaw) ? langRaw : undefined;

  const whatsapp = has(low, 'wa.me/', 'api.whatsapp.com', 'web.whatsapp.com');
  const rawWa = low.match(/wa\.me\/(\d{6,15})/)?.[1]
    ?? low.match(/api\.whatsapp\.com\/send\/?\?phone=(?:%2b)?(\d{6,15})/)?.[1];
  const whatsappNumber = rawWa ? (msisdn(rawWa) ?? undefined) : undefined;

  const telLink = /href=["']tel:/i.test(html);

  const metaPixelId = html.match(/fbq\(\s*['"]init['"]\s*,\s*['"](\d{15,16})['"]/)?.[1];

  return {
    https: finalUrl.startsWith('https://'),
    title: clip(html.match(/<title[^>]{0,2000}>([^<]{0,200})<\/title>/i)?.[1], 200),
    description: clip(byName('description'), 300),
    lang,
    hasArabic: /[؀-ۿ]/.test(copy),
    mobileReady: metaTags.some((m) => m.name === 'viewport'),

    hreflangs,
    hasArabicRoute: hreflangs.some((h) => h.startsWith('ar')),

    ...jsonLd(html),

    canonical,
    canonicalMatchesFinalUrl: !!canonical && sameUrl(canonical, finalUrl),
    robotsMeta,
    noindex: /\bnoindex\b/i.test(robotsMeta ?? ''),

    metaPixel: has(low, 'connect.facebook.net', 'fbq(', 'facebook-jssdk'),
    metaPixelId,
    // The pixel script is on the page and nothing ever initialised it: it
    // loads, it costs the visitor a request, and it measures nothing.
    metaCapiHint: low.includes('fbevents.js') && !/fbq\(\s*['"]init['"]/.test(html),
    googleAnalytics: has(low, 'google-analytics.com', 'gtag(', 'googletagmanager.com/gtag'),
    gtm: low.includes('googletagmanager.com/gtm'),
    tiktokPixel: has(low, 'analytics.tiktok.com', 'ttq.'),
    snapPixel: has(low, 'sc-static.net', 'snaptr('),
    googleAdsConversion: low.includes('googleadservices.com/pagead/conversion'),

    whatsapp,
    whatsappNumber,
    telLink,
    mailto: /href=["']mailto:/i.test(html),
    form: /<form[\s>]/i.test(html),
    phoneInText: !telLink && !whatsapp && PHONE_IN_COPY.test(copy),

    // JOD, دينار, د.أ or a bare price pattern — how prices are actually
    // written on a Jordanian site.
    showsPrice: has(copy, /\b\d{1,5}(\.\d{1,3})?\s?(JOD|jod)\b/, /دينار/, /د\.?أ/, /\bJD\s?\d/),

    instagram: html.match(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})/i)?.[1],
    facebook: html.match(/https?:\/\/(?:www\.)?facebook\.com\/([A-Za-z0-9._-]{1,60})/i)?.[1],
    ogImage: metaTags.some((m) => m.property === 'og:image'),

    platform: platformOf(low),
    booking: BOOKING.find(([, re]) => re.test(html))?.[0],
  };
}

/* ------------------------------------------------------------------ *
 * The I/O half.                                                       *
 * ------------------------------------------------------------------ */

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

type Fetched = { ok: true; res: Response; finalUrl: string; headersMs: number };
/**
 * `transport` separates "the connection did not happen" from "the answer was
 * refused". Only the first is worth retrying over plain HTTP: a redirect loop
 * or a blocked hop retried without TLS is the same bad answer, twice.
 */
type Refused = { ok: false; fail: SiteFailure; transport: boolean };
const refuse = (fail: SiteFailure, transport = false): Refused => ({ ok: false, fail, transport });

const HEADERS = {
  // Say who we are. A studio reading a prospect's public page should be
  // identifiable in their logs rather than pretending to be a browser — and
  // the address we leave there has to be one that actually resolves, so it
  // moves with SITE rather than naming a domain we do not own yet.
  'user-agent': `PRAVDA-Teardown/1.0 (+${SITE}; reads public pages)`,
  accept: 'text/html,application/xhtml+xml',
};

/**
 * The check every single request in this file goes through, hop or probe.
 *
 * Pulled out of `guarded` because the http→https probe did not use `guarded`
 * and so met no guard at all: it built a URL from the final origin and handed
 * it straight to `io.fetch`. Same host, but a redirect chain can move the
 * origin, and "we already checked something like this" is not a check.
 */
async function hopOk(current: string): Promise<URL | Refused> {
  let u: URL;
  try { u = new URL(current); } catch { return refuse({ ok: false, reason: 'unreachable', detail: 'bad url' }); }
  if (!/^https?:$/.test(u.protocol)) return refuse({ ok: false, reason: 'blocked' });
  // A website answers on 80 or 443. A hostname pointed at 6379 is a request to
  // send a public GET at somebody's Redis.
  if (!PUBLIC_PORTS.has(u.port)) return refuse({ ok: false, reason: 'blocked' });
  const dns = await resolvable(u.hostname);
  if (dns !== 'ok') return refuse({ ok: false, reason: dns });
  return u;
}

/**
 * Fetch, following redirects by hand so the SSRF guard sees every hop.
 *
 * `redirect: 'follow'` handed the whole chain to undici, which resolves and
 * connects without asking us anything — so the guard below protected the first
 * URL and nothing after it.
 *
 * `signal` is the one budget for the whole read, passed in rather than made
 * here: a fresh timeout per hop meant the ceiling was hops × samples × budget,
 * which is not a ceiling.
 */
async function guarded(
  start: string, method: 'GET' | 'HEAD', signal: AbortSignal,
): Promise<Fetched | Refused> {
  const t0 = io.now();
  let current = start;

  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const checked = await hopOk(current);
    if (!(checked instanceof URL)) return checked;
    const u = checked;

    let res: Response;
    try {
      res = await io.fetch(current, {
        redirect: 'manual',
        method,
        signal,
        headers: HEADERS,
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'unknown';
      return refuse({ ok: false, reason: 'unreachable', detail }, true);
    }

    const location = REDIRECTS.has(res.status) ? res.headers.get('location') : null;
    if (!location) return { ok: true, res, finalUrl: current, headersMs: io.now() - t0 };

    let next: URL;
    try { next = new URL(location, current); } catch { return refuse({ ok: false, reason: 'unreachable', detail: 'bad redirect' }); }
    // Downgrading a secure hop to a plain one is how a redirect chain gets a
    // request out of TLS and onto a network somebody else is reading.
    if (u.protocol === 'https:' && next.protocol === 'http:') return refuse({ ok: false, reason: 'blocked' });
    // Cancel the body we are not going to read.
    await res.body?.cancel().catch(() => {});
    current = next.toString();
  }
  return refuse({ ok: false, reason: 'unreachable', detail: `more than ${MAX_HOPS} redirects` });
}

/**
 * Read a body with a counter and a stop.
 *
 * `(await res.text()).slice(0, 800_000)` buffered the entire document before
 * slicing, so the cap protected the parser and not the process — a 300MB video
 * offered as a "website" was fully downloaded first.
 */
async function readBody(res: Response, cap: number) {
  const body = res.body as ReadableStream<Uint8Array> | null;
  if (!body || typeof body.getReader !== 'function') {
    // A stub or a runtime without a stream. Still honour the cap.
    const text = await res.text().catch(() => '');
    const buf = Buffer.from(text, 'utf8');
    return buf.byteLength > cap
      ? { html: buf.subarray(0, cap).toString('utf8'), read: cap, truncated: true }
      : { html: text, read: buf.byteLength, truncated: false };
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let read = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    read += value.byteLength;
    if (read >= cap) {
      chunks.push(value.subarray(0, value.byteLength - (read - cap)));
      read = cap;
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
  }
  return { html: Buffer.concat(chunks).toString('utf8'), read, truncated };
}

/** Median of two numbers is their mean; kept as a function so the intent reads. */
const mid2 = (a: number, b: number) => Math.round((a + b) / 2);

/** One timed sample of a URL we have already validated. Failures are dropped. */
async function sample(url: string, signal: AbortSignal) {
  const t0 = io.now();
  const got = await guarded(url, 'GET', signal);
  if (!got.ok) return null;
  const headersMs = io.now() - t0;
  await readBody(got.res, BODY_CAP);
  return { ms: io.now() - t0, headersMs };
}

/** A HEAD that answers a yes/no question and never throws. */
async function exists(url: string, signal: AbortSignal): Promise<boolean> {
  const got = await guarded(url, 'HEAD', signal);
  if (!got.ok) return false;
  await got.res.body?.cancel().catch(() => {});
  return got.res.status < 400;
}

export async function readSite(
  input: string,
  opts: { budgetMs?: number; maxBytes?: number; samples?: number } = {},
): Promise<SiteResult> {
  const cap = opts.maxBytes ?? BODY_CAP;
  const wantSamples = opts.samples ?? 3;
  // One signal for every request below — hops, samples, both HEADs, the http
  // probe. `budgetMs` is now the total for the read, not the allowance per hop.
  const signal = AbortSignal.timeout(opts.budgetMs ?? TOTAL_BUDGET_MS);

  const url = normaliseUrl(input);
  if (!url) return { ok: false, reason: 'no-url' };

  const t0 = io.now();
  let scheme: SiteRead['scheme'] = 'https';
  let got = await guarded(url, 'GET', signal);

  // `normaliseUrl` puts https:// on a bare domain, so a site that only speaks
  // HTTP used to read as `unreachable` and the teardown said they had no
  // website. They have one; it is just insecure, which is the finding.
  if (!got.ok && got.transport && url.startsWith('https://')) {
    const plain = url.replace(/^https:/, 'http:');
    const retryGot = await guarded(plain, 'GET', signal);
    if (retryGot.ok) { got = retryGot; scheme = 'http-only'; }
  }
  if (!got.ok) return got.fail;

  const { res, finalUrl } = got;
  const coldHeadersMs = io.now() - t0;

  // Refuse before a byte of body: a declared length past the ceiling, or a
  // content type that is not a web page at all.
  const declared = Number(res.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > MAX_CONTENT_LENGTH) {
    await res.body?.cancel().catch(() => {});
    return { ok: false, reason: 'not-html', detail: `content-length ${declared}` };
  }
  // An explicit html content type, or it is not a web page. A missing
  // content-type used to be read as permission to parse whatever came back,
  // which is exactly what an internal service answering a GET does not send.
  const ctype = (res.headers.get('content-type') ?? '').toLowerCase();
  if (!HTML_TYPES.some((t) => ctype.includes(t))) {
    await res.body?.cancel().catch(() => {});
    return { ok: false, reason: 'not-html', detail: ctype ? ctype.split(';')[0] : 'no content-type' };
  }

  const { html, read, truncated } = await readBody(res, cap);
  const msCold = io.now() - t0;

  // Two more reads of the final URL. The first paid for the handshake and, at
  // anything behind Cloudflare, a cold cache; reporting it as the site's speed
  // is the difference between a fact and an accusation.
  const msSamples = [msCold];
  const ttfbSamples = [coldHeadersMs];
  for (let i = 1; i < wantSamples; i++) {
    const s = await sample(finalUrl, signal);
    if (!s) break;
    msSamples.push(s.ms);
    ttfbSamples.push(s.headersMs);
  }
  const warm = msSamples.slice(1);
  const warmTtfb = ttfbSamples.slice(1);
  const ms = warm.length >= 2 ? mid2(warm[0], warm[1]) : (warm[0] ?? msCold);
  const ttfbMs = warmTtfb.length >= 2 ? mid2(warmTtfb[0], warmTtfb[1]) : (warmTtfb[0] ?? coldHeadersMs);

  // Does plain HTTP send a visitor to HTTPS? One HEAD, and an unanswered
  // question stays undefined rather than becoming a false.
  const origin = (() => { try { return new URL(finalUrl).origin; } catch { return finalUrl; } })();
  const probe = `${origin.replace(/^https:/, 'http:')}/`;
  let httpRedirectsToHttps: boolean | undefined;
  // The probe cannot go through `guarded`, which follows the chain; it has to
  // see the FIRST hop's Location header. So it does the guard's check by hand
  // and then makes exactly one unfollowed request.
  if ((await hopOk(probe)) instanceof URL) {
    try {
      const head = await io.fetch(probe, {
        method: 'HEAD', redirect: 'manual', signal, headers: HEADERS,
      });
      const loc = REDIRECTS.has(head.status) ? head.headers.get('location') : null;
      httpRedirectsToHttps = !!loc && new URL(loc, probe).protocol === 'https:';
      await head.body?.cancel().catch(() => {});
    } catch { httpRedirectsToHttps = undefined; }
  }

  const [hasRobots, hasSitemap] = await Promise.all([
    exists(`${origin}/robots.txt`, signal),
    exists(`${origin}/sitemap.xml`, signal),
  ]);

  return {
    ok: true,
    site: {
      ...parseSite(html, finalUrl),
      url,
      finalUrl,
      ok: res.ok,
      status: res.status,
      ms, msSamples, msCold, ttfbMs,
      // What we actually read, never what the header claimed. A server is free
      // to declare any content-length it likes, and a finding that says "your
      // homepage is 4 MB" has to be a fact we measured rather than a number the
      // site handed us. `truncated` is the flag that says the document is
      // larger than this; `bytes` no longer quietly pretends to know by how much.
      bytes: read,
      truncated,
      scheme,
      httpRedirectsToHttps,
      hasRobots, hasSitemap,
    },
  };
}
