import Link from 'next/link';
import MastNav from '@/components/MastNav';
import { Lang, path } from '@/lib/i18n';

export default function Masthead({ lang }: { lang: Lang }) {
  return (
    <header className="mast">
      <div className="wrap mast-in">
        <Link href={path(lang)} className="wm fade" aria-label="PRAVDA">
          {lang === 'ar' ? 'برافدا' : 'PRAVDA'}
        </Link>
        <MastNav lang={lang} />
      </div>
    </header>
  );
}
