'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import { addWeeks } from 'date-fns';
import { PlanningGrid } from './PlanningGrid';
import { PersonEditModal } from './PersonEditModal';
import { Button } from '@/components/ui/button';
import { UndoButton } from '@/components/ui/UndoButton';
import { getNext13Weeks } from '@/lib/dates/weeks';
import {
  getMockStore,
  upsertAssignment,
  deleteAssignment,
  upsertPerson,
  deletePerson,
  subscribeMockStore,
  getLastLoadError,
  reloadStore,
} from '@/lib/data/mock-store';
import { getPersonWeekStats } from '@/lib/calculations/staffing';
import type { StaffingStore, Assignment, Person } from '@/types';

export function PlanningBoard() {
  const [store, setStore] = useState<StaffingStore>(getMockStore());
  // weekOffset shifts the 13-week window: 0 = current week, negative = back, positive = forward.
  const [weekOffset, setWeekOffset] = useState(0);
  const weeks = getNext13Weeks(addWeeks(new Date(), weekOffset));

  // Person edit modal state — null = new person, otherwise editing existing.
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  // Surface Supabase load errors (the cache layer logs to console; this puts
  // the message in front of the user so silent failures are recoverable).
  const [loadError, setLoadError] = useState<string | null>(getLastLoadError());

  useEffect(() => {
    return subscribeMockStore(() => {
      setStore(getMockStore());
      setLoadError(getLastLoadError());
    });
  }, []);

  const handleRefresh = useCallback(() => {
    void reloadStore();
  }, []);

  const handleAssignmentChange = useCallback(
    (assignment: Assignment) => upsertAssignment(assignment),
    []
  );

  // Flag people whose assignments exceed their contract days in any visible
  // week — holidays are intentionally excluded so the warning reflects
  // structural over-staffing rather than calendar collisions with leave.
  const overAllocatedPeople = store.people.filter(
    (person) =>
      person.active &&
      weeks.some((week) =>
        getPersonWeekStats(person, week, store.assignments, []).isOverAllocated
      )
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <h1 className="text-base font-semibold text-slate-900">Planning Board</h1>

        {/* Week-window navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            onClick={() => setWeekOffset((o) => o - 1)}
            title="Shift one week earlier"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {weeks[0].label} – {weeks[weeks.length - 1].label}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            onClick={() => setWeekOffset((o) => o + 1)}
            title="Shift one week later"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 1 && (
            <button
              onClick={() => setWeekOffset(1)}
              className="ml-1 flex cursor-pointer items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] font-medium text-white hover:bg-slate-700 whitespace-nowrap"
              title="Jump to upcoming week"
            >
              <CalendarDays className="h-3 w-3" />
              upcoming week
            </button>
          )}

        </div>

        {overAllocatedPeople.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-2 py-1">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="text-xs font-medium text-red-700">
              {overAllocatedPeople.length} over-allocated (excl. holidays):{' '}
              {overAllocatedPeople.map((p) => p.name).join(', ')}
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <UndoButton />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingPerson(null);
              setPersonModalOpen(true);
            }}
            title="Add person"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            title="Refresh data from Supabase"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-1.5 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Could not load all data:</span>
          <span className="truncate">{loadError}</span>
          <button
            onClick={handleRefresh}
            className="ml-auto rounded border border-red-300 bg-white px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Grid (legend lives in the sidebar to keep this page vertically compact) */}
      <div className="flex-1 overflow-hidden">
        <PlanningGrid
          people={store.people}
          projects={store.projects}
          assignments={store.assignments}
          demands={store.projectDemands}
          exceptions={store.availabilityExceptions}
          weeks={weeks}
          onAssignmentUpdate={handleAssignmentChange}
          onAssignmentCreate={handleAssignmentChange}
          onAssignmentDelete={(id) => deleteAssignment(id)}
          onPersonEdit={(person) => {
            setEditingPerson(person);
            setPersonModalOpen(true);
          }}
        />
      </div>

      <PersonEditModal
        open={personModalOpen}
        person={editingPerson}
        onSave={(p) => {
          upsertPerson(p);
          setPersonModalOpen(false);
        }}
        onDelete={(id) => {
          deletePerson(id);
          setPersonModalOpen(false);
        }}
        onClose={() => setPersonModalOpen(false)}
      />
    </div>
  );
}
