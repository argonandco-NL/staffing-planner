import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireRole';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: 'Admin operations not configured' }, { status: 503 });
  }

  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(id);
  if (userError || !userData.user?.email) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { error } = await adminClient.auth.resetPasswordForEmail(userData.user.email, {
    redirectTo: `${request.nextUrl.origin}/auth/callback`,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
