'use client';

import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

/**
 * Browser-side Supabase client. Shares its session cookie with the
 * server-side client used in middleware so auth state stays in sync.
 * Returns null when env vars are missing — callers fall back to the mock store.
 */
export const supabase = isSupabaseConfigured
  ? createBrowserClient(url!, key!)
  : null;
