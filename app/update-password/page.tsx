'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-inputs';

function UpdatePasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    const code = params.get('code');

    if (code) {
      // PKCE flow: exchange the code using the browser client, which has the
      // verifier in localStorage from when the reset email was requested.
      supabase.auth.exchangeCodeForSession(code).then(({ error: err }) => {
        if (err) {
          setError('This reset link has expired or has already been used. Please request a new one.');
        } else {
          setReady(true);
        }
      });
    } else {
      // Implicit flow fallback: Supabase puts the token in the URL hash and the
      // browser client fires PASSWORD_RECOVERY once it processes it.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') setReady(true);
      });
      // Also check whether a recovery session is already active (e.g. page refresh).
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setReady(true);
      });
      return () => subscription.unsubscribe();
    }
  }, [params]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!supabase) return;
    setSubmitting(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push('/planning'), 2000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Set new password</h1>
        <p className="mt-1 text-xs text-slate-500">Enter a new password for your account.</p>

        {error && !ready && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {!ready && !error && (
          <p className="mt-4 text-xs text-slate-400">Verifying reset link…</p>
        )}

        {done && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            Password updated successfully. Redirecting…
          </div>
        )}

        {ready && !done && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Saving…' : 'Update password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={null}>
      <UpdatePasswordForm />
    </Suspense>
  );
}
