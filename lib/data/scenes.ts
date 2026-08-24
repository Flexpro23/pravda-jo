import type { Lang } from '@/lib/i18n';

export type Scene = {
  /** normalised range on the flight timeline */
  at: [number, number];
  /** small word that arrives first, at a different scale */
  pre?: { ar: string; en: string };
  /** the headline */
  head: { ar: string; en: string };
  /** superscript figure, set beside the head */
  sup?: string;
  /** one line under */
  sub: { ar: string; en: string };
  /** true for the closing scene — renders the actions */
  outro?: boolean;
};

/**
 * PRAVDA's own numbers. Nothing here is market research we did not do —
 * every figure is a fact about the company: the roster, the library, the
 * rate card, and what a teardown costs.
 */
export const SCENES: Scene[] = [
  {
    at: [0.00, 0.155],
    head: { ar: 'منشوف حسابك', en: 'We read' },
    pre: { ar: 'برافدا', en: 'PRAVDA' },
    sub: {
      ar: 'قبل ما نحكيك — منقرأ حسابك كله، ومنبعتلك تحقيق. مجانًا.',
      en: 'your account before we call you. The whole thing, sent back as a teardown. Free.',
    },
  },
  {
    at: [0.205, 0.355],
    pre: { ar: 'على', en: 'A roster of' },
    head: { ar: 'الروستر', en: 'ninety' },
    sup: '90',
    sub: {
      ar: 'عارض ومصوّر ومركّب في عمّان — منقدر نجهّز طاقم لأي فكرة.',
      en: 'models, photographers and editors in Amman. Enough to cast anything we propose.',
    },
  },
  {
    at: [0.405, 0.555],
    pre: { ar: 'عنا', en: 'And' },
    head: { ar: 'فكرة جاهزة', en: 'thirty ideas' },
    sup: '30',
    sub: {
      ar: 'كل وحدة متصوّرة قبل، بطاقم معروف وسعر معروف. ما منخترع من الصفر.',
      en: 'already shot, each with a known cast and a known cost. We do not invent from nothing.',
    },
  },
  {
    at: [0.605, 0.755],
    pre: { ar: 'من', en: 'From' },
    head: { ar: 'دينار للمقطع', en: 'a hundred fifty' },
    sup: '150',
    sub: {
      ar: 'وإدارة إعلانات من ٤٠٠ دينار بالشهر. الأسعار مكتوبة، مش بالمكالمة.',
      en: 'JOD an asset, and advertising from 400 a month. Prices published, not quoted on a call.',
    },
  },
  {
    at: [0.805, 0.945],
    pre: { ar: 'وبتكلّفك', en: 'And it costs' },
    head: { ar: 'صفر', en: 'nothing' },
    sup: '0',
    sub: {
      ar: 'التحقيق مجاني. منقرأ، منكتب، منبعت — وبعدها إنت بتقرر.',
      en: 'The teardown is free. We read it, we write it, we send it. Then you decide.',
    },
  },
  {
    at: [0.975, 1.0],
    head: { ar: 'ابعتلنا الحساب', en: 'Send us the handle' },
    sub: {
      ar: 'حساب أعمال عام، ورقم واتساب. الباقي علينا.',
      en: 'A public business account and a WhatsApp number. We do the rest.',
    },
    outro: true,
  },
];
