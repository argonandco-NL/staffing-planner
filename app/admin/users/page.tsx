'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form-inputs';
import type { UserRole } from '@/types';

interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  personId: string | null;
  createdAt: string;
  lastSignInAt: string | null;
}

const ROLES: UserRole[] = ['user', 'admin', 'superadmin'];

export default function AdminUsersPage() {
  const router = useRouter();
  const { role: myRole, loading: meLoading } = useCurrentUser();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!meLoading && myRole !== 'admin' && myRole !== 'superadmin') {
      router.push('/planning');
    }
  }, [meLoading, myRole, router]);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/admin/users');
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error ?? 'Failed to load users');
      setLoading(false);
      return;
    }
    setUsers(body.users ?? []);
    setLoading(false);
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setMessage(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });
    const body = await res.json().catch(() => null);
    setInviting(false);
    if (!res.ok) {
      setError(body?.error ?? 'Failed to invite user');
      return;
    }
    setMessage(`Invitation sent to ${inviteEmail.trim()}.`);
    setInviteEmail('');
    void loadUsers();
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    setPendingId(userId);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const body = await res.json().catch(() => null);
    setPendingId(null);
    if (!res.ok) {
      setError(body?.error ?? 'Failed to update role');
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
  }

  async function handleResetPassword(userId: string, email: string) {
    setPendingId(userId);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
    const body = await res.json().catch(() => null);
    setPendingId(null);
    if (!res.ok) {
      setError(body?.error ?? 'Failed to send reset email');
      return;
    }
    setMessage(`Password reset email sent to ${email}.`);
  }

  if (!meLoading && myRole !== 'admin' && myRole !== 'superadmin') {
    return null;
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl p-6">
        <h1 className="text-lg font-semibold text-slate-900">User Management</h1>

        {error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            {message}
          </p>
        )}

        <form onSubmit={handleInvite} className="mt-4 flex items-end gap-2">
          <Input
            label="Invite user"
            type="email"
            placeholder="name@example.com"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={inviting}>
            {inviting ? 'Sending…' : 'Send invite'}
          </Button>
        </form>

        <div className="mt-6 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSuperadminRow = u.role === 'superadmin';
                  const roleSelectDisabled =
                    pendingId === u.id || (isSuperadminRow && myRole !== 'superadmin');

                  return (
                    <tr key={u.id}>
                      <td className="px-3 py-2 text-slate-900">{u.email}</td>
                      <td className="px-3 py-2">
                        <Select
                          value={u.role}
                          disabled={roleSelectDisabled}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="h-8 text-xs"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r} disabled={r === 'superadmin' && myRole !== 'superadmin'}>
                              {r}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingId === u.id}
                          onClick={() => handleResetPassword(u.id, u.email)}
                        >
                          Send password reset
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
