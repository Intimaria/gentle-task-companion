import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // If the path starts with a locale, redirect to root but preserve locale in cookie
  if (pathname.startsWith('/es') || pathname.startsWith('/en')) {
    const locale = pathname.startsWith('/es') ? 'es' : 'en';
    const newPath = pathname.replace(/^\/(es|en)/, '') || '/';
    
    const response = NextResponse.redirect(new URL(newPath, request.url));
    response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
