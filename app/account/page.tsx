'use client';

import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import { Button } from '@/components/ui/button';

export default function AccountPage() {
  const { email, role, loading } = useCurrentUser();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-md p-6">
        <h1 className="text-lg font-semibold text-slate-900">Account</h1>

        {!loading && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div>
              Signed in as <span className="font-medium text-slate-900">{email}</span>
            </div>
            {role && (
              <div className="mt-0.5">
                Role: <span className="font-medium text-slate-900 capitalize">{role}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <Link href="/account/change-password">
            <Button>Change password</Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
