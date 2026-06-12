'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { UserRole } from '@/types';

interface CurrentUser {
  loading: boolean;
  email: string | null;
  role: UserRole | null;
}

/**
 * Client-side hook exposing the signed-in user's email and role (from
 * `profiles`). Returns role `null` while loading or when signed out —
 * used for conditional UI only. Real authorization happens server-side
 * via RLS and requireRole().
 */
export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<CurrentUser>({ loading: true, email: null, role: null });

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setState({ loading: false, email: null, role: null });
      return;
    }

    let cancelled = false;

    void client.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) {
        if (!cancelled) setState({ loading: false, email: null, role: null });
        return;
      }

      const { data: profile } = await client
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!cancelled) {
        setState({ loading: false, email: user.email ?? null, role: (profile?.role as UserRole) ?? 'user' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
