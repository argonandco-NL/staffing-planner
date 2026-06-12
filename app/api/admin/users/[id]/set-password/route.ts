import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireRole';
import { createAdminClient } from '@/lib/supabase/admin';

// Admin directly sets a new password for a user (no email round-trip). The
// admin never sees the existing password; they can only overwrite it. The new
// password counts as admin-set, so password_set_by_user is reset to false.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (password.length < 10) {
    return NextResponse.json({ error: 'Password must be at least 10 characters' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: 'Admin operations not configured' }, { status: 503 });
  }

  // Only a superadmin may set a superadmin's password.
  if (auth.role !== 'superadmin') {
    const { data: target } = await adminClient.from('profiles').select('role').eq('id', id).single();
    if (target?.role === 'superadmin') {
      return NextResponse.json({ error: 'Only a superadmin can set a superadmin password' }, { status: 403 });
    }
  }

  const { error } = await adminClient.auth.admin.updateUserById(id, { password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Mark as admin-set so the management screen shows the user hasn't chosen
  // their own password yet.
  await adminClient.from('profiles').update({ password_set_by_user: false }).eq('id', id);

  return NextResponse.json({ ok: true });
}
