'use client';

import { useState } from 'react';
import type { Report, Concept, Fix } from '@/lib/data/report';
import type { Signals } from '@/lib/teardown/signals';

type B = { ar: string; en: string };
type Status = 'draft' | 'ready' | 'sent';

const isTodo = (b?: B) => !!b && (b.ar.includes('⟦') || b.en.includes('⟦'));
const blank = (): B => ({ ar: '', en: '' });
/** Placeholder text is scaffolding, not a draft. Clear it on first focus. */
const clean = (b: B): B => ({
  ar: b.ar.includes('⟦') ? '' : b.ar,
  en: b.en.includes('⟦') ? '' : b.en,
});

/** One idea, in both languages, side by side so they cannot drift apart. */
function Bi({
  label, value, onChange, lines = 2,
}: { label: string; value: B; onChange: (v: B) => void; lines?: number }) {
  const v = clean(value);
  const T = lines > 1 ? 'textarea' : 'input';
  const common = { rows: lines } as Record<string, unknown>;
  return (
    <div className="pair">
      <div>
        <label>{label} — EN</label>
        <T {...(lines > 1 ? common : {})} dir="ltr" value={v.en}
           onChange={(e: { target: { value: string } }) => onChange({ ...v, en: e.target.value })} />
      </div>
      <div>
        <label>{label} — AR</label>
        <T {...(lines > 1 ? common : {})} dir="rtl" value={v.ar}
           onChange={(e: { target: { value: string } }) => onChange({ ...v, ar: e.target.value })} />
      </div>
    </div>
  );
}

function Block({
  title, hint, todo, children,
}: { title: string; hint?: string; todo?: boolean; children: React.ReactNode }) {
  return (
    <section className="blk">
      <h2>{title} {todo && <span className="todo">· unwritten</span>}</h2>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}

export default function Editor({
  initial, signals, status: status0,
}: { initial: Report; signals: Signals; status: Status }) {
  const [r, setR] = useState<Report>(initial);
  const [status, setStatus] = useState<Status>(status0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'ok' | 'err'; t: string } | null>(null);

  /** Every edit works on a copy, so no nested field is ever mutated in place. */
  const edit = (fn: (d: Report) => void) => {
    setR((prev) => { const d = structuredClone(prev); fn(d); return d; });
  };

  const remaining = JSON.stringify(r).split('⟦').length - 1;

  const send = async (intent: 'save' | 'ready' | 'sent') => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/ops/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: r.token, report: r, intent }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg({ k: 'err', t: j.detail ?? `Could not save: ${j.error}` });
      } else {
        setStatus(j.status);
        setMsg({ k: 'ok', t: intent === 'save' ? 'Saved.' : `Marked ${j.status}.` });
      }
    } catch {
      setMsg({ k: 'err', t: 'The request did not complete.' });
    } finally { setBusy(false); }
  };

  const pct = (n: number) => `${Math.round(n)}%`;

  return (
    <div className="cols">
      <div>
        <Block
          title="The business"
          hint="The name came from Instagram. The sector is yours to name — it sets the tone of everything below."
        >
          <Bi label="Client" value={r.client} onChange={(v) => edit((d) => { d.client = v; })} lines={1} />
          <Bi label="Sector" value={r.sector} onChange={(v) => edit((d) => { d.sector = v; })} lines={1} />
        </Block>

        <Block
          title="The opening"
          todo={isTodo(r.hero.head) || isTodo(r.hero.body)}
          hint="One observation about their strongest post, then what followed it — and what did not. This is the only part most people read."
        >
          <p className="hint mono">Caption (computed): {r.hero.cap.en || '—'}</p>
          <Bi label="Headline" value={r.hero.head} onChange={(v) => edit((d) => { d.hero.head = v; })} />
          <Bi label="Body" value={r.hero.body} onChange={(v) => edit((d) => { d.hero.body = v; })} lines={3} />
        </Block>

        <Block
          title="The verdict"
          todo={isTodo(r.verdict)}
          hint="One honest sentence. It should be uncomfortable and still fair."
        >
          <Bi label="Verdict" value={r.verdict} onChange={(v) => edit((d) => { d.verdict = v; })} lines={3} />
        </Block>

        <Block
          title="What is working"
          todo={r.working.some(isTodo)}
          hint="Genuinely good things, named specifically. A teardown that only takes is not read twice."
        >
          {r.working.map((w, i) => (
            <div className="item" key={i}>
              <div className="itemhead">
                <b>{i + 1}</b><span className="sp" />
                <button className="x" onClick={() => edit((d) => { d.working.splice(i, 1); })}>remove</button>
              </div>
              <Bi label="Observation" value={w} onChange={(v) => edit((d) => { d.working[i] = v; })} lines={3} />
            </div>
          ))}
          <button onClick={() => edit((d) => { d.working.push(blank()); })}>Add</button>
        </Block>

        <Block
          title="The pattern"
          todo={isTodo(r.pattern.head) || isTodo(r.pattern.tail)}
          hint="The bars are computed and cannot be edited here — only what they mean."
        >
          <Bi label="Head" value={r.pattern.head} onChange={(v) => edit((d) => { d.pattern.head = v; })} />
          <Bi label="Tail" value={r.pattern.tail} onChange={(v) => edit((d) => { d.pattern.tail = v; })} />
        </Block>

        <Block
          title="Five things to fix this week"
          todo={r.fixes.some((f) => isTodo(f.h) || isTodo(f.p))}
          hint="Things they can do without us. Free advice is what makes the rest credible."
        >
          {r.fixes.map((f, i) => (
            <div className="item" key={i}>
              <div className="itemhead">
                <b>Fix {i + 1}</b><span className="sp" />
                <button className="x" onClick={() => edit((d) => { d.fixes.splice(i, 1); })}>remove</button>
              </div>
              <Bi label="Heading" value={f.h} onChange={(v) => edit((d) => { d.fixes[i].h = v; })} lines={1} />
              <Bi label="Why" value={f.p} onChange={(v) => edit((d) => { d.fixes[i].p = v; })} />
            </div>
          ))}
          <button onClick={() => edit((d) => { d.fixes.push({ h: blank(), p: blank() } as Fix); })}>
            Add a fix
          </button>
        </Block>

        <Block
          title="Concepts"
          hint="Selected and adapted from the library — never invented here. Each carries its own price, and the cast is named."
        >
          {r.concepts.map((c, i) => (
            <div className="item" key={i}>
              <div className="itemhead">
                <b>Concept {i + 1}</b><span className="sp" />
                <button className="x" onClick={() => edit((d) => { d.concepts.splice(i, 1); })}>remove</button>
              </div>
              <Bi label="Name" value={c.name} onChange={(v) => edit((d) => { d.concepts[i].name = v; })} lines={1} />
              <Bi label="One line" value={c.line} onChange={(v) => edit((d) => { d.concepts[i].line = v; })} lines={1} />
              <Bi label="The idea" value={c.idea} onChange={(v) => edit((d) => { d.concepts[i].idea = v; })} lines={3} />
              <Bi label="Assets" value={c.assets} onChange={(v) => edit((d) => { d.concepts[i].assets = v; })} lines={1} />
              <Bi label="Note" value={c.note} onChange={(v) => edit((d) => { d.concepts[i].note = v; })} />
              <div className="pair">
                <div>
                  <label>Price — JOD</label>
                  <input type="number" min={0} value={c.price}
                         onChange={(e) => edit((d) => { d.concepts[i].price = Number(e.target.value); })} />
                  <p className="hint" style={{ marginTop: 6 }}>
                    A crew day is 35 + 50 per model. {c.cast.length} cast named.
                  </p>
                </div>
              </div>
              {c.cast.map((m, k) => (
                <div key={k} style={{ marginTop: 8 }}>
                  <div className="itemhead">
                    <b>Cast {k + 1}</b><span className="sp" />
                    <button className="x"
                            onClick={() => edit((d) => { d.concepts[i].cast.splice(k, 1); })}>remove</button>
                  </div>
                  <Bi label="Name" value={m.name} lines={1}
                      onChange={(v) => edit((d) => { d.concepts[i].cast[k].name = v; })} />
                  <Bi label="Role" value={m.role} lines={1}
                      onChange={(v) => edit((d) => { d.concepts[i].cast[k].role = v; })} />
                </div>
              ))}
              <button onClick={() => edit((d) => {
                d.concepts[i].cast.push({ name: blank(), role: blank() });
              })}>Add cast</button>
            </div>
          ))}
          <button onClick={() => edit((d) => {
            d.concepts.push({
              name: blank(), line: blank(), idea: blank(),
              cast: [], price: 150, assets: blank(), note: blank(),
            } as Concept);
          })}>Add a concept</button>
        </Block>

        <Block
          title="The plan"
          todo={r.plan.some((p) => isTodo(p.m) || isTodo(p.p))}
          hint="What happens, month by month."
        >
          {r.plan.map((p, i) => (
            <div className="item" key={i}>
              <div className="itemhead">
                <b>Step {i + 1}</b><span className="sp" />
                <button className="x" onClick={() => edit((d) => { d.plan.splice(i, 1); })}>remove</button>
              </div>
              <Bi label="When" value={p.m} onChange={(v) => edit((d) => { d.plan[i].m = v; })} lines={1} />
              <Bi label="What" value={p.p} onChange={(v) => edit((d) => { d.plan[i].p = v; })} />
            </div>
          ))}
          <button onClick={() => edit((d) => { d.plan.push({ m: blank(), p: blank() }); })}>Add a step</button>
        </Block>

        <Block
          title="Paid"
          hint="Optional, and never computed — the Ad Library API returns nothing for Jordan. Read the public web interface and fill this, or leave it off and the section will not run."
        >
          {r.ads ? (
            <>
              <div className="pair">
                <div>
                  <label>Their active ads</label>
                  <input value={r.ads.mine}
                         onChange={(e) => edit((d) => { d.ads!.mine = e.target.value; })} />
                </div>
                <div>
                  <label>Neighbours, combined</label>
                  <input value={r.ads.theirs}
                         onChange={(e) => edit((d) => { d.ads!.theirs = e.target.value; })} />
                </div>
              </div>
              <Bi label="Their label" value={r.ads.mineLabel} lines={1}
                  onChange={(v) => edit((d) => { d.ads!.mineLabel = v; })} />
              <Bi label="Neighbours label" value={r.ads.theirsLabel} lines={1}
                  onChange={(v) => edit((d) => { d.ads!.theirsLabel = v; })} />
              <Bi label="What it means" value={r.ads.p}
                  onChange={(v) => edit((d) => { d.ads!.p = v; })} lines={3} />
              <button className="warn" onClick={() => edit((d) => { delete d.ads; })}>
                Drop this section
              </button>
            </>
          ) : (
            <button onClick={() => edit((d) => {
              d.ads = {
                mine: '0', theirs: '',
                mineLabel: { ar: 'إعلاناتكم النشطة', en: 'Your active ads' },
                theirsLabel: { ar: 'الجيران، مجتمعين', en: 'Neighbours, combined' },
                p: blank(),
              };
            })}>Add the paid section</button>
          )}
        </Block>

        <div className="bar">
          <button onClick={() => send('save')} disabled={busy}>Save draft</button>
          <button className="go" onClick={() => send('ready')} disabled={busy || remaining > 0}>
            Mark ready
          </button>
          {status !== 'draft' && (
            <button onClick={() => send('sent')} disabled={busy}>Mark sent</button>
          )}
          <span className="sp" />
          <span className="muted">
            {remaining > 0
              ? `${remaining} section${remaining === 1 ? '' : 's'} still unwritten`
              : 'Every section written'}
          </span>
        </div>
        {msg && <p className="note" data-k={msg.k}>{msg.t}</p>}
      </div>

      {/* The measured facts, kept in view. Nothing written on the left may
          contradict anything on the right — that is the whole discipline. */}
      <aside className="facts">
        <h2>Measured</h2>
        <div className="fact"><b>@{signals.handle}</b><span>{r.date}</span></div>
        <div className="fact"><b>{signals.followers.toLocaleString('en-US')}</b><span>followers</span></div>
        <div className="fact"><b>{signals.posts}</b><span>posts read</span></div>
        <div className="fact"><b>{signals.engagementRate.toFixed(2)}%</b><span>engagement</span></div>
        <div className="fact"><b>{Math.round(signals.medianEngagement)}</b><span>median reactions</span></div>
        <div className="fact"><b>{signals.postsPerWeek.toFixed(1)}</b><span>posts / week</span></div>
        <div className="fact">
          <b>{signals.peakWindow.from}:00–{signals.peakWindow.to}:00</b>
          <span>{pct(signals.peakWindow.share)} of posts</span>
        </div>
        {signals.bestWindow && (
          <div className="fact">
            <b>{signals.bestWindow.from}:00–{signals.bestWindow.to}:00</b>
            <span>performs best</span>
          </div>
        )}
        {signals.best && (
          <div className="fact">
            <b>{signals.best.multiple.toFixed(1)}×</b>
            <span>best post vs typical</span>
          </div>
        )}
        {signals.formats.map((f) => (
          <div className="fact" key={f.format}>
            <b>{f.format}</b>
            <span>{f.posts} posts · {pct(f.shareEngagement)} of engagement</span>
          </div>
        ))}
        <div className="fact">
          <b>{signals.captions.asking}</b><span>captions that ask</span>
        </div>

        <h2 style={{ marginTop: 18 }}>Links</h2>
        <p className="muted" style={{ fontSize: 12.5 }}>
          {status === 'draft'
            ? 'Both 404 until this is marked ready.'
            : 'The preview is what goes in the DM.'}
        </p>
        <div className="fact"><a href={`/p/${r.token}`} target="_blank" rel="noreferrer">Preview →</a></div>
        <div className="fact"><a href={`/r/${r.token}`} target="_blank" rel="noreferrer">Full teardown →</a></div>
        <div className="fact">
          <a href={`https://instagram.com/${signals.handle}`} target="_blank" rel="noreferrer">
            @{signals.handle} on Instagram →
          </a>
        </div>
      </aside>
    </div>
  );
}
