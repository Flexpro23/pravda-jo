import Page from '@/components/Page';
import type { Lang } from '@/lib/i18n';

/** Shared shell for every text page — legal, pricing, help. */
export default function Prose({
  lang, kicker, title, lede, children,
}: {
  lang: Lang; kicker?: string; title: string; lede?: string; children: React.ReactNode;
}) {
  return (
    <Page lang={lang}>
      <article className="doc">
        <header className="doc-head wrap">
          {kicker && <p className="u">{kicker}</p>}
          <h1 className="big">{title}</h1>
          {lede && <p className="body doc-lede">{lede}</p>}
        </header>
        <div className="wrap doc-body">{children}</div>
      </article>
    </Page>
  );
}

export function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="doc-s">
      <h2 className="doc-h">{title}</h2>
      {children}
    </section>
  );
}
