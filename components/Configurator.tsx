'use client';

import { useEffect, useState } from 'react';
import type { Report } from '@/lib/data/report';
import {
  priceSelection, PACKS, VIDEO_JOD, RETAINER_JOD, type Selection,
} from '@/lib/data/deals';
import type { Lang } from '@/lib/i18n';

/**
 * The teardown, made answerable.
 *
 * Up to here a teardown is a document that ends in a phone number. This is the
 * part where the reader picks what they want and watches it price itself — the
 * step that turns a diagnosis into something Khaled can close rather than
 * something he has to reconstruct from a conversation.
 *
 * Deliberately absent: any figure from the crew side. A client sees what a
 * concept costs them and nothing about what it costs us, which is the same rule
 * the booking documents enforce from the other direction.
 */

const arNum = (n: number) =>
  n.toLocaleString('en-US').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]).replace(/,/g, '٬');

const money = (n: number, lang: Lang) =>
  lang === 'ar' ? arNum(n) : n.toLocaleString('en-US');

export default function Configurator({
  r, lang, specimen,
}: { r: Report; lang: Lang; specimen: boolean }) {
  const ar = lang === 'ar';
  const [sel, setSel] = useState<Selection>({ concepts: [], perMonth: 0, ads: false });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ once: number; monthly: number; updated: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /* Coming back to the link should show what you already asked for, not an
     empty form that makes you wonder whether it went through. */
  useEffect(() => {
    if (specimen) return;
    let live = true;
    fetch(`/api/proposal?token=${encodeURIComponent(r.token)}`)
      .then((res) => res.json())
      .then((j) => {
        if (!live || !j?.selection) return;
        setSel(j.selection);
        if (j.contactName) setName(j.contactName);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [r.token, specimen]);

  const prices = r.concepts.map((c) => c.price);
  const { onceJOD, monthlyJOD } = priceSelection(sel, prices);
  const empty = !sel.concepts.length && !sel.perMonth && !sel.ads;

  const toggle = (i: number) => setSel((s) => ({
    ...s,
    concepts: s.concepts.includes(i) ? s.concepts.filter((x) => x !== i) : [...s.concepts, i],
  }));

  const submit = async () => {
    if (empty || !name.trim() || !phone.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/proposal', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: r.token, selection: sel, contactName: name, contactPhone: phone }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(ar ? 'ما وصلت. جرّبوا كمان مرة.' : 'That did not go through. Try once more.');
        return;
      }
      setSent({ once: j.onceJOD, monthly: j.monthlyJOD, updated: j.updated });
    } catch {
      setErr(ar ? 'ما وصلت. جرّبوا كمان مرة.' : 'That did not go through. Try once more.');
    } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <section className="wrap rep-s cfg-done">
        <p className="u brass">{ar ? 'وصلنا' : 'Received'}</p>
        <h2 className="mid">
          {sent.updated
            ? (ar ? 'حدّثنا طلبكم.' : 'We have updated your request.')
            : (ar ? 'وصلنا طلبكم.' : 'We have your request.')}
        </h2>
        <div className="cfg-sum">
          {sent.once > 0 && (
            <p className="price num">{money(sent.once, lang)}
              <span className="price-u">{ar ? 'دينار · مرة وحدة' : 'JOD · one-off'}</span></p>
          )}
          {sent.monthly > 0 && (
            <p className="price num">{money(sent.monthly, lang)}
              <span className="price-u">{ar ? 'دينار · بالشهر' : 'JOD · per month'}</span></p>
          )}
        </div>
        <p className="body">
          {ar
            ? 'خالد بيتواصل معكم شخصيًا خلال يوم عمل. ما في إشي موقّع لحد الآن — هاد طلب سعر، مش عقد.'
            : 'Khaled will contact you personally within one working day. Nothing is signed — this is a request for a quote, not a contract.'}
        </p>
      </section>
    );
  }

  return (
    <section className="wrap rep-s cfg">
      <p className="u brass">{ar ? 'اختاروا' : 'Choose'}</p>
      <h2 className="mid">
        {ar ? 'شو بدكم منها، وقدّيش بتكلّف' : 'What you want, and what it costs'}
      </h2>
      <p className="body cfg-lede">
        {ar
          ? 'كل فكرة سعرها مكتوب قبل أي مكالمة. علّموا على اللي بدكم إياه والسعر بينحسب قدّامكم.'
          : 'Every idea is priced before any call. Tick what you want and the total assembles as you go.'}
      </p>

      <div className="cfg-list">
        {r.concepts.map((c, i) => {
          const on = sel.concepts.includes(i);
          return (
            <label className="cfg-item" key={i} data-on={on}>
              <input type="checkbox" checked={on} onChange={() => toggle(i)}
                     aria-label={`${c.name[lang]} — ${c.price} ${ar ? 'دينار' : 'JOD'}`} />
              <span className="cfg-body">
                <span className="cfg-top">
                  <b className="c-name">{c.name[lang]}</b>
                  <span className="cfg-price num">{money(c.price, lang)}
                    <span className="price-u">{ar ? 'دينار' : 'JOD'}</span></span>
                </span>
                <span className="body cfg-line">{c.line[lang]}</span>
                <span className="cfg-meta">{c.assets[lang]}</span>
                {c.cast.length > 0 && (
                  <span className="cfg-cast">
                    <span className="u">{ar ? 'الطاقم' : 'Cast'}</span>
                    {c.cast.map((p, k) => (
                      <span key={k}><b>{p.name[lang]}</b> <span className="u">{p.role[lang]}</span></span>
                    ))}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <div className="cfg-ongoing">
        <p className="u">{ar ? 'وبعدها؟' : 'And after that?'}</p>
        <div className="cfg-opts">
          <button type="button" className="cfg-opt" aria-pressed={sel.perMonth === 0}
                  onClick={() => setSel((s) => ({ ...s, perMonth: 0 }))}>
            {ar ? 'مرة وحدة بس' : 'One-off only'}
          </button>
          {PACKS.map((p) => (
            <button type="button" className="cfg-opt" key={p} aria-pressed={sel.perMonth === p}
                    onClick={() => setSel((s) => ({ ...s, perMonth: s.perMonth === p ? 0 : p }))}>
              <b className="num">{money(p, lang)}</b>{' '}
              {ar ? 'فيديو بالشهر' : 'videos a month'}
              <span className="cfg-sub num">{money(p * VIDEO_JOD, lang)} {ar ? 'د/شهر' : 'JOD/mo'}</span>
            </button>
          ))}
        </div>

        <label className="cfg-add" data-on={sel.ads}>
          <input type="checkbox" checked={sel.ads}
                 onChange={() => setSel((s) => ({ ...s, ads: !s.ads }))} />
          <span>
            <b>{ar ? 'إدارة الإعلانات' : 'We run the advertising'}</b>
            <span className="body">
              {ar
                ? 'منشغّل إعلاناتكم على ميتا ومنتابعها. بيبدا من ٤٠٠ دينار بالشهر.'
                : 'We run and manage your Meta advertising. From 400 JOD a month.'}
            </span>
          </span>
          <span className="cfg-price num">{money(RETAINER_JOD, lang)}
            <span className="price-u">{ar ? 'د/شهر' : 'JOD/mo'}</span></span>
        </label>
      </div>

      {/* The running total. Sticky on a phone, because the whole point is that
          it answers "what will this cost me" without scrolling back. */}
      <div className="cfg-total" data-empty={empty}>
        <div>
          <span className="u">{ar ? 'المجموع' : 'Total'}</span>
          <p className="cfg-figures">
            {onceJOD > 0 && (
              <span className="price num">{money(onceJOD, lang)}
                <span className="price-u">{ar ? 'دينار · مرة وحدة' : 'JOD · one-off'}</span></span>
            )}
            {monthlyJOD > 0 && (
              <span className="price num">{money(monthlyJOD, lang)}
                <span className="price-u">{ar ? 'دينار · بالشهر' : 'JOD · per month'}</span></span>
            )}
            {empty && <span className="cfg-none">{ar ? 'ما علّمتوا على إشي بعد' : 'Nothing selected yet'}</span>}
          </p>
        </div>
      </div>

      {specimen ? (
        <p className="body cfg-note">
          {ar
            ? 'هاد نموذج — الأزرار بتشتغل، بس ما بينبعت إشي. بتحقيقكم إنتو، هون بتبعتوا الطلب.'
            : 'This is a specimen — the controls work, but nothing is sent. On your own teardown, this is where the request goes.'}
        </p>
      ) : (
        <div className="cfg-send">
          <div className="cfg-fields">
            <label>
              <span className="u">{ar ? 'الاسم' : 'Your name'}</span>
              <input value={name} onChange={(e) => setName(e.target.value)}
                     autoComplete="name" />
            </label>
            <label>
              <span className="u">{ar ? 'رقم الواتساب' : 'WhatsApp number'}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                     dir="ltr" inputMode="tel" autoComplete="tel" placeholder="+962" />
            </label>
          </div>
          <button type="button" className="btn cfg-submit"
                  disabled={busy || empty || !name.trim() || !phone.trim()}
                  onClick={submit}>
            {busy ? (ar ? 'عم نبعت…' : 'Sending…') : (ar ? 'ابعتوا الطلب' : 'Send the request')}
          </button>
          {err && <p className="body cfg-err">{err}</p>}
          <p className="cfg-note">
            {ar
              ? 'منستعمل رقمكم لهالطلب بس. ما في إشي موقّع، والسعر بيضل نفسه لحد ما تحكوا مع خالد.'
              : 'We use your number for this request only. Nothing is signed, and the price stands until you have spoken to Khaled.'}
          </p>
        </div>
      )}
    </section>
  );
}
