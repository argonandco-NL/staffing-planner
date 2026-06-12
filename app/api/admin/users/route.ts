import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireRole';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth.response;

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: 'Admin operations not configured' }, { status: 503 });
  }

  const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({ perPage: 200 });
  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id, role, person_id, created_at, password_set_by_user');
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const users = usersData.users.map((u) => {
    const profile = profileById.get(u.id);
    return {
      id: u.id,
      email: u.email ?? '',
      role: profile?.role ?? 'user',
      personId: profile?.person_id ?? null,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      passwordSetByUser: profile?.password_set_by_user ?? false,
    };
  });

  return NextResponse.json({ users });
}

// Create a user account directly (no invitation email). The admin supplies an
// initial password; the account is created pre-confirmed so the user can sign
// in immediately. Email delivery is intentionally avoided — invite/confirmation
// links were not arriving in our environment.
export async function POST(request: NextRequest) {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth.response;

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: 'Admin operations not configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json({ error: 'Password must be at least 10 characters' }, { status: 400 });
  }

  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
