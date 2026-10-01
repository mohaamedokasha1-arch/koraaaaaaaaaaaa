import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, locales } from '@/i18n/locales';

const PUBLIC_FILE = /\.[^/]+$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  // Fail closed before streaming any protected admin HTML. No credentials
  // are exposed; unconfigured installations have no admin surface at all.
  if (/^\/(?:ar|en)\/watch\/admin\/?$/.test(pathname) && (
    process.env.NEXT_PUBLIC_LIVE_ENABLED !== 'true' ||
    (process.env.LIVE_ADMIN_PASSWORD?.length ?? 0) < 24 ||
    (process.env.LIVE_REPORT_SALT?.length ?? 0) < 32 ||
    !process.env.LIVE_SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_LIVE_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_LIVE_SUPABASE_ANON_KEY
  )) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (hasLocale) return NextResponse.next();

  // honor previously chosen locale, else Arabic (project default)
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale === 'en' || cookieLocale === 'ar' ? cookieLocale : defaultLocale;

  const url = request.nextUrl.clone();
  // /{locale}/live remains the existing scores page. Clean /live aliases
  // enter the isolated broadcast module without changing those score routes.
  const destination = pathname === '/live' || pathname.startsWith('/live/')
    ? `/watch${pathname.slice('/live'.length)}`
    : pathname;
  url.pathname = `/${locale}${destination === '/' ? '' : destination}`;
  const res = NextResponse.redirect(url);
  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
