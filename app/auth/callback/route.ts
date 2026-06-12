import { NextRequest, NextResponse } from 'next/server';

// Pass the PKCE code to the client-side update-password page so the browser
// Supabase client can exchange it — the browser holds the PKCE verifier in
// localStorage, the server-side client does not.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const dest = new URL('/update-password', origin);
    dest.searchParams.set('code', code);
    return NextResponse.redirect(dest);
  }

  return NextResponse.redirect(new URL('/login?error=invalid_link', origin));
}
