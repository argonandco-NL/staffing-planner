import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

/**
 * Server-side Supabase client for use inside Next.js proxy (formerly middleware).
 * Reads/writes the session cookie via the NextRequest/NextResponse pair
 * so the auth state stays in sync between server and browser.
 */
export function createProxySupabaseClient(req: NextRequest, res: NextResponse) {
  if (!isSupabaseConfigured) return null;
  return createServerClient(url!, key!, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set({ name, value, ...options });
        });
      },
    },
  });
}
