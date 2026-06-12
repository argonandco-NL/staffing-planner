import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/requireRole';
import { createAdminClient } from '@/lib/supabase/admin';
import type { UserRole } from '@/types';

const VALID_ROLES: UserRole[] = ['user', 'admin', 'superadmin'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const role = body?.role as UserRole | undefined;
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: 'Admin operations not configured' }, { status: 503 });
  }

  // Only a superadmin may grant the superadmin role or edit an existing superadmin.
  if (auth.role !== 'superadmin') {
    if (role === 'superadmin') {
      return NextResponse.json({ error: 'Only a superadmin can grant superadmin' }, { status: 403 });
    }
    const { data: target } = await adminClient.from('profiles').select('role').eq('id', id).single();
    if (target?.role === 'superadmin') {
      return NextResponse.json({ error: 'Only a superadmin can edit a superadmin account' }, { status: 403 });
    }
  }

  const { error } = await adminClient.from('profiles').update({ role }).eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // Guard against locking yourself out.
  if (id === auth.userId) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: 'Admin operations not configured' }, { status: 503 });
  }

  // Only a superadmin may delete a superadmin account.
  const { data: target } = await adminClient.from('profiles').select('role').eq('id', id).single();
  if (target?.role === 'superadmin' && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Only a superadmin can delete a superadmin account' }, { status: 403 });
  }
  // Never delete the last remaining superadmin.
  if (target?.role === 'superadmin') {
    const { count } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'superadmin');
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last superadmin' }, { status: 400 });
    }
  }

  // Deleting the auth user cascades to the profiles row (FK on delete cascade).
  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
