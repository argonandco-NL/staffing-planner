import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

// Called by /account/change-password after a user successfully changes their
// own password. Records that the current password is self-chosen so the admin
// user-management screen can show it. Requires only an authenticated session —
// the user can only ever flag their own profile.
export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    // Non-fatal: the password change itself already succeeded.
    return NextResponse.json({ ok: true, recorded: false });
  }

  await adminClient.from('profiles').update({ password_set_by_user: true }).eq('id', user.id);

  return NextResponse.json({ ok: true, recorded: true });
}
