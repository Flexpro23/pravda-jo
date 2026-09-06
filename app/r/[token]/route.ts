import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The long-form report is retired (master plan D1). A link to one may still be
 * sitting in a WhatsApp thread, so for one quarter this answers 410 with the
 * one place a curious tap can still go — rather than a bare 404 that reads as
 * "this studio's links do not work". Delete this file after December 2026.
 */
export async function GET(req: Request) {
  const lang = new URL(req.url).searchParams.get('lang') === 'en' ? 'en' : 'ar';
  const ar = lang === 'ar';
  const html = `<!doctype html><html lang="${lang}" dir="${ar ? 'rtl' : 'ltr'}"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>PRAVDA</title>
<body style="margin:0;background:#1A1A1A;color:#EDE8DD;font:17px/1.7 system-ui;padding:48px 24px">
<p style="max-width:32em">${ar
    ? 'هالصفحة ما عادت موجودة. التحقيق صار بيوصل بصيغة جديدة — اطلبوا نسختكم من هون:'
    : 'This page has been retired. The teardown now arrives in a new form — get yours here:'}</p>
<p><a href="/${lang}/teardown" style="color:#C9A227">${ar ? 'اطلبوا تحقيقكم' : 'Get your teardown'}</a></p>
</body></html>`;
  return new NextResponse(html, { status: 410, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
