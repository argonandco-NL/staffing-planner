'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  pointerWithin,
} from '@dnd-kit/core';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { WeekCell, CELL_W } from './WeekCell';
import { AssignmentSpan } from './AssignmentSpan';
import { OpenDemandPanel } from './OpenDemandPanel';
import { isoWeekId } from '@/lib/dates/weeks';
import { buildOpenDemandItems } from '@/lib/calculations/staffing';
import { overlapsWeek } from '@/lib/dates/weeks';
import type {
  Person,
  Project,
  Assignment,
  AvailabilityException,
  ProjectDemand,
  ISOWeek,
} from '@/types';

// ---------------------------------------------------------------------------
// Layout constants — keep in sync with Tailwind classes below
// ---------------------------------------------------------------------------
const PERSON_COL_W = 176; // w-44
export const ROW_H = 36;   // minimum row height
const HEADER_H = 40;       // sticky header row height
const LANE_H = 12;         // height of each assignment bar
const LANE_GAP = 2;        // vertical gap between stacked bars in the same row
const LANE_OFFSET = 4;     // top padding within row before first lane

function rowHeightForLanes(laneCount: number): number {
  // Enough room for the person label at top + all lanes + bottom padding
  return Math.max(ROW_H, LANE_OFFSET + laneCount * (LANE_H + LANE_GAP) + LANE_OFFSET);
}

// Each week column is treated as 5 working days (Mon–Fri); weekend dates
// clamp into the visible weekday range so a bar can still be drawn for them.
const DAY_W = CELL_W / 5;

function weekdayIndex(dateStr: string): number {
  // date-fns getDay: 0 = Sun, 1 = Mon, ..., 6 = Sat
  // We want Mon=0..Fri=4 and clamp Sat/Sun to 4 (= Fri).
  const dow = (parseISO(dateStr).getDay() + 6) % 7;
  return Math.min(dow, 4);
}

/**
 * Compute the left/width of a bar whose calendar range is [startDate, endDate]
 * over the visible `weeks` array. Returns null if the range doesn't overlap
 * the window at all. The bar starts at the actual weekday position within
 * the first overlapping week and ends at the actual weekday position within
 * the last overlapping week; a Mon→Fri week renders as 5 day-cells wide.
 */
function barGeometry(
  startDate: string,
  endDate: string,
  weeks: ISOWeek[]
): { left: number; width: number } | null {
  let firstIdx = -1;
  let lastIdx = -1;
  for (let i = 0; i < weeks.length; i++) {
    if (overlapsWeek(startDate, endDate, weeks[i])) {
      if (firstIdx === -1) firstIdx = i;
      lastIdx = i;
    }
  }
  if (firstIdx === -1 || lastIdx === -1) return null;

  const startsBeforeWindow = parseISO(startDate) < weeks[firstIdx].startDate;
  const endsAfterWindow = parseISO(endDate) > weeks[lastIdx].endDate;
  const startOffset = startsBeforeWindow ? 0 : weekdayIndex(startDate);
  // end is inclusive, so we span up to (endOffset + 1) day-cells
  const endOffsetExclusive = endsAfterWindow ? 5 : weekdayIndex(endDate) + 1;

  const left = firstIdx * CELL_W + startOffset * DAY_W + 2;
  const right = lastIdx * CELL_W + endOffsetExclusive * DAY_W - 2;
  return { left, width: Math.max(8, right - left) };
}

const ROLE_ORDER: Record<string, number> = {
  Partner: 0,
  'Associate Partner': 1,
  Principal: 2,
  Lead: 3,
  'Senior Consultant': 4,
  Consultant: 5,
};

function roleColorClass(role: string): string {
  const map: Record<string, string> = {
    Partner: 'bg-purple-100 text-purple-800',
    'Associate Partner': 'bg-violet-100 text-violet-800',
    Principal: 'bg-blue-100 text-blue-800',
    Lead: 'bg-teal-100 text-teal-800',
    'Senior Consultant': 'bg-green-100 text-green-800',
    Consultant: 'bg-slate-100 text-slate-700',
  };
  return map[role] ?? 'bg-slate-100 text-slate-700';
}

// ---------------------------------------------------------------------------
// Lane grouping — pack items into horizontal lanes so concurrent items in
// the same person row don't overlap visually. Generic over anything with
// startDate / endDate ISO strings.
// ---------------------------------------------------------------------------
function groupIntoLanes<T extends { startDate: string; endDate: string }>(items: T[]): T[][] {
  const sorted = [...items].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  const lanes: T[][] = [];
  for (const item of sorted) {
    const lane = lanes.find((l) =>
      l.every(
        (e) =>
          new Date(item.startDate) > new Date(e.endDate) ||
          new Date(item.endDate) < new Date(e.startDate)
      )
    );
    if (lane) lane.push(item);
    else lanes.push([item]);
  }
  return lanes;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PlanningGridProps {
  people: Person[];
  projects: Project[];
  assignments: Assignment[];
  demands: ProjectDemand[];
  exceptions: AvailabilityException[];
  weeks: ISOWeek[];
  onAssignmentUpdate: (a: Assignment) => void;
  onAssignmentCreate: (a: Assignment) => void;
  onPersonEdit?: (person: Person) => void;
}

export function PlanningGrid({
  people,
  projects,
  assignments,
  demands,
  exceptions,
  weeks,
  onAssignmentUpdate,
  onAssignmentCreate,
  onPersonEdit,
}: PlanningGridProps) {
  // Defer dnd-kit (which assigns sequential aria-describedby IDs) until after
  // hydration. Otherwise the server- and client-generated IDs diverge and
  // React logs a hydration mismatch warning.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Active people first (sorted by role seniority), inactive people at the
  // bottom so they're still visible / editable without cluttering the board.
  const sortedPeople = [...people].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
  });

  // Only show assignments for projects that have at least one demand defined.
  // A project with no demands is not yet configured for staffing and should
  // not appear on the board.
  const projectsWithDemands = new Set(demands.map((d) => d.projectId));
  const visibleAssignments = assignments.filter((a) =>
    projectsWithDemands.has(a.projectId)
  );

  // Pre-compute lanes and dynamic row heights per person.
  // Holiday bars sit in their own lanes above the assignment bars.
  const personRows = sortedPeople.map((person) => {
    const personAssignments = visibleAssignments.filter((a) => a.personId === person.id);
    const personHolidays = exceptions.filter((e) => e.personId === person.id);
    const holidayLanes = groupIntoLanes(personHolidays);
    const assignmentLanes = groupIntoLanes(personAssignments);
    const totalLanes = holidayLanes.length + assignmentLanes.length;
    const rowH = rowHeightForLanes(Math.max(1, totalLanes));
    return { person, holidayLanes, assignmentLanes, rowH };
  });

  // Cumulative top offsets for overlay positioning
  const rowTops: number[] = [];
  let cumTop = 0;
  for (const { rowH } of personRows) {
    rowTops.push(cumTop);
    cumTop += rowH;
  }
  const totalGridHeight = cumTop;

  const openDemandItems = buildOpenDemandItems(demands, projects, visibleAssignments);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current as
      | { type: 'assignment'; assignment: Assignment }
      | { type: 'demand'; demand: ProjectDemand; project: Project }
      | undefined;
    const dropData = over.data.current as
      | { type: 'cell'; personId: string; week: ISOWeek }
      | undefined;

    if (!dragData || !dropData || dropData.type !== 'cell') return;

    // Drag only re-assigns to a different person — dates stay locked to the
    // demand's dates (which are owned by the projects board).
    if (dragData.type === 'assignment') {
      const asgn = dragData.assignment;
      if (asgn.personId === dropData.personId) return;
      onAssignmentUpdate({
        ...asgn,
        personId: dropData.personId,
      });
    } else if (dragData.type === 'demand') {
      const { demand, project } = dragData;
      onAssignmentCreate({
        id: crypto.randomUUID(),
        personId: dropData.personId,
        projectId: project.id,
        projectDemandId: demand.id,
        assignedRole: demand.roleRequired,
        startDate: demand.startDate,
        endDate: demand.endDate,
        daysPerWeek: demand.daysPerWeek,
        status: 'tentative',
        billable: project.billable,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Total grid width: person column + all week columns
  const gridWidth = PERSON_COL_W + CELL_W * weeks.length;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
      <div className="flex h-full overflow-hidden">
        {/* Scrollable grid */}
        <div className="flex-1 overflow-auto">
          {/* Use position:relative so the overlay can be absolutely placed */}
          <div className="relative" style={{ width: gridWidth }}>
            <table
              className="border-collapse text-sm"
              style={{ tableLayout: 'fixed', width: gridWidth }}
            >
              {/* Sticky week header */}
              <thead>
                <tr
                  className="sticky top-0 z-20"
                  style={{ height: HEADER_H }}
                >
                  {/* Top-left corner — sticky on both axes */}
                  <th
                    className="sticky left-0 z-30 border-b border-r border-slate-200 bg-slate-50 px-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    style={{ width: PERSON_COL_W, minWidth: PERSON_COL_W }}
                  >
                    Person / Role
                  </th>
                  {weeks.map((week) => (
                    <th
                      key={isoWeekId(week)}
                      className="border-b border-r border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500"
                      style={{ width: CELL_W, minWidth: CELL_W }}
                    >
                      <div className="font-bold text-slate-700">W{week.week}</div>
                      <div className="text-[10px] font-normal text-slate-400">
                        {format(week.startDate, 'MMM d')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Person rows — no assignment rendering here */}
              <tbody>
                {personRows.map(({ person, rowH }) => (
                  <tr
                    key={person.id}
                    className={cn(
                      'group border-b border-slate-100',
                      !person.active && 'opacity-50 bg-slate-50'
                    )}
                    style={{ height: rowH }}
                  >
                    {/* Sticky person info cell */}
                    <td
                      className={cn(
                        'sticky left-0 z-10 border-r border-slate-200 px-3 align-middle',
                        person.active ? 'bg-white' : 'bg-slate-50'
                      )}
                      style={{ width: PERSON_COL_W, minWidth: PERSON_COL_W }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-xs font-medium text-slate-800 truncate leading-snug">
                          {person.name}
                          {!person.active && (
                            <span className="ml-1 text-[9px] font-normal italic text-slate-400">
                              (inactive)
                            </span>
                          )}
                        </div>
                        {onPersonEdit && (
                          <button
                            onClick={() => onPersonEdit(person)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Edit person"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={cn(
                            'inline-block rounded px-1 text-[9px] font-medium leading-4',
                            roleColorClass(person.role)
                          )}
                        >
                          {person.role}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {person.contractDaysPerWeek}d
                        </span>
                      </div>
                    </td>

                    {/* Week cells — only handle droppable, backgrounds, and capacity hints */}
                    {weeks.map((week) => (
                      <WeekCell
                        key={isoWeekId(week)}
                        person={person}
                        week={week}
                        allAssignments={visibleAssignments}
                        exceptions={exceptions}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ----------------------------------------------------------------
                Assignment overlay — absolutely positioned over the table body.
                Starts below the header row and to the right of the person column.
                Scrolls with the table since both are in the same overflow container.
            ---------------------------------------------------------------- */}
            <div
              className="absolute pointer-events-none overflow-hidden"
              style={{
                top: HEADER_H,
                left: PERSON_COL_W,
                width: CELL_W * weeks.length,
                height: totalGridHeight,
              }}
            >
              {mounted &&
                personRows.flatMap(({ person, holidayLanes, assignmentLanes }, personIdx) => {
                  const baseTop = rowTops[personIdx] + LANE_OFFSET;
                  const holidayNodes = holidayLanes.flatMap((lane, laneIdx) =>
                    lane.map((h) => {
                      const geom = barGeometry(h.startDate, h.endDate, weeks);
                      if (!geom) return null;
                      const top = baseTop + laneIdx * (LANE_H + LANE_GAP);
                      const days =
                        Math.round(
                          (parseISO(h.endDate).getTime() - parseISO(h.startDate).getTime()) /
                            86400000
                        ) + 1;
                      // Prefer the Ref text from the import (e.g. "Vakantie",
                      // "Training"). Fall back to the type when no notes.
                      const label = h.notes?.trim() || (h.type === 'holiday' ? 'Holiday' : h.type);
                      return (
                        <div
                          key={`holiday-${h.id}`}
                          title={`${person.name} — ${label}\n${format(parseISO(h.startDate), 'MMM d')} – ${format(parseISO(h.endDate), 'MMM d')} (${days} ${days === 1 ? 'day' : 'days'})`}
                          className="absolute flex items-center overflow-hidden rounded-sm select-none"
                          style={{
                            left: geom.left,
                            top,
                            width: geom.width,
                            height: LANE_H,
                            backgroundColor: '#facc15', // amber-400
                            color: '#78350f',
                            fontSize: 10,
                            fontWeight: 500,
                            paddingLeft: geom.width >= 60 ? 4 : 0,
                            paddingRight: geom.width >= 60 ? 4 : 0,
                          }}
                        >
                          {geom.width >= 60 && (
                            <span className="truncate">{label}</span>
                          )}
                        </div>
                      );
                    })
                  );
                  const assignmentNodes = assignmentLanes.flatMap((lane, laneIdx) =>
                    lane.map((asgn) => {
                      const project = projects.find((p) => p.id === asgn.projectId);
                      if (!project) return null;
                      const geom = barGeometry(asgn.startDate, asgn.endDate, weeks);
                      if (!geom) return null;
                      const top =
                        baseTop + (holidayLanes.length + laneIdx) * (LANE_H + LANE_GAP);
                      return (
                        <AssignmentSpan
                          key={asgn.id}
                          assignment={asgn}
                          project={project}
                          posStyle={{ left: geom.left, top, width: geom.width, height: LANE_H }}
                        />
                      );
                    })
                  );
                  return [...holidayNodes, ...assignmentNodes];
                })}
            </div>
          </div>
        </div>

        {/* Open demand panel — only after mount so dnd-kit draggables don't
            cause an SSR/CSR hydration mismatch. */}
        {mounted && <OpenDemandPanel items={openDemandItems} />}
      </div>

    </DndContext>
  );
}
