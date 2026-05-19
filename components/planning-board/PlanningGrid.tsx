'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  pointerWithin,
} from '@dnd-kit/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { WeekCell, CELL_W } from './WeekCell';
import { AssignmentSpan } from './AssignmentSpan';
import { OpenDemandPanel } from './OpenDemandPanel';
import { isoWeekId } from '@/lib/dates/weeks';
import { buildOpenDemandItems } from '@/lib/calculations/staffing';
import { overlapsWeek } from '@/lib/dates/weeks';
import { ROLE_ORDER } from '@/lib/constants/roles';
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
const PERSON_COL_W = 200; // a bit wider — single-line person info needs the horizontal room
const HEADER_H = 40;       // sticky header row height
const MIN_BAR_H = 4;       // minimum bar height so even 0.5d/wk assignments are visible
const HOLIDAY_H = 14;      // holiday bar height — tall enough to show label text
const HOLIDAY_SPACE = 5;   // px reserved at top of each row for holiday bars
const GROUP_HEADER_H = 24; // height of collapsible role-group header rows
const BAR_GAP = 1;         // px gap between vertically stacked assignment bars
const ROW_INSET = 2;       // px breathing room at top and bottom inside each row
const TARGET_ROWS = 24;    // number of people rows that should fit without scrolling
const FALLBACK_ROW_H = 36; // used before container height is measured

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

function roleTagClass(role: string): string {
  const map: Record<string, string> = {
    Partner:             'bg-slate-800 text-white',
    'Associate Partner': 'bg-slate-600 text-white',
    Principal:           'bg-slate-500 text-white',
    Lead:                'bg-slate-400 text-white',
    'Senior Consultant': 'bg-slate-300 text-slate-800',
    Consultant:          'bg-slate-200 text-slate-700',
  };
  return map[role] ?? 'bg-slate-200 text-slate-700';
}

function roleAbbrev(role: string): string {
  const map: Record<string, string> = {
    'Associate Partner': 'AP',
    'Senior Consultant': 'Sr Consultant',
  };
  return map[role] ?? role;
}

// ---------------------------------------------------------------------------
// Lane grouping — pack items into horizontal lanes so concurrent items in
// the same person row don't overlap visually. Generic over anything with
// startDate / endDate ISO strings.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Stack/height geometry for one assignment bar — shared by the overlay render
// and the per-person spillover precompute.
// ---------------------------------------------------------------------------
function computeBarLayout(
  asgn: Assignment,
  person: Person,
  assignmentLanes: Assignment[][],
  laneIdx: number,
  availableBarH: number,
): { stackOffset: number; barH: number } {
  const barH = Math.max(
    MIN_BAR_H,
    Math.round((asgn.daysPerWeek / person.contractDaysPerWeek) * availableBarH)
  );
  let stackOffset = ROW_INSET;
  for (let li = 0; li < laneIdx; li++) {
    const concurrent = assignmentLanes[li].find(
      (a) => a.endDate >= asgn.startDate && a.startDate <= asgn.endDate
    );
    if (concurrent) {
      stackOffset +=
        Math.max(
          MIN_BAR_H,
          Math.round((concurrent.daysPerWeek / person.contractDaysPerWeek) * availableBarH)
        ) + BAR_GAP;
    }
  }
  return { stackOffset, barH };
}

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
  onAssignmentUpdate: (a: Assignment) => Promise<{ error: { message: string } | null }> | void;
  onAssignmentCreate: (a: Assignment) => Promise<{ error: { message: string } | null }> | void;
  /** Called when a bar is dragged back onto the Open Demand panel. */
  onAssignmentDelete?: (id: string) => void;
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
  onAssignmentDelete,
  onPersonEdit,
}: PlanningGridProps) {
  // Defer dnd-kit (which assigns sequential aria-describedby IDs) until after
  // hydration. Otherwise the server- and client-generated IDs diverge and
  // React logs a hydration mismatch warning.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Dynamic row height: measure the scrollable container on mount and compute
  // a height that makes TARGET_ROWS fit without scrolling.
  const [rowH, setRowH] = useState(FALLBACK_ROW_H);
  const [partnersCollapsed, setPartnersCollapsed] = useState(true);
  // null = nothing selected; otherwise a project id or the '__holiday__' sentinel.
  // Set by clicking a bar; cleared by clicking anywhere else on the board.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Transient error banner shown when a drag-create fails server-side.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    const available = scrollRef.current.clientHeight - HEADER_H;
    setRowH(Math.max(24, Math.floor(available / TARGET_ROWS)));
  }, []);

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

  // Pre-compute lanes per person. Row heights are all equal (= rowH).
  const personRows = sortedPeople.map((person) => {
    const personAssignments = visibleAssignments.filter((a) => a.personId === person.id);
    const personHolidays = exceptions.filter((e) => e.personId === person.id);
    const holidayLanes = groupIntoLanes(personHolidays);
    const assignmentLanes = groupIntoLanes(personAssignments);
    return { person, holidayLanes, assignmentLanes };
  });

  // Split people into the collapsible Partners group and everyone else.
  const partners = sortedPeople.filter((p) => p.role === 'Partner');
  const others = sortedPeople.filter((p) => p.role !== 'Partner');

  // Per-person spillover height: when concurrent bars stack past the row bottom,
  // a grey spacer row of this height is inserted below the person row so the
  // overflowing bar doesn't bleed into the next person.
  const availableBarH = rowH - ROW_INSET * 2;
  const spilloverH: Record<string, number> = {};
  for (const row of personRows) {
    let maxBottom = 0;
    for (let laneIdx = 0; laneIdx < row.assignmentLanes.length; laneIdx++) {
      for (const asgn of row.assignmentLanes[laneIdx]) {
        const { stackOffset, barH } = computeBarLayout(
          asgn, row.person, row.assignmentLanes, laneIdx, availableBarH
        );
        if (stackOffset + barH > maxBottom) maxBottom = stackOffset + barH;
      }
    }
    const over = maxBottom - (rowH - ROW_INSET);
    if (over > 0) spilloverH[row.person.id] = over + ROW_INSET;
  }

  // Visual top of each person row, accounting for the group header row,
  // collapsed-Partners state, and per-person spillover spacer rows.
  const visualRowTops: Record<string, number> = {};
  let _rowTop = 0;
  if (partners.length > 0) {
    _rowTop += GROUP_HEADER_H;
    if (!partnersCollapsed) {
      for (const p of partners) {
        visualRowTops[p.id] = _rowTop;
        _rowTop += rowH + (spilloverH[p.id] ?? 0);
      }
    }
  }
  for (const p of others) {
    visualRowTops[p.id] = _rowTop;
    _rowTop += rowH + (spilloverH[p.id] ?? 0);
  }
  const totalGridHeight = _rowTop;

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
      | { type: 'demand-panel' }
      | undefined;

    if (!dragData || !dropData) return;

    // Drop on the Open Demand panel → un-assign (delete the assignment row).
    // Only meaningful for assignment drags; demand-card drops here are no-ops.
    if (dropData.type === 'demand-panel') {
      if (dragData.type === 'assignment' && onAssignmentDelete) {
        onAssignmentDelete(dragData.assignment.id);
      }
      return;
    }

    if (dropData.type !== 'cell') return;

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
      // Map project status → assignment status. Sold/internal/non-billable
      // projects are confirmed at creation; planned/proposal are tentative.
      // This matches the Supabase assignment_status enum and avoids producing
      // assignments whose status is inconsistent with the parent project.
      const status: Assignment['status'] =
        project.status === 'sold' ||
        project.status === 'internal' ||
        project.status === 'non_billable'
          ? 'confirmed'
          : 'tentative';

      const newAssignment: Assignment = {
        id: crypto.randomUUID(),
        personId: dropData.personId,
        projectId: project.id,
        projectDemandId: demand.id,
        assignedRole: demand.roleRequired,
        startDate: demand.startDate,
        endDate: demand.endDate,
        daysPerWeek: demand.daysPerWeek,
        status,
        // Defensive default — the schema requires NOT NULL boolean.
        billable: project.billable ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      void (async () => {
        try {
          const result = await onAssignmentCreate(newAssignment);
          if (result && result.error) {
            setErrorMessage(`Could not create assignment: ${result.error.message}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown error';
          setErrorMessage(`Could not create assignment: ${msg}`);
        }
      })();
    }
  }

  // Total grid width: person column + all week columns
  const gridWidth = PERSON_COL_W + CELL_W * weeks.length;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
      <div className="flex h-full overflow-hidden relative" onClick={() => setSelectedKey(null)}>
        {errorMessage && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 shadow">
            <span>{errorMessage}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setErrorMessage(null);
              }}
              className="ml-2 rounded px-1 text-red-600 hover:bg-red-100"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
        {/* Scrollable grid */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
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
                {/* Collapsible Partners group header */}
                {partners.length > 0 && (
                  <tr className="border-b border-slate-200" style={{ height: GROUP_HEADER_H }}>
                    <td
                      className="sticky left-0 z-10 border-r border-slate-200 bg-slate-100 px-3 align-middle"
                      style={{ width: PERSON_COL_W, minWidth: PERSON_COL_W }}
                    >
                      <button
                        onClick={() => setPartnersCollapsed((c) => !c)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                      >
                        {partnersCollapsed
                          ? <ChevronRight className="h-3 w-3 shrink-0" />
                          : <ChevronDown className="h-3 w-3 shrink-0" />
                        }
                        Partners
                        <span className="font-normal text-slate-400">({partners.length})</span>
                      </button>
                    </td>
                    {weeks.map((week) => (
                      <td key={isoWeekId(week)} className="border-r border-slate-100 bg-slate-100" />
                    ))}
                  </tr>
                )}
                {sortedPeople
                  .filter((p) => !(p.role === 'Partner' && partnersCollapsed))
                  .map((person) => (
                  <Fragment key={person.id}>
                  <tr
                    className={cn(
                      'group border-b border-slate-300',
                      !person.active && 'opacity-50 bg-slate-50'
                    )}
                    style={{ height: rowH }}
                  >
                    {/* Sticky person info cell — single-line layout for vertical density */}
                    <td
                      className={cn(
                        'sticky left-0 z-10 border-r border-slate-200 px-3 align-middle',
                        person.active ? 'bg-white' : 'bg-slate-50'
                      )}
                      style={{ width: PERSON_COL_W, minWidth: PERSON_COL_W }}
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <span className="text-[11px] font-medium text-slate-800 leading-snug min-w-0 flex-1">
                          {person.name}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 inline-block rounded px-1 text-[9px] font-medium leading-4',
                            roleTagClass(person.role)
                          )}
                        >
                          {roleAbbrev(person.role)}
                        </span>
                        <span className="shrink-0 text-[9px] text-slate-400">
                          {person.contractDaysPerWeek}d
                        </span>
                        {!person.active && (
                          <span className="shrink-0 text-[9px] font-normal italic text-slate-400">
                            (inactive)
                          </span>
                        )}
                        {onPersonEdit && (
                          <button
                            onClick={() => onPersonEdit(person)}
                            className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Edit person"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          </button>
                        )}
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
                  {/* Spillover spacer — absorbs over-allocation overflow without
                      bleeding into the next person's row. */}
                  {(spilloverH[person.id] ?? 0) > 0 && (
                    <tr
                      className="border-b border-slate-300 bg-slate-100"
                      style={{ height: spilloverH[person.id] }}
                    >
                      <td
                        className="sticky left-0 z-10 border-r border-slate-200 bg-slate-100"
                        style={{ width: PERSON_COL_W, minWidth: PERSON_COL_W }}
                      />
                      {weeks.map((week) => (
                        <td key={isoWeekId(week)} className="border-r border-slate-100 bg-slate-100" />
                      ))}
                    </tr>
                  )}
                  </Fragment>
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
                personRows
                  .filter(({ person }) => !(person.role === 'Partner' && partnersCollapsed))
                  .flatMap(({ person, holidayLanes, assignmentLanes }) => {
                  const rowTop = visualRowTops[person.id] ?? 0;

                  const assignmentNodes = assignmentLanes.flatMap((lane, laneIdx) =>
                    lane.map((asgn) => {
                      const project = projects.find((p) => p.id === asgn.projectId);
                      if (!project) return null;
                      const geom = barGeometry(asgn.startDate, asgn.endDate, weeks);
                      if (!geom) return null;

                      const { stackOffset, barH } = computeBarLayout(
                        asgn, person, assignmentLanes, laneIdx, availableBarH
                      );

                      const concurrentTotal = assignmentLanes.flat().reduce(
                        (sum, a) =>
                          a.endDate >= asgn.startDate && a.startDate <= asgn.endDate
                            ? sum + a.daysPerWeek
                            : sum,
                        0
                      );
                      const isOverCapacity = concurrentTotal > person.contractDaysPerWeek;
                      const dimmed = selectedKey !== null && selectedKey !== project.id;
                      const isNew = differenceInDays(new Date(), new Date(asgn.createdAt)) < 3;

                      return (
                        <AssignmentSpan
                          key={asgn.id}
                          assignment={asgn}
                          project={project}
                          isOverCapacity={isOverCapacity}
                          dimmed={dimmed}
                          isNew={isNew}
                          onSelect={() => setSelectedKey(project.id)}
                          posStyle={{ left: geom.left, top: rowTop + stackOffset, width: geom.width, height: barH }}
                        />
                      );
                    })
                  );

                  // Holidays render after assignments so they appear on top —
                  // important when a person is both on holiday and assigned.
                  const holidayNodes = holidayLanes.flatMap((lane, laneIdx) =>
                    lane.map((h) => {
                      const geom = barGeometry(h.startDate, h.endDate, weeks);
                      if (!geom) return null;
                      const top = rowTop + ROW_INSET + laneIdx * (HOLIDAY_H + 2);
                      const days =
                        Math.round(
                          (parseISO(h.endDate).getTime() - parseISO(h.startDate).getTime()) /
                            86400000
                        ) + 1;
                      const label = h.notes?.trim() || (h.type === 'holiday' ? 'Holiday' : h.type);
                      return (
                        <Tooltip
                          key={`holiday-${h.id}`}
                          content={`${person.name} — ${label}\n${format(parseISO(h.startDate), 'MMM d')} – ${format(parseISO(h.endDate), 'MMM d')} (${days} ${days === 1 ? 'day' : 'days'})`}
                          borderColor="#FDD8B5"
                        >
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedKey('__holiday__');
                            }}
                            className="absolute flex items-center overflow-hidden rounded-sm select-none"
                            style={{
                              left: geom.left,
                              top,
                              width: geom.width,
                              height: HOLIDAY_H,
                              backgroundColor: '#FDD8B5',
                              color: '#44403c',
                              fontSize: 10,
                              fontWeight: 500,
                              paddingLeft: geom.width >= 60 ? 4 : 0,
                              paddingRight: geom.width >= 60 ? 4 : 0,
                              pointerEvents: 'auto',
                              opacity: selectedKey !== null && selectedKey !== '__holiday__' ? 0.25 : undefined,
                              cursor: 'pointer',
                              transition: 'opacity 120ms ease',
                            }}
                          >
                            {geom.width >= 60 && <span className="truncate">{label}</span>}
                          </div>
                        </Tooltip>
                      );
                    })
                  );

                  return [...assignmentNodes, ...holidayNodes];
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
