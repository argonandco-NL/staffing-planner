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
    .select('id, role, person_id, created_at');
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
    };
  });

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth.response;

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: 'Admin operations not configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${request.nextUrl.origin}/auth/callback`,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
