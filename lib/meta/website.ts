import { lookup } from 'node:dns/promises';

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
 */

export type SiteRead = {
  url: string;
  finalUrl: string;
  ok: boolean;
  status: number;
  /** Time to first byte plus body, in ms. A real number a slow site cannot hide. */
  ms: number;
  bytes: number;
  https: boolean;
  title?: string;
  description?: string;
  lang?: string;
  /** Arabic anywhere in the visible copy. */
  hasArabic: boolean;
  /** A viewport meta tag. Its absence means the page was never made for a phone. */
  mobileReady: boolean;
  /** What is watching. The absence of a pixel is the finding, not its presence. */
  metaPixel: boolean;
  googleAnalytics: boolean;
  gtm: boolean;
  tiktokPixel: boolean;
  /** How somebody buys. */
  whatsapp: boolean;
  telLink: boolean;
  mailto: boolean;
  form: boolean;
  /** A price, in any of the ways a Jordanian site writes one. */
  showsPrice: boolean;
  /** Social links found, so a teardown knows the rest of their estate. */
  instagram?: string;
  facebook?: string;
  /** Open Graph image — what their link looks like when anyone shares it. */
  ogImage: boolean;
};

export type SiteFailure =
  | { ok: false; reason: 'no-url' }
  | { ok: false; reason: 'blocked' }     // refused for safety, see resolvable()
  | { ok: false; reason: 'no-such-domain' }
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

/**
 * Refuse anything that is not a public host.
 *
 * This endpoint takes a URL from a person and fetches it from inside our own
 * network, which is the exact shape of a server-side request forgery. A
 * prospect's "website" of http://169.254.169.254/ would otherwise hand back
 * cloud credentials. Resolve first, then check the address we would actually
 * connect to — checking the hostname alone is defeated by any DNS record
 * pointing at a private range.
 */
async function resolvable(hostname: string): Promise<'ok' | 'blocked' | 'no-such-domain'> {
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(hostname)) return 'blocked';
  let address: string;
  try {
    ({ address } = await lookup(hostname));
  } catch {
    // A domain that does not resolve is not a threat, it is a prospect without
    // a website — and an operator reading "blocked" would go looking for a
    // firewall that is not there.
    return 'no-such-domain';
  }
  {
    const p = address.split('.').map(Number);
    if (p.length === 4) {
      if (p[0] === 10 || p[0] === 127 || p[0] === 0) return 'blocked';
      if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return 'blocked';
      if (p[0] === 192 && p[1] === 168) return 'blocked';
      if (p[0] === 169 && p[1] === 254) return 'blocked';   // cloud metadata
      if (p[0] >= 224) return 'blocked';                     // multicast and up
      return 'ok';
    }
    // IPv6: loopback, link-local, and unique-local are all off limits.
    const a = address.toLowerCase();
    return (a === '::1' || a.startsWith('fe80') || a.startsWith('fc') || a.startsWith('fd'))
      ? 'blocked' : 'ok';
  }
}

const has = (h: string, ...needles: (string | RegExp)[]) =>
  needles.some((n) => (typeof n === 'string' ? h.includes(n) : n.test(h)));

/** Strip script, style and tags so copy can be searched without markup noise. */
const visible = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

const meta = (html: string, re: RegExp) => html.match(re)?.[1]?.trim();

export async function readSite(input: string, budgetMs = 12_000): Promise<SiteResult> {
  const url = normaliseUrl(input);
  if (!url) return { ok: false, reason: 'no-url' };
  const target = new URL(url);
  const dns = await resolvable(target.hostname);
  if (dns !== 'ok') return { ok: false, reason: dns };

  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(budgetMs),
      headers: {
        // Say who we are. A studio reading a prospect's public page should be
        // identifiable in their logs rather than pretending to be a browser.
        'user-agent': 'PRAVDA-Teardown/1.0 (+https://pravda.jo; reads public pages)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    const html = (await res.text()).slice(0, 800_000);
    const ms = Date.now() - started;
    const low = html.toLowerCase();
    const copy = visible(html);

    // A redirect to https counts as https; what a visitor typed does not.
    const finalUrl = res.url || url;

    return {
      ok: true,
      site: {
        url, finalUrl, ok: res.ok, status: res.status, ms,
        bytes: Buffer.byteLength(html),
        https: finalUrl.startsWith('https://'),
        title: meta(html, /<title[^>]*>([^<]{1,200})<\/title>/i),
        description: meta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i),
        lang: meta(html, /<html[^>]+lang=["']([a-zA-Z-]{2,8})["']/i),
        hasArabic: /[؀-ۿ]/.test(copy),
        mobileReady: /<meta[^>]+name=["']viewport["']/i.test(html),

        metaPixel: has(low, 'connect.facebook.net', 'fbq(', 'facebook-jssdk'),
        googleAnalytics: has(low, 'google-analytics.com', 'gtag(', 'googletagmanager.com/gtag'),
        gtm: low.includes('googletagmanager.com/gtm'),
        tiktokPixel: has(low, 'analytics.tiktok.com', 'ttq.'),

        whatsapp: has(low, 'wa.me/', 'api.whatsapp.com', 'web.whatsapp.com'),
        telLink: /href=["']tel:/i.test(html),
        mailto: /href=["']mailto:/i.test(html),
        form: /<form[\s>]/i.test(html),

        // JOD, دينار, د.أ or a bare price pattern — how prices are actually
        // written on a Jordanian site.
        showsPrice: has(copy, /\b\d{1,5}(\.\d{1,3})?\s?(JOD|jod)\b/, /دينار/, /د\.?أ/, /\bJD\s?\d/),

        instagram: html.match(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})/i)?.[1],
        facebook: html.match(/https?:\/\/(?:www\.)?facebook\.com\/([A-Za-z0-9._-]{1,60})/i)?.[1],
        ogImage: /<meta[^>]+property=["']og:image["']/i.test(html),
      },
    };
  } catch (e) {
    return {
      ok: false, reason: 'unreachable',
      detail: e instanceof Error ? e.message : 'unknown',
    };
  }
}
