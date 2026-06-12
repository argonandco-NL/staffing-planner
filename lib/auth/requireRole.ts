import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { UserRole } from '@/types';

const ROLE_RANK: Record<UserRole, number> = { user: 0, admin: 1, superadmin: 2 };

type RequireRoleResult =
  | { ok: true; userId: string; email: string; role: UserRole }
  | { ok: false; response: NextResponse };

/**
 * Server-side authorization check for /api/admin/* route handlers.
 * The real security boundary — RLS on `profiles` backs this up, but this
 * is what returns a proper 401/403 to the client.
 */
export async function requireRole(minRole: UserRole): Promise<RequireRoleResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { ok: false, response: NextResponse.json({ error: 'Not configured' }, { status: 503 }) };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile?.role as UserRole | undefined) ?? 'user';

  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId: user.id, email: user.email ?? '', role };
}
