'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Users, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { addWeeks, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getMockStore, subscribeMockStore } from '@/lib/data/mock-store';
import { getNext13Weeks, overlapsWeek } from '@/lib/dates/weeks';
import {
  getPersonWeekStats,
  buildOpenDemandItems,
  getWeightedDemand,
} from '@/lib/calculations/staffing';
import type { StaffingStore, PersonRole } from '@/types';

// Same order used on the planning board so the team appears in a consistent
// sequence across both pages.
const ROLE_ORDER: Record<PersonRole, number> = {
  Partner: 0,
  'Associate Partner': 1,
  Principal: 2,
  Lead: 3,
  'Senior Consultant': 4,
  Consultant: 5,
};

function pct(n: number) {
  if (!isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

// Background + text colour for a utilisation cell
function utilCellStyle(utilPct: number | null, isOver: boolean) {
  if (utilPct === null) return 'bg-slate-50 text-slate-300';
  if (isOver) return 'bg-red-100 text-red-700 font-semibold';
  if (utilPct >= 80) return 'bg-green-100 text-green-800';
  if (utilPct >= 40) return 'bg-amber-50 text-amber-700';
  if (utilPct > 0) return 'bg-white text-slate-500';
  return 'bg-slate-50 text-slate-300';
}

export function InsightsDashboard() {
  const [store, setStore] = useState<StaffingStore>(getMockStore());
  useEffect(() => subscribeMockStore(() => setStore(getMockStore())), []);

  // The heatmap respects the week-shift arrows; the KPI cards below are
  // intentionally anchored to today so they always describe actual next week.
  const [weekOffset, setWeekOffset] = useState(0);
  const weeks = getNext13Weeks(addWeeks(new Date(), weekOffset));
  const activePeople = store.people.filter((p) => p.active);

  // ── Per-person × per-week utilisation (replaces the old per-role heatmap) ──
  const sortedPeople = [...store.people].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
  });

  const personWeekData = sortedPeople.map((person) => {
    const weekStats = weeks.map((w) => {
      const s = getPersonWeekStats(person, w, store.assignments, store.availabilityExceptions);
      const utilPct =
        s.availableDays > 0 ? Math.round((s.assignedDays / s.availableDays) * 100) : null;
      return { utilPct, isOver: s.isOverAllocated };
    });
    const valid = weekStats.filter((w) => w.utilPct !== null);
    const avgUtil =
      valid.length > 0
        ? Math.round(valid.reduce((sum, w) => sum + (w.utilPct ?? 0), 0) / valid.length)
        : null;
    return { person, weekStats, avgUtil };
  });

  // ── KPI window (anchored on today, not on weekOffset) ───────────────────────
  const anchorWeeks = getNext13Weeks();
  const nextWeek = anchorWeeks[1] ?? anchorWeeks[0];
  const nextFour = anchorWeeks.slice(1, 5);

  // Active people whose next week is over-allocated.
  const overAllocatedNext = activePeople.filter(
    (p) => getPersonWeekStats(p, nextWeek, store.assignments, store.availabilityExceptions).isOverAllocated
  ).length;

  // Under 40% in next week's available days (0% counts as under-allocated too).
  const underAllocatedNext = activePeople.filter((p) => {
    const s = getPersonWeekStats(p, nextWeek, store.assignments, store.availabilityExceptions);
    if (s.availableDays <= 0) return false;
    const u = (s.assignedDays / s.availableDays) * 100;
    return u < 40;
  }).length;

  // Open roles whose demand window covers next week.
  const openDemandItems = buildOpenDemandItems(
    store.projectDemands,
    store.projects,
    store.assignments
  );
  const openRolesNext = openDemandItems
    .filter((item) => overlapsWeek(item.demand.startDate, item.demand.endDate, nextWeek))
    .reduce((sum, item) => sum + item.openCount, 0);

  // Billable ratio = sold-project days over the next 4 weeks ÷ team contract capacity over the next 4 weeks.
  const projectsById = new Map(store.projects.map((p) => [p.id, p]));
  const soldDaysNext4 = store.assignments.reduce((sum, a) => {
    const proj = projectsById.get(a.projectId);
    if (!proj || proj.status !== 'sold') return sum;
    const overlapping = nextFour.reduce(
      (n, w) => (overlapsWeek(a.startDate, a.endDate, w) ? n + 1 : n),
      0
    );
    return sum + overlapping * a.daysPerWeek;
  }, 0);
  const capacityDaysNext4 = activePeople.reduce((sum, p) => sum + p.contractDaysPerWeek * 4, 0);
  const billablePct = capacityDaysNext4 > 0 ? (soldDaysNext4 / capacityDaysNext4) * 100 : 0;

  // ── Pipeline (kept on the visible 13-week window) ───────────────────────────
  const soldDays = store.projects
    .filter((p) => p.status === 'sold')
    .flatMap((p) => store.projectDemands.filter((d) => d.projectId === p.id))
    .reduce(
      (sum, d) =>
        sum +
        d.daysPerWeek *
          weeks.filter((w) => overlapsWeek(d.startDate, d.endDate, w)).length,
      0
    );

  const weightedPipelineDays = store.projects
    .filter((p) => p.status === 'planned' || p.status === 'proposal')
    .flatMap((p) =>
      store.projectDemands.filter((d) => d.projectId === p.id).map((d) => ({ d, p }))
    )
    .reduce((sum, { d, p }) => {
      const wks = weeks.filter((w) => overlapsWeek(d.startDate, d.endDate, w)).length;
      return sum + getWeightedDemand(d.daysPerWeek, p.probability) * wks;
    }, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-base font-semibold text-slate-900">Insights</h1>
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
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* KPI cards — anchored on next week / next 4 weeks from today */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
            label="Over-allocated next week"
            value={String(overAllocatedNext)}
            sub={`people in W${nextWeek.week}`}
            accent="red"
          />
          <KpiCard
            icon={<Users className="h-4 w-4 text-amber-500" />}
            label="Under-allocated next week"
            value={String(underAllocatedNext)}
            sub={`< 40% utilisation in W${nextWeek.week}`}
            accent="amber"
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4 text-slate-500" />}
            label="Open roles next week"
            value={String(openRolesNext)}
            sub={`unfilled in W${nextWeek.week}`}
            accent="neutral"
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4 text-green-500" />}
            label="Billable ratio (next 4 wks)"
            value={pct(billablePct)}
            sub={`${Math.round(soldDaysNext4)}d sold of ${Math.round(capacityDaysNext4)}d capacity`}
            accent="green"
          />
        </div>

        {/* Per-person utilisation heatmap */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Utilisation by person — next 13 weeks
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-medium text-slate-500 min-w-[180px]">
                    Person
                  </th>
                  {weeks.map((w) => (
                    <th
                      key={`${w.year}-${w.week}`}
                      className="px-1 py-2 text-center font-medium text-slate-500 min-w-[52px]"
                    >
                      <div className="font-bold text-slate-600">W{w.week}</div>
                      <div className="text-[9px] font-normal text-slate-400">
                        {format(w.startDate, 'MMM d')}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium text-slate-500 min-w-[56px] border-l border-slate-200">
                    Avg
                  </th>
                </tr>
              </thead>
              <tbody>
                {personWeekData.map(({ person, weekStats, avgUtil }) => (
                  <tr
                    key={person.id}
                    className={cn(
                      'border-b border-slate-100',
                      !person.active && 'opacity-60'
                    )}
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-1 font-medium text-slate-700 border-r border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span>{person.name}</span>
                        <span className="text-[10px] font-normal text-slate-400">
                          {person.role}
                        </span>
                      </div>
                    </td>
                    {weekStats.map((ws, wi) => (
                      <td
                        key={wi}
                        className={cn(
                          'px-1 py-1 text-center tabular-nums',
                          utilCellStyle(ws.utilPct, ws.isOver)
                        )}
                      >
                        {ws.utilPct !== null ? `${ws.utilPct}%` : '—'}
                      </td>
                    ))}
                    <td
                      className={cn(
                        'px-3 py-1 text-center font-semibold tabular-nums border-l border-slate-200',
                        avgUtil !== null
                          ? utilCellStyle(avgUtil, avgUtil > 100)
                          : 'text-slate-300'
                      )}
                    >
                      {avgUtil !== null ? `${avgUtil}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Green ≥ 80% · Amber 40–79% · White &lt; 40% · Red = over-allocated
          </p>
        </section>

        {/* Open demand by role */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Open demand by role
          </h2>
          {openDemandItems.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-700 font-medium">All project roles are staffed</span>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Project</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Role needed</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">d/wk</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Open</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Start</th>
                  </tr>
                </thead>
                <tbody>
                  {openDemandItems.map(({ demand, project, openCount }) => (
                    <tr key={demand.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800 text-xs">
                        {project.clientName} — {project.projectName}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">{demand.roleRequired}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{demand.daysPerWeek}</td>
                      <td className="px-3 py-2">
                        <Badge variant="destructive">{openCount}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {new Date(demand.startDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Pipeline */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Demand pipeline (next 13 weeks)
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-2xl font-bold text-green-600">{Math.round(soldDays)}d</div>
              <div className="text-xs text-slate-500 mt-0.5">Sold demand (total days)</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-2xl font-bold text-blue-600">{Math.round(weightedPipelineDays)}d</div>
              <div className="text-xs text-slate-500 mt-0.5">Weighted pipeline (probability-adjusted days)</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: 'red' | 'amber' | 'green' | 'neutral';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-4',
        accent === 'red'
          ? 'border-red-200'
          : accent === 'amber'
          ? 'border-amber-200'
          : accent === 'green'
          ? 'border-green-200'
          : 'border-slate-200'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}
