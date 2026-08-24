import Prose, { S } from '@/components/Prose';
import { NOTICE, PRIVACY, TERMS, UPDATED, type Block } from '@/lib/data/legal';
import { Lang, tx } from '@/lib/i18n';

const SETS: Record<string, { blocks: Block[]; title: { ar: string; en: string }; lede: { ar: string; en: string } }> = {
  notice: {
    blocks: NOTICE,
    title: { ar: 'إشعار المعالجة', en: 'Processing notice' },
    lede: {
      ar: 'المادة ٩ من قانون حماية البيانات الشخصية الأردني بتفرض ستّة إفصاحات مكتوبة قبل ما تبدأ المعالجة. هاي هيّ، بالترتيب.',
      en: 'Article 9 of Jordan’s data protection law requires six disclosures in writing before processing begins. These are them, in order.',
    },
  },
  privacy: {
    blocks: PRIVACY,
    title: { ar: 'الخصوصية', en: 'Privacy' },
    lede: {
      ar: 'النسخة القصيرة: منقرأ اللي نشرتوه علنًا، ولا إشي غير هيك.',
      en: 'The short version: we read what you published publicly, and nothing else.',
    },
  },
  terms: {
    blocks: TERMS,
    title: { ar: 'الشروط', en: 'Terms' },
    lede: {
      ar: 'شو منوعد فيه، وشو ما منوعد فيه.',
      en: 'What we promise, and what we do not.',
    },
  },
};

export default function LegalView({ lang, kind }: { lang: Lang; kind: keyof typeof SETS }) {
  const set = SETS[kind];
  return (
    <Prose
      lang={lang}
      kicker={`${tx('updated', lang)} — ${UPDATED}`}
      title={set.title[lang]}
      lede={set.lede[lang]}
    >
      {set.blocks.map((b) => (
        <S key={b.h.en} title={b.h[lang]}>
          {b.p.map((para, i) => <p className="body" key={i}>{para[lang]}</p>)}
        </S>
      ))}
    </Prose>
  );
}
