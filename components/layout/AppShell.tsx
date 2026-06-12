import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TempPasswordBanner } from './TempPasswordBanner';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <TempPasswordBanner />
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
