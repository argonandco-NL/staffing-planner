'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';

export const PASSWORD_CHANGED_KEY = 'staffing-planner:password-changed';

export function TempPasswordBanner() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(true);

  useEffect(() => {
    setPasswordChanged(localStorage.getItem(PASSWORD_CHANGED_KEY) === 'true');
  }, []);

  if (dismissed || passwordChanged || pathname === '/account/change-password') return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
      <span>
        If you are using a temporary password,{' '}
        <Link href="/account/change-password" className="font-medium underline hover:no-underline">
          please change it here
        </Link>
        .
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-600 hover:text-amber-900"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
