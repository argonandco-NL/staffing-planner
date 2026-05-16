'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import { addWeeks } from 'date-fns';
import { PlanningGrid } from './PlanningGrid';
import { PersonEditModal } from './PersonEditModal';
import { Button } from '@/components/ui/button';
import { UndoButton } from '@/components/ui/UndoButton';
import { getNext13Weeks } from '@/lib/dates/weeks';
import {
  getMockStore,
  upsertAssignment,
  upsertPerson,
  deletePerson,
  subscribeMockStore,
} from '@/lib/data/mock-store';
import { getPersonWeekStats } from '@/lib/calculations/staffing';
import { LEGEND_ITEMS } from '@/lib/ui/projectColors';
import type { StaffingStore, Assignment, Person } from '@/types';

export function PlanningBoard() {
  const [store, setStore] = useState<StaffingStore>(getMockStore());
  // weekOffset shifts the 13-week window: 0 = current week, negative = back, positive = forward.
  const [weekOffset, setWeekOffset] = useState(0);
  const weeks = getNext13Weeks(addWeeks(new Date(), weekOffset));

  // Person edit modal state — null = new person, otherwise editing existing.
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  useEffect(() => {
    return subscribeMockStore(() => setStore(getMockStore()));
  }, []);

  const handleAssignmentChange = useCallback((assignment: Assignment) => {
    upsertAssignment(assignment);
  }, []);

  const overAllocatedCount = store.people.filter((person) =>
    person.active &&
    weeks.some((week) =>
      getPersonWeekStats(person, week, store.assignments, store.availabilityExceptions).isOverAllocated
    )
  ).length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-base font-semibold text-slate-900">Planning Board</h1>

        {/* Week-window navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
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
            onClick={() => setWeekOffset((o) => o + 1)}
            title="Shift one week later"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-[10px] text-blue-600 hover:underline ml-1"
              title="Snap back to current week"
            >
              today
            </button>
          )}
        </div>

        {overAllocatedCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-2 py-1">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs font-medium text-red-700">
              {overAllocatedCount} over-allocated {overAllocatedCount === 1 ? 'person' : 'people'}
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
            onClick={() => setStore(getMockStore())}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-1.5">
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Legend:</span>
        {LEGEND_ITEMS.map(({ label, style }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded-sm" style={style} />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#facc15' }} />
          <span className="text-[10px] text-slate-500">Holiday</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-sm bg-red-200 ring-1 ring-red-400" />
          <span className="text-[10px] text-slate-500">Over-allocated</span>
        </div>
      </div>

      {/* Grid */}
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
