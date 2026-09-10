'use client';

import { useEffect, useRef, useState } from 'react';
import { SITE } from '@/lib/data/company';
import { useRouter } from 'next/navigation';
import type { Sheet } from '@/lib/store/sheets';
import type { Talent } from '@/lib/data/deals';
import type { Recommendation, CastPick } from '@/lib/teardown/recommend';
import { VERTICAL_LABEL, type Vertical } from '@/lib/data/concepts';
import { explain, OFFLINE } from '@/lib/ops/errors';
import { reauthAction, useToast } from '@/components/ops/Toast';
import CastPicker from '@/components/ops/CastPicker';
import SendByHand from '@/components/ops/SendByHand';

/**
 * The sheet Khaled approves.
 *
 * The plan calls the console a throttle rather than a dashboard: it should turn
 * a pile of decisions into a few. So this page asks him for exactly four things
 * — what the business is, which three ideas, who is on them, and what the offer
 * is — and shows everything else as read-only evidence he can lean on when the
 * client asks "why this one".
 *
 * Sending is not one of the four. Approving mints the address and stops; the
 * bar then hands over the message, a link that opens WhatsApp with it ready,
 * and a separate press that records it went. A console that marks a sheet sent
 * because a link was opened is a console that quietly stops chasing.
 */

const n1 = (x: number) => (Math.round(x * 10) / 10).toString();
const hour = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;
const hhmm = (d: Date) => d.toTimeString().slice(0, 5);
const VERTICALS = Object.keys(VERTICAL_LABEL) as Vertical[];

const SEV = {
  critical: { label: 'Costing them money', color: 'var(--warn)' },
  notable: { label: 'Worth fixing', color: '#C9A227' },
  good: { label: 'Working', color: 'var(--go)' },
} as const;

const WEB_STATE: Record<string, string> = {
  'no-url': 'no website given',
  unreadable: 'their site refused us',
  'error-page': 'their site returned an error page',
  read: 'their site was read',
};

const since = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

/** Relative bars. Values are already multiples, so the widest is the leader. */
function Bars({ series }: { series: { label: { en: string }; value: number; caption?: string; hi?: boolean }[] }) {
  const max = Math.max(...series.map((s) => s.value), 1);
  return (
    <div className="chart">
      {series.map((s, i) => (
        <div className="bar-row" key={i}>
          <span className="bar-lab">{s.label.en}</span>
          <span className="bar-track">
            <span className="bar-fill" data-hi={!!s.hi}
                  style={{ width: `${Math.max(3, (s.value / max) * 100)}%` }} />
          </span>
          <span className="bar-val mono">{n1(s.value)}×</span>
          <span className="bar-cap mono">{s.caption}</span>
        </div>
      ))}
    </div>
  );
}

/** Twenty-four columns. The two windows are the whole point of the chart. */
function Hours({ byHour, peak, best }: { byHour: number[]; peak: [number, number]; best?: [number, number] }) {
  const max = Math.max(...byHour, 1);
  const inWin = (h: number, w?: [number, number]) =>
    !!w && (w[0] <= w[1] ? h >= w[0] && h < w[1] : h >= w[0] || h < w[1]);
  return (
    <div className="hours">
      {byHour.map((v, h) => (
        <span className="hcol" key={h}
              data-peak={inWin(h, peak)} data-best={inWin(h, best)}
              aria-label={`${hour(h)} — ${v} post${v === 1 ? '' : 's'}`}>
          <span className="hbar" style={{ height: `${(v / max) * 100}%` }} />
          {h % 6 === 0 && <span className="htick mono">{hour(h)}</span>}
        </span>
      ))}
    </div>
  );
}

export default function SheetReview({ sheet, roster }: { sheet: Sheet; roster: Talent[] }) {
  const [recs, setRecs] = useState<Recommendation[]>(sheet.recommendations);
  const [chosen, setChosen] = useState<number[]>(sheet.chosen ?? []);
  const [vertical, setVertical] = useState<Vertical | ''>(sheet.vertical ?? '');
  // "The list came up short", not "there was nothing to go on". Only the
  // classifier can say this; a lexicon guess is absent for want of matching
  // words and never carries the flag.
  const outsideTaxonomy = sheet.verticalGuess
    && 'outsideTaxonomy' in sheet.verticalGuess
    && sheet.verticalGuess.outsideTaxonomy === true;
  const [overrides, setOverrides] = useState<Record<string, CastPick[]>>(sheet.castOverrides ?? {});
  // The Arabic copy lives in state, never read back off the `sheet` prop: the
  // prop is a snapshot from render time, and posting a field straight from it
  // is exactly what let a name save carry a stale, empty hook and vice versa.
  const [copy, setCopy] = useState<Record<string, { name?: string; hook?: string }>>(sheet.copy ?? {});
  const [offer, setOffer] = useState(sheet.offer ?? {
    videos: 6, pricePerVideo: 150, ads: true, adsMonthlyJOD: 400, totalJOD: 900,
  });
  const [offerSavedAt, setOfferSavedAt] = useState<string | null>(null);
  const offerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every save this component starts. A response is only trusted if
  // it is still the newest one in flight when it comes back — otherwise a slow
  // early save could resolve after a later one and show a stale "saved" time.
  const offerSeq = useRef(0);
  const [status, setStatus] = useState(sheet.status);
  const [share, setShare] = useState(sheet.shareToken);
  const [sentAt, setSentAt] = useState(sheet.sentAt);
  // Relative times are written after mount. Computed during render they read
  // the clock twice — once on the server, once on the client — and a minute
  // boundary between the two is a hydration mismatch on the busiest page.
  const [openedSince, setOpenedSince] = useState('');
  useEffect(() => {
    const at = sheet.lastOpenedAt ?? sheet.openedAt;
    setOpenedSince(at ? since(at) : '');
  }, [sheet.lastOpenedAt, sheet.openedAt]);
  const [dealId, setDealId] = useState(sheet.dealId);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  // Mirrors the route's `approved-locked` refusal: a sheet with a live share
  // link is read-only here until it is reopened, so nothing changes under a
  // client who may be reading it right now.
  const locked = status === 'approved';
  const router = useRouter();

  const s = sheet.signals;
  const findingById = new Map(sheet.findings.findings.map((f) => [f.id, f]));

  const post = async (
    body: Record<string, unknown>, ok?: string, opts?: { rollback?: () => void },
  ) => {
    setBusy(true);
    try {
      const res = await fetch('/api/ops/sheet', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: sheet.token, ...body }),
      });
      const j = await res.json();
      if (!res.ok) {
        opts?.rollback?.();
        push({
          kind: 'err', text: explain(j.error, j),
          action: j.error === 'unauthenticated' ? reauthAction() : { label: 'Retry', onClick: () => post(body, ok, opts) },
        });
        return null;
      }
      if (ok) push({ kind: 'ok', text: ok });
      return j;
    } catch {
      opts?.rollback?.();
      push({ kind: 'err', text: OFFLINE, action: { label: 'Retry', onClick: () => post(body, ok, opts) } });
      return null;
    }
    finally { setBusy(false); }
  };

  const toggle = (n: number) => {
    const prev = chosen;
    const next = chosen.includes(n) ? chosen.filter((x) => x !== n)
      : chosen.length >= 3 ? chosen : [...chosen, n];
    if (next === prev) return;
    setChosen(next);
    post({ action: 'choose', chosen: next }, undefined, { rollback: () => setChosen(prev) });
  };

  const saveCopy = (n: number, patch: Partial<{ name: string; hook: string }>) => {
    const key = String(n);
    const next = { ...copy, [key]: { ...copy[key], ...patch } };
    setCopy(next);
    return next[key];
  };

  const postCopy = (n: number) => {
    const key = String(n);
    const c = copy[key] ?? {};
    post({ action: 'copy', conceptN: n, name: c.name ?? '', hook: c.hook ?? '' });
  };

  // Fires on blur and, in case a click elsewhere never blurs the field, 600ms
  // after the last keystroke. `offerSeq` lets a stale response lose to a
  // newer one instead of overwriting the "saved" marker backwards in time.
  const commitOffer = async (next: typeof offer) => {
    const seq = ++offerSeq.current;
    const j = await post({ action: 'offer', ...next });
    if (j && seq === offerSeq.current) setOfferSavedAt(hhmm(new Date()));
  };

  const saveOffer = (patch: Partial<typeof offer>) => {
    const next = { ...offer, ...patch };
    next.totalJOD = next.videos * next.pricePerVideo;
    setOffer(next);
    setOfferSavedAt(null);
    if (offerTimer.current) clearTimeout(offerTimer.current);
    offerTimer.current = setTimeout(() => commitOffer(next), 600);
  };

  const flushOffer = () => {
    if (offerTimer.current) { clearTimeout(offerTimer.current); offerTimer.current = null; }
    commitOffer(offer);
  };

  /** Saying what the business is re-ranks the library. No Meta call. */
  const setTrade = async (v: Vertical | '') => {
    setVertical(v);
    const j = await post({ action: 'vertical', vertical: v || null },
      v ? `Re-ranked for ${VERTICAL_LABEL[v].en.toLowerCase()}.` : 'Back to no trade bonus.');
    if (j?.recommendations) { setRecs(j.recommendations); setChosen(j.chosen ?? []); }
  };

  /**
   * Who is actually on an idea: the override when there is one, the engine's
   * own cast otherwise. The same rule `effectiveCast` applies on the server,
   * written out here because that function lives beside firebase-admin and
   * this component runs in a browser.
   */
  const castOf = (n: number): CastPick[] => {
    const ov = overrides[String(n)];
    if (ov && ov.length) return ov;
    return recs.find((r) => r.conceptN === n)?.cast ?? [];
  };

  const setCast = async (n: number, talentIds: string[]) => {
    const j = await post({ action: 'cast', conceptN: n, talentIds },
      talentIds.length ? 'Cast saved.' : 'Back to the engine’s cast.');
    if (j) setOverrides({ ...overrides, [String(n)]: j.cast ?? [] });
  };

  const shareUrl = share
    // SITE rather than window.location.origin: the server renders '' for the
    // origin and the browser the real one, and that single differing text node
    // was a hydration error on every approved sheet.
    ? `${SITE}/s/${share}`
    : '';

  const p = sheet.profile;

  return (
    <div className="cols">
      <div>
        {/* ── what it is ── */}
        <section className="blk">
          <h2>What this business is</h2>
          <p className="hint">
            The recommender scores a trade bonus off this. Left unsaid, it scores
            without one and the shortlist reads generic — which is the one thing
            a shortlist may not be.
          </p>
          <div className="row">
            <select className="sel" value={vertical} disabled={busy || locked}
                    aria-label="What kind of business this is"
                    onChange={(e) => setTrade(e.target.value as Vertical | '')}>
              <option value="">— nobody has said —</option>
              {VERTICALS.map((v) => (
                <option key={v} value={v}>{VERTICAL_LABEL[v].en}</option>
              ))}
            </select>
          </div>
          {/*
            What the read understood, in a sentence, before the trade label.
            It is deliberately above the guess: on an account the nine trades do
            not cover there IS no guess, and this is the whole of what the
            engine has to say. Operator-only — `/s` never renders it, because a
            sentence about what a business is, is a judgement rather than a
            number computed from its posts.
          */}
          {sheet.businessSummary && (
            <p className="hint" style={{ marginTop: 8 }}>
              Read as: <b dir="auto">{sheet.businessSummary.en}</b>
            </p>
          )}
          {sheet.verticalGuess?.guess ? (
            <p className="hint" style={{ marginTop: 8 }}>
              The engine read it as <b>{VERTICAL_LABEL[sheet.verticalGuess.guess].en}</b> at{' '}
              {Math.round(sheet.verticalGuess.confidence * 100)}% confidence
              {sheet.verticalGuess.evidence?.length > 0 && (
                <> — on <span className="mono" dir="auto">
                  {sheet.verticalGuess.evidence.slice(0, 5).map((e) => e.term).join(', ')}
                </span></>
              )}.
            </p>
          ) : outsideTaxonomy ? (
            /*
              The case this whole panel was rebuilt for. The engine understood
              the business and is telling you the LIST is what came up short —
              which is a different instruction from "no guess": do not reach for
              the nearest label, because the nearest label is how a loyalty-card
              platform got offered a dermatology explainer.
            */
            <p className="hint" style={{ marginTop: 8 }}>
              <b>None of the nine trades fit this business.</b> Leaving it unsaid
              scores no trade bonus, which is honest. Picking the closest one
              will put the wrong films on the shortlist — check them against the
              sentence above before you send anything.
            </p>
          ) : null}
        </section>

        {/* ── the account, as they wrote it ── */}
        {p && (
          <section className="blk">
            <h2>Their account</h2>
            <p className="hint">
              Verbatim, as Meta returned it. Read the bio before the numbers —
              it is the only place the business says what it thinks it is.
            </p>
            {p.biography && (
              <p className="bio" dir="auto">{p.biography}</p>
            )}
            <div className="figs">
              <div><b className="mono">{p.followers.toLocaleString('en-US')}</b><span>followers</span></div>
              {p.follows !== undefined && (
                <div><b className="mono">{p.follows.toLocaleString('en-US')}</b><span>following</span></div>
              )}
              <div>
                <b className="mono">{s.posts}</b>
                <span>read of {p.mediaCount.toLocaleString('en-US')} posts</span>
              </div>
            </div>
            {p.bioLink && (
              <p className="hint" style={{ marginTop: 10 }}>
                Bio link: <a className="mono" href={p.bioLink} target="_blank" rel="noreferrer">{p.bioLink}</a>
              </p>
            )}
          </section>
        )}

        {/* ── the evidence, read only ── */}
        <section className="blk">
          <h2>What we read</h2>
          <p className="hint">
            Every figure computed before anything was written. Nothing here is editable —
            it is what you lean on when they ask why.
          </p>
          <div className="figs">
            <div><b className="mono">{s.followers.toLocaleString('en-US')}</b><span>followers</span></div>
            <div><b className="mono">{s.posts}</b><span>posts read</span></div>
            <div><b className="mono">{n1(s.engagementRate)}%</b><span>engagement</span></div>
            <div><b className="mono">{n1(s.postsPerWeek)}</b><span>posts / week</span></div>
            <div><b className="mono">{Math.round(s.medianEngagement)}</b><span>median reactions</span></div>
            {sheet.site
              ? <div><b className="mono">{sheet.site.metaPixel ? 'yes' : 'no'}</b><span>pixel on site</span></div>
              : <div><b className="mono">—</b><span>{sheet.webState ? WEB_STATE[sheet.webState.state] ?? sheet.webState.state : 'no site read'}</span></div>}
          </div>
        </section>

        {/* ── what only an operator reads ── */}
        {sheet.findings.operatorNotes?.length > 0 && (
          <section className="blk">
            <h2>What the read could not do</h2>
            <p className="hint">
              For you, never for them. `/s` renders none of this.
            </p>
            {sheet.findings.operatorNotes.map((n) => (
              <p key={n.id} className="prov mono" style={{ marginBottom: 6 }}>{n.en}</p>
            ))}
          </section>
        )}

        {sheet.findings.charts.map((c) => (
          <section className="blk" key={c.id}>
            <h2>{c.title.en}</h2>
            {c.note && <p className="hint">{c.note.en}</p>}
            {c.kind === 'bars'
              ? <Bars series={c.series} />
              : <Hours byHour={c.byHour} peak={c.peak} best={c.best} />}
            {c.kind === 'hours' && (
              <p className="hint" style={{ marginTop: 10 }}>
                <span className="key-peak" /> when they post ·{' '}
                <span className="key-best" /> when their posts do best
              </p>
            )}
          </section>
        ))}

        <section className="blk">
          <h2>Findings</h2>
          {sheet.findings.findings.map((f) => (
            <div className="find" key={f.id} data-s={f.severity}>
              <div className="find-head">
                {f.figure && <b className="find-fig mono">{f.figure.en}</b>}
                <span className="find-t">{f.title.en}</span>
                <span className="sp" />
                <span className="pill" style={{ color: SEV[f.severity].color, borderColor: SEV[f.severity].color }}>
                  {SEV[f.severity].label}
                </span>
              </div>
              <p className="hint" style={{ margin: '0 0 4px' }}>{f.detail.en}</p>
              <p className="prov mono">{f.provenance.en}</p>
            </div>
          ))}
        </section>

        {/* ── the one real decision ── */}
        <section className="blk">
          <h2>Choose three <span className="mono" style={{ color: 'var(--brass)' }}>{chosen.length}/3</span></h2>
          {locked && (
            <p className="hint" dir="auto">
              Approved and live. Reopen it to change the ideas, the copy, the cast or the offer —
              the link goes dead while you do, so the client never reads a page mid-edit.
            </p>
          )}
          <p className="hint">
            Five were selected from the library against the findings above — never invented.
            Pick the three this client sees.
          </p>
          {recs.map((r) => {
            const on = chosen.includes(r.conceptN);
            const full = chosen.length >= 3 && !on;
            const cast = castOf(r.conceptN);
            const isOverride = (overrides[String(r.conceptN)]?.length ?? 0) > 0;
            return (
              <div className="rec" key={r.conceptN} data-on={on} data-full={full}>
                <div className="rec-head">
                  <button type="button" className="rec-pick" disabled={busy || full || locked}
                          aria-pressed={on} onClick={() => toggle(r.conceptN)}>
                    {on ? '✓' : '+'}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b className="rec-name" dir="auto">{r.name}</b>
                    <span className="rec-meta mono">
                      #{String(r.conceptN).padStart(2, '0')} · {r.tier} · {r.videos} videos
                    </span>
                  </div>
                  <span className="rec-price mono">{r.priceJOD} JOD</span>
                </div>
                <p className="rec-hook" dir="auto">{r.hook}</p>
                <p className="hint rec-why">{r.because.en}</p>

                {/* Which findings this idea answers. The link he will be asked
                    to defend, made visible rather than left implied. */}
                {r.answers?.length > 0 && (
                  <p className="chips">
                    {r.answers.map((id) => findingById.get(id)).filter((f) => !!f).map((f) => (
                      <span className="chip" key={f.id} data-s={f.severity}>{f.title.en}</span>
                    ))}
                  </p>
                )}

                {on && (
                  <>
                    <div className="rec-ar">
                      <p className="hint" style={{ margin: '0 0 8px' }}>
                        Arabic for this one. The library is English — a stock translation of an
                        idea written for another business reads exactly like one. Left blank, the
                        English shows, correctly isolated.
                      </p>
                      <div className="pair">
                        <div>
                          <label>Name — AR</label>
                          <input dir="auto" value={copy[String(r.conceptN)]?.name ?? ''}
                                 onChange={(e) => saveCopy(r.conceptN, { name: e.target.value })}
                                 onBlur={() => postCopy(r.conceptN)} disabled={locked} />
                        </div>
                        <div>
                          <label>Hook — AR</label>
                          <textarea rows={2} dir="auto" value={copy[String(r.conceptN)]?.hook ?? ''}
                                    onChange={(e) => saveCopy(r.conceptN, { hook: e.target.value })}
                                    onBlur={() => postCopy(r.conceptN)} disabled={locked} />
                        </div>
                      </div>
                    </div>
                    <CastPicker
                      rec={r} roster={roster} current={cast} override={isOverride} busy={busy || locked}
                      onCast={(ids) => setCast(r.conceptN, ids)}
                    />
                  </>
                )}

                {!on && (
                  <p className="rec-cast mono" dir="auto">
                    {cast.length
                      ? cast.map((c) => `${c.name.en} · ${c.discipline}`).join('   ')
                      : r.uncastable || 'client-fronted — no cast needed'}
                  </p>
                )}
              </div>
            );
          })}
        </section>

        {/* ── the offer ── */}
        <section className="blk">
          <h2>The offer</h2>
          <p className="hint">
            Flat per video — the shoot, the edit, the cast and the marketing. They never
            see a crew day. 150 is published; discount it if you want to.
          </p>
          <div className="pair">
            <div>
              <label>Videos</label>
              <input type="number" min={1} max={60} value={offer.videos}
                     onChange={(e) => saveOffer({ videos: Math.max(1, Number(e.target.value) || 1) })}
                     onBlur={flushOffer} disabled={locked} />
            </div>
            <div>
              <label>Per video — JOD</label>
              <input type="number" min={1} value={offer.pricePerVideo}
                     onChange={(e) => saveOffer({ pricePerVideo: Math.max(1, Number(e.target.value) || 1) })}
                     onBlur={flushOffer} disabled={locked} />
            </div>
          </div>
          <label className="cfgline" data-on={offer.ads}>
            <input type="checkbox" checked={offer.ads} disabled={locked}
                   onChange={(e) => saveOffer({ ads: e.target.checked })} />
            <span>Run their advertising</span>
            <input type="number" min={0} className="inline-num" value={offer.adsMonthlyJOD}
                   onChange={(e) => saveOffer({ adsMonthlyJOD: Math.max(0, Number(e.target.value) || 0) })}
                   onBlur={flushOffer} disabled={locked} />
            <span className="mono">JOD / month</span>
          </label>
          <div className="offer-tot">
            <span><b className="mono">{offer.totalJOD.toLocaleString('en-US')}</b> JOD one-off</span>
            {offer.ads && <span><b className="mono">{offer.adsMonthlyJOD}</b> JOD / month</span>}
            {offerSavedAt && <span className="hint mono">saved · {offerSavedAt}</span>}
          </div>
        </section>

        {/* One primary action, full-width below 640px; everything else sits
            behind "More" there. `display:contents` keeps this identical to a
            flat row on a wide screen — see the rule in ops.css. */}
        <div className="bar">
          {status === 'approved' ? (
            <>
              {dealId ? (
                <a className="btn go bar-primary" href={`/ops/deals/${dealId}`}>The deal →</a>
              ) : (
                <button className="go bar-primary" disabled={busy}
                        onClick={async () => {
                          const j = await post({ action: 'won' });
                          if (j?.dealId) { setDealId(j.dealId); router.push(`/ops/deals/${j.dealId}`); }
                        }}>
                  They said yes
                </button>
              )}
              <details className="bar-more">
                <summary>More</summary>
                <div className="bar-more-body">
                  <button className="warn" disabled={busy}
                          onClick={async () => {
                            await post({ action: 'unapprove' }, 'Back to draft — the link is dead until you approve again.');
                            setStatus('draft'); router.refresh();
                          }}>
                    Reopen
                  </button>
                  <SendByHand
                    label="Show the message"
                    url="/api/ops/sheet"
                    composeBody={{ token: sheet.token, action: 'compose-share' }}
                    markBody={{ token: sheet.token, action: 'mark-share-sent' }}
                    noNumberHint="No usable number — fix it on the client page."
                    onSent={() => { setSentAt(new Date().toISOString()); router.refresh(); }}
                  />
                  <a className="btn" href={`/ops/sheet/${sheet.token}/preview`} target="_blank" rel="noreferrer">
                    See what they will see
                  </a>
                  <a className="btn" href={`/doc/proposal/share-${share}`} target="_blank" rel="noreferrer">
                    The proposal
                  </a>
                </div>
              </details>
              <span className="sp" />
              <span className="muted mono" dir="ltr">{shareUrl}</span>
            </>
          ) : (
            <>
              <button className="go bar-primary" disabled={busy || chosen.length !== 3}
                      onClick={async () => {
                        const j = await post({ action: 'approve' }, 'Approved. The link is live — nobody has it yet.');
                        if (j?.shareToken) { setShare(j.shareToken); setStatus('approved'); router.refresh(); }
                      }}>
                {chosen.length === 3 ? 'Approve and make the link' : `Choose ${3 - chosen.length} more`}
              </button>
              <details className="bar-more">
                <summary>More</summary>
                <div className="bar-more-body">
                  <a className="btn" href={`/ops/sheet/${sheet.token}/preview`} target="_blank" rel="noreferrer">
                    See what they will see
                  </a>
                </div>
              </details>
              <span className="sp" />
            </>
          )}
        </div>

        {status === 'approved' && (
          <p className="hint" style={{ marginTop: 10 }}>
            {sentAt ? (
              <>
                Sent {sentAt.slice(0, 10)} ·{' '}
                {sheet.openedAt
                  ? <>opened {sheet.openCount ?? 1} time{(sheet.openCount ?? 1) === 1 ? '' : 's'}
                    , last {openedSince}</>
                  : <span style={{ color: 'var(--warn)' }}>not opened yet</span>}
              </>
            ) : (
              <>The link exists and nobody has it. <b>Show the message</b>, send it, then
                press <b>I sent it</b> — that press is what starts the follow-up clock.</>
            )}
          </p>
        )}

        {status === 'approved' && !dealId && (
          <p className="hint" style={{ marginTop: 10 }}>
            <b>They said yes</b> opens the deal with this offer and these three ideas already
            on it, and the people you cast waiting on the offer form. It books nobody — a
            sheet has no dates, and a day nobody agreed is not a day to put on someone&rsquo;s phone.
          </p>
        )}
      </div>

      <aside className="facts">
        {/* Same collapse as the bar: two numbers below 900px until opened,
            the full panel exactly as before once there is room for it. */}
        <details className="facts-mob">
          <summary>
            <span><b className="mono">{sheet.findings.findings.filter((f) => f.severity === 'critical').length}</b> costing them money</span>
            <span><b className="mono">{chosen.length}/3</b> chosen</span>
          </summary>
          <div className="facts-body">
            <h2 dir="auto">{sheet.clientName}</h2>
            <div className="fact"><b className="mono" dir="ltr">@{sheet.handle}</b><span>{status}</span></div>
            {sheet.website && (
              <div className="fact">
                <a href={sheet.website} target="_blank" rel="noreferrer">their site →</a>
                <span>{sheet.webState ? WEB_STATE[sheet.webState.state] ?? sheet.webState.state : ''}</span>
              </div>
            )}
            <div className="fact"><b>{sheet.findings.findings.filter((f) => f.severity === 'critical').length}</b><span>costing them money</span></div>
            <div className="fact"><b>{recs.length}</b><span>ideas offered</span></div>
            <div className="fact"><b>{chosen.length}/3</b><span>chosen</span></div>
            {sheet.rosterState && sheet.rosterState !== 'real' && (
              <div className="fact">
                <b style={{ color: 'var(--warn)' }}>
                  {sheet.rosterState === 'empty' ? 'nobody' : 'worked examples'}
                </b>
                <span>on the roster — cannot be sent</span>
              </div>
            )}

            <h2 style={{ marginTop: 18 }}>Cast on the chosen</h2>
            {chosen.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Nothing chosen yet.</p>}
            {recs.filter((r) => chosen.includes(r.conceptN)).map((r) => {
              const cast = castOf(r.conceptN);
              return (
                <div className="fact" key={r.conceptN}>
                  <b style={{ fontSize: 12 }} dir="auto">{r.name}</b>
                  <span dir="auto">
                    {cast.map((c) => c.name.en).join(', ') || r.uncastable || 'no cast'}
                  </span>
                </div>
              );
            })}
            <div className="fact" style={{ marginTop: 10 }}>
              <b className="mono">{roster.filter((t) => t.active && !t.placeholder && t.dayRateJOD > 0).length}</b>
              <span>bookable on the roster</span>
            </div>
          </div>
        </details>
      </aside>
    </div>
  );
}
