'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-inputs';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Authentication is not configured on this deployment.');
      return;
    }
    setSubmitting(true);
    setError(null);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setSubmitting(false);
    // Always show the same message, whether or not the account exists,
    // to avoid leaking which emails have accounts.
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-xs text-slate-500">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>

        {!isSupabaseConfigured && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Supabase is not configured on this deployment.
          </div>
        )}

        {sent ? (
          <div className="mt-5 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            If an account exists for that email, a reset link has been sent.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !isSupabaseConfigured}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <Link href="/login" className="mt-4 block text-center text-xs text-slate-500 hover:text-slate-700">
          Back to login
        </Link>
      </div>
    </div>
  );
}
