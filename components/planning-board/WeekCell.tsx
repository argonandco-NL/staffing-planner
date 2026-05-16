'use client';

import { useDroppable, useDndContext } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { Assignment, AvailabilityException, ISOWeek, Person, Project, ProjectDemand } from '@/types';
import { getPersonWeekStats } from '@/lib/calculations/staffing';
import { isoWeekId, overlapsWeek } from '@/lib/dates/weeks';

export const CELL_W = 110;

interface WeekCellProps {
  person: Person;
  week: ISOWeek;
  allAssignments: Assignment[];
  exceptions: AvailabilityException[];
}

export function WeekCell({ person, week, allAssignments, exceptions }: WeekCellProps) {
  const droppableId = `cell:${person.id}:${isoWeekId(week)}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: 'cell', personId: person.id, week },
  });

  // Drag preview: highlight every week in this person's row that falls inside
  // the dragged demand/assignment's date range — so the user can see exactly
  // where the bar will land before they release.
  const dnd = useDndContext();
  const activeData = dnd.active?.data.current as
    | { type: 'assignment'; assignment: Assignment }
    | { type: 'demand'; demand: ProjectDemand; project: Project }
    | undefined;
  const overData = dnd.over?.data.current as
    | { type: 'cell'; personId: string; week: ISOWeek }
    | undefined;

  let isInDragPreview = false;
  if (activeData && overData?.personId === person.id) {
    const range =
      activeData.type === 'assignment'
        ? { start: activeData.assignment.startDate, end: activeData.assignment.endDate }
        : { start: activeData.demand.startDate, end: activeData.demand.endDate };
    isInDragPreview = overlapsWeek(range.start, range.end, week);
  }

  const stats = getPersonWeekStats(person, week, allAssignments, exceptions);

  const utilPct = stats.availableDays > 0
    ? Math.round((stats.assignedDays / stats.availableDays) * 100)
    : 0;

  // Utilization bar color: slate → amber → green → red
  const barColor = stats.isOverAllocated
    ? '#ef4444'
    : utilPct >= 80 ? '#22c55e'
    : utilPct >= 40 ? '#f59e0b'
    : '#cbd5e1';

  return (
    <td
      ref={setNodeRef}
      className={cn(
        'relative border-r border-slate-100 p-0 align-top',
        stats.isOverAllocated && 'bg-red-50',
        // While dragging, every week the bar will cover lights up — not just
        // the single cell under the cursor.
        isInDragPreview && 'bg-blue-50',
        isOver && 'ring-1 ring-inset ring-blue-400'
      )}
      style={{ width: CELL_W, minWidth: CELL_W, maxWidth: CELL_W }}
    >
      {/* Over-allocation ring */}
      {stats.isOverAllocated && (
        <div className="absolute inset-0 ring-1 ring-inset ring-red-300 pointer-events-none" />
      )}

      {/* Utilization bar — thin strip at bottom, width = utilisation % */}
      {stats.assignedDays > 0 && (
        <div
          className="absolute bottom-0 left-0 h-[3px] pointer-events-none z-10"
          style={{
            width: `${Math.min(utilPct, 100)}%`,
            backgroundColor: barColor,
          }}
        />
      )}

      {/* Over-allocation warning icon */}
      {stats.isOverAllocated && (
        <div className="absolute bottom-1 right-1 z-10 text-[9px] leading-none pointer-events-none text-red-500 font-semibold">
          ⚠
        </div>
      )}
    </td>
  );
}
