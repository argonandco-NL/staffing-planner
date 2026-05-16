'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutGrid, FolderKanban, BarChart3, CalendarDays, FileUp, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

const NAV = [
  { href: '/planning', label: 'Planning Board', icon: LayoutGrid },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
  { href: '/holidays', label: 'Holidays', icon: CalendarDays },
  { href: '/import-export', label: 'Import / Export', icon: FileUp },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-slate-200 bg-slate-50">
      <div className="flex h-14 items-center border-b border-slate-200 px-4">
        <span className="text-sm font-bold text-slate-900 tracking-tight">Staffing Planner</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-200 p-3 space-y-2">
        {isSupabaseConfigured ? (
          <>
            {email && (
              <div className="px-1 text-[11px] text-slate-500 truncate" title={email}>
                Signed in as <span className="font-medium text-slate-700">{email}</span>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </>
        ) : (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs font-medium text-amber-800">Mock Mode</p>
            <p className="text-xs text-amber-700 mt-0.5">Supabase not configured. Using local seed data.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
