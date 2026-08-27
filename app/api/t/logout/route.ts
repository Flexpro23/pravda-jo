import { NextResponse } from 'next/server';
import { T_COOKIE } from '@/lib/talent/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/t', req.url), 303);
  res.cookies.delete(T_COOKIE);
  return res;
}
