'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Sheet } from '@/lib/store/sheets';
import type { Talent } from '@/lib/data/deals';

/**
 * The sheet Khaled approves.
 *
 * The plan calls the console a throttle rather than a dashboard: it should turn
 * a pile of decisions into a few. So this page asks him for exactly three
 * things — which three ideas, who is on them, and what the offer is — and shows
 * everything else as read-only evidence he can lean on when the client asks
 * "why this one".
 */

const n0 = (x: number) => Math.round(x).toString();
const n1 = (x: number) => (Math.round(x * 10) / 10).toString();
const hour = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;

const SEV = {
  critical: { label: 'Costing them money', color: 'var(--warn)' },
  notable: { label: 'Worth fixing', color: '#C9A227' },
  good: { label: 'Working', color: 'var(--go)' },
} as const;

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
              title={`${hour(h)} — ${v} post${v === 1 ? '' : 's'}`}>
          <span className="hbar" style={{ height: `${(v / max) * 100}%` }} />
          {h % 6 === 0 && <span className="htick mono">{hour(h)}</span>}
        </span>
      ))}
    </div>
  );
}

export default function SheetReview({ sheet, roster }: { sheet: Sheet; roster: Talent[] }) {
  const [chosen, setChosen] = useState<number[]>(sheet.chosen ?? []);
  const [offer, setOffer] = useState(sheet.offer ?? {
    videos: 6, pricePerVideo: 150, ads: true, adsMonthlyJOD: 400, totalJOD: 900,
  });
  const [status, setStatus] = useState(sheet.status);
  const [share, setShare] = useState(sheet.shareToken);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);
  const router = useRouter();

  const s = sheet.signals;
  const post = async (body: Record<string, unknown>, ok?: string) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/ops/sheet', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: sheet.token, ...body }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg({ k: 'err', t: j.error === 'pick-three' ? 'Choose exactly three ideas first.'
          : j.error === 'no-offer' ? 'Set the offer first.' : `Failed: ${j.error}` });
        return null;
      }
      if (ok) setMsg({ k: 'ok', t: ok });
      return j;
    } catch { setMsg({ k: 'err', t: 'The request did not complete.' }); return null; }
    finally { setBusy(false); }
  };

  const toggle = (n: number) => {
    const next = chosen.includes(n) ? chosen.filter((x) => x !== n)
      : chosen.length >= 3 ? chosen : [...chosen, n];
    setChosen(next);
    post({ action: 'choose', chosen: next });
  };

  const saveOffer = (patch: Partial<typeof offer>) => {
    const next = { ...offer, ...patch };
    next.totalJOD = next.videos * next.pricePerVideo;
    setOffer(next);
    post({ action: 'offer', ...next });
  };

  const shareUrl = share ? `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${share}` : '';

  return (
    <div className="cols">
      <div>
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
              : <div><b className="mono">—</b><span>no site read</span></div>}
          </div>
        </section>

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
                {f.figure && <b className="find-fig mono">{f.figure}</b>}
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
          <p className="hint">
            Five were selected from the library against the findings above — never invented.
            Pick the three this client sees.
          </p>
          {sheet.recommendations.map((r) => {
            const on = chosen.includes(r.conceptN);
            const full = chosen.length >= 3 && !on;
            return (
              <div className="rec" key={r.conceptN} data-on={on} data-full={full}>
                <div className="rec-head">
                  <button type="button" className="rec-pick" disabled={busy || full}
                          aria-pressed={on} onClick={() => toggle(r.conceptN)}>
                    {on ? '✓' : '+'}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b className="rec-name">{r.name}</b>
                    <span className="rec-meta mono">
                      #{String(r.conceptN).padStart(2, '0')} · {r.tier} · {r.videos} videos
                    </span>
                  </div>
                  <span className="rec-price mono">{r.priceJOD} JOD</span>
                </div>
                <p className="rec-hook">{r.hook}</p>
                <p className="hint rec-why">{r.because.en}</p>
                {on && (
                  <div className="rec-ar">
                    <p className="hint" style={{ margin: '0 0 8px' }}>
                      Arabic for this one. The library is English — a stock translation of an
                      idea written for another business reads exactly like one. Left blank, the
                      English shows, correctly isolated.
                    </p>
                    <div className="pair">
                      <div>
                        <label>Name — AR</label>
                        <input dir="rtl" defaultValue={sheet.copy?.[String(r.conceptN)]?.name ?? ''}
                               onBlur={(e) => post({ action: 'copy', conceptN: r.conceptN,
                                 name: e.target.value,
                                 hook: sheet.copy?.[String(r.conceptN)]?.hook ?? '' })} />
                      </div>
                      <div>
                        <label>Hook — AR</label>
                        <textarea rows={2} dir="rtl" defaultValue={sheet.copy?.[String(r.conceptN)]?.hook ?? ''}
                                  onBlur={(e) => post({ action: 'copy', conceptN: r.conceptN,
                                    name: sheet.copy?.[String(r.conceptN)]?.name ?? '',
                                    hook: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}
                <p className="rec-cast mono">
                  {r.cast.length
                    ? r.cast.map((c) => `${c.name.en} · ${c.discipline}`).join('   ')
                    : 'client-fronted — no cast needed'}
                </p>
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
                     onChange={(e) => saveOffer({ videos: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div>
              <label>Per video — JOD</label>
              <input type="number" min={1} value={offer.pricePerVideo}
                     onChange={(e) => saveOffer({ pricePerVideo: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
          </div>
          <label className="cfgline" data-on={offer.ads}>
            <input type="checkbox" checked={offer.ads}
                   onChange={(e) => saveOffer({ ads: e.target.checked })} />
            <span>Run their advertising</span>
            <input type="number" min={0} className="inline-num" value={offer.adsMonthlyJOD}
                   onChange={(e) => saveOffer({ adsMonthlyJOD: Math.max(0, Number(e.target.value) || 0) })} />
            <span className="mono">JOD / month</span>
          </label>
          <div className="offer-tot">
            <span><b className="mono">{offer.totalJOD.toLocaleString('en-US')}</b> JOD one-off</span>
            {offer.ads && <span><b className="mono">{offer.adsMonthlyJOD}</b> JOD / month</span>}
          </div>
        </section>

        <div className="bar">
          {status === 'approved' ? (
            <>
              <button className="warn" disabled={busy}
                      onClick={async () => { await post({ action: 'unapprove' }, 'Back to draft — the link is dead until you approve again.'); setStatus('draft'); router.refresh(); }}>
                Reopen
              </button>
              <a className="btn go" href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
                 target="_blank" rel="noreferrer">Send on WhatsApp</a>
              <a className="btn" href={`/doc/proposal/sheet-${sheet.token}`} target="_blank" rel="noreferrer">
                The proposal PDF
              </a>
              <a className="btn" href={`/s/${share}`} target="_blank" rel="noreferrer">See what they see</a>
            </>
          ) : (
            <button className="go" disabled={busy || chosen.length !== 3}
                    onClick={async () => {
                      const j = await post({ action: 'approve' }, 'Approved. The link is live.');
                      if (j?.shareToken) { setShare(j.shareToken); setStatus('approved'); router.refresh(); }
                    }}>
              {chosen.length === 3 ? 'Approve and make the link' : `Choose ${3 - chosen.length} more`}
            </button>
          )}
          <span className="sp" />
          {status === 'approved' && <span className="muted mono">{shareUrl}</span>}
        </div>
        {msg && <p className="note" data-k={msg.k}>{msg.t}</p>}
      </div>

      <aside className="facts">
        <h2>{sheet.clientName}</h2>
        <div className="fact"><b>@{sheet.handle}</b><span>{sheet.status}</span></div>
        {sheet.website && (
          <div className="fact">
            <a href={sheet.website} target="_blank" rel="noreferrer">their site →</a>
          </div>
        )}
        <div className="fact"><b>{sheet.findings.findings.filter((f) => f.severity === 'critical').length}</b><span>costing them money</span></div>
        <div className="fact"><b>{sheet.recommendations.length}</b><span>ideas offered</span></div>
        <div className="fact"><b>{chosen.length}/3</b><span>chosen</span></div>
        <h2 style={{ marginTop: 18 }}>Cast on the chosen</h2>
        {chosen.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Nothing chosen yet.</p>}
        {sheet.recommendations.filter((r) => chosen.includes(r.conceptN)).map((r) => (
          <div className="fact" key={r.conceptN}>
            <b style={{ fontSize: 12 }}>{r.name}</b>
            <span>{r.cast.map((c) => c.name.en).join(', ') || 'no cast'}</span>
          </div>
        ))}
        <div className="fact" style={{ marginTop: 10 }}>
          <b className="mono">{roster.filter((t) => t.active).length}</b><span>bookable on the roster</span>
        </div>
      </aside>
    </div>
  );
}
