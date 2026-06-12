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
  passwordSetByUser: boolean;
}

const ROLES: UserRole[] = ['user', 'admin', 'superadmin'];

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { role: myRole, loading: meLoading } = useCurrentUser();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 10) {
      setError('Initial password must be at least 10 characters.');
      return;
    }
    setCreating(true);
    setError(null);
    setMessage(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail.trim(), password: newPassword }),
    });
    const body = await res.json().catch(() => null);
    setCreating(false);
    if (!res.ok) {
      setError(body?.error ?? 'Failed to create user');
      return;
    }
    setMessage(`Account created for ${newEmail.trim()}. Share the password with them directly.`);
    setNewEmail('');
    setNewPassword('');
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

  async function handleSetPassword(userId: string, email: string) {
    const password = window.prompt(
      `Enter a new password for ${email} (min 10 characters).\nThey can change it themselves afterwards.`
    );
    if (password === null) return; // cancelled
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    setPendingId(userId);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/users/${userId}/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const body = await res.json().catch(() => null);
    setPendingId(null);
    if (!res.ok) {
      setError(body?.error ?? 'Failed to set password');
      return;
    }
    setMessage(`Password updated for ${email}. Share it with them directly.`);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, passwordSetByUser: false } : u)));
  }

  async function handleDelete(userId: string, email: string) {
    if (!window.confirm(`Delete the account for ${email}? This cannot be undone.`)) return;
    setPendingId(userId);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    const body = await res.json().catch(() => null);
    setPendingId(null);
    if (!res.ok) {
      setError(body?.error ?? 'Failed to delete user');
      return;
    }
    setMessage(`Deleted ${email}.`);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  if (!meLoading && myRole !== 'admin' && myRole !== 'superadmin') {
    return null;
  }

  return (
    <AppShell>
      <div className="h-full overflow-auto">
        <div className="mx-auto w-full max-w-4xl p-6">
          <h1 className="text-lg font-semibold text-slate-900">User Management</h1>
          <p className="mt-1 text-xs text-slate-500">
            Create accounts directly with an initial password — no invitation emails are sent.
            Share the password with the user; they can change it under Account → Change password.
          </p>

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

          <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-2">
            <Input
              label="New user email"
              type="email"
              placeholder="name@example.com"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="max-w-xs"
            />
            <Input
              label="Initial password (min 10 chars)"
              type="text"
              autoComplete="off"
              placeholder="temporary password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="max-w-xs"
            />
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create account'}
            </Button>
          </form>

          <div className="mt-6 overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Password</th>
                  <th className="px-3 py-2">Last sign-in</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
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
                        <td className="px-3 py-2">
                          {u.passwordSetByUser ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                              Self-set
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Admin-set
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{formatDateTime(u.lastSignInAt)}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={pendingId === u.id}
                              onClick={() => handleSetPassword(u.id, u.email)}
                            >
                              Set password
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={pendingId === u.id}
                              className="border-red-200 text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(u.id, u.email)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
