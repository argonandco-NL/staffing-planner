'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { getMockStore, subscribeMockStore } from '@/lib/data/mock-store';
import { Badge } from '@/components/ui/badge';
import type { StaffingStore } from '@/types';

// The schema doesn't expose a direct delete for exceptions today; importing one
// is the primary entry point. If the user wants to remove an entry, they can
// re-upload a sheet without it, or we can wire a deleteException action later.

function daysBetweenInclusive(startIso: string, endIso: string): number {
  return (
    Math.round(
      (parseISO(endIso).getTime() - parseISO(startIso).getTime()) / 86400000
    ) + 1
  );
}

export function HolidaysView() {
  const [store, setStore] = useState<StaffingStore>(getMockStore());
  useEffect(() => subscribeMockStore(() => setStore(getMockStore())), []);

  const peopleById = new Map(store.people.map((p) => [p.id, p]));

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = store.availabilityExceptions
    .filter((e) => e.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = store.availabilityExceptions
    .filter((e) => e.endDate < today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-base font-semibold text-slate-900">Holidays</h1>
        <span className="text-xs text-slate-400">
          {store.availabilityExceptions.length}{' '}
          {store.availabilityExceptions.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Empty state */}
        {store.availabilityExceptions.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-600 font-medium">No holidays on record</p>
            <p className="text-xs text-slate-400 mt-1">
              Use the Import / Export tab to upload a holiday-planning spreadsheet.
            </p>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Upcoming &amp; ongoing
            </h2>
            <HolidayTable
              rows={upcoming}
              peopleById={peopleById}
            />
          </section>
        )}

        {/* Past */}
        {past.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Past
            </h2>
            <HolidayTable
              rows={past}
              peopleById={peopleById}
              muted
            />
          </section>
        )}
      </div>
    </div>
  );
}

function HolidayTable({
  rows,
  peopleById,
  muted,
}: {
  rows: StaffingStore['availabilityExceptions'];
  peopleById: Map<string, StaffingStore['people'][number]>;
  muted?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Person</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Description</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Start</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">End</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Days</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const person = peopleById.get(e.personId);
            const days = daysBetweenInclusive(e.startDate, e.endDate);
            return (
              <tr
                key={e.id}
                className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                  muted ? 'opacity-60' : ''
                }`}
              >
                <td className="px-3 py-2 font-medium text-slate-800">
                  {person?.name ?? '—'}
                </td>
                <td className="px-3 py-2 text-xs">
                  <Badge variant="secondary">{e.notes?.trim() || e.type}</Badge>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {format(parseISO(e.startDate), 'EEE d MMM yyyy')}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {format(parseISO(e.endDate), 'EEE d MMM yyyy')}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600 tabular-nums">{days}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

