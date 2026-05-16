import { NextResponse, type NextRequest } from 'next/server';
import { createProxySupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server';

/**
 * Auth gate for every request. Runs at the edge before any route renders.
 *
 * Behaviour:
 *  - If Supabase is not configured (no env vars), the app runs in mock mode
 *    and this is a no-op — handy for local dev without a backend.
 *  - Otherwise every request other than /login needs a valid Supabase
 *    session. Unauthenticated requests are redirected to /login, with the
 *    originally requested path preserved in a ?redirect query param.
 *  - Authenticated users hitting /login are bounced to /planning.
 *  - getUser() runs on every request so the session cookie stays fresh.
 *
 * Note: Next 16 renamed the `middleware` file convention to `proxy`.
 * The previous `middleware.ts` would still work but emits a deprecation warning.
 */
export async function proxy(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  if (!isSupabaseConfigured) return res;

  const supabase = createProxySupabaseClient(req, res);
  if (!supabase) return res;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === '/login';

  if (!user && !isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = '/planning';
    url.searchParams.delete('redirect');
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // Skip static assets and Next internals; everything else runs through the gate.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$).*)'],
};
