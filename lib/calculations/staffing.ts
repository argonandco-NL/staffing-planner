import type {
  Person,
  Assignment,
  AvailabilityException,
  ISOWeek,
  PersonWeekStats,
  ProjectDemand,
  Project,
  OpenDemandItem,
} from '@/types';
import { overlapsWeek } from '@/lib/dates/weeks';

export function getUnavailableDays(
  person: Person,
  week: ISOWeek,
  exceptions: AvailabilityException[]
): number {
  const total = exceptions
    .filter((e) => e.personId === person.id && overlapsWeek(e.startDate, e.endDate, week))
    .reduce((sum, e) => sum + e.unavailableDaysPerWeek, 0);
  return Math.min(total, person.contractDaysPerWeek);
}

export function getAvailableDays(
  person: Person,
  week: ISOWeek,
  exceptions: AvailabilityException[]
): number {
  const unavailable = getUnavailableDays(person, week, exceptions);
  return Math.max(0, person.contractDaysPerWeek - unavailable);
}

export function getAssignedDays(
  personId: string,
  week: ISOWeek,
  assignments: Assignment[]
): number {
  return assignments
    .filter((a) => a.personId === personId && overlapsWeek(a.startDate, a.endDate, week))
    .reduce((sum, a) => sum + a.daysPerWeek, 0);
}

export function getPersonWeekStats(
  person: Person,
  week: ISOWeek,
  assignments: Assignment[],
  exceptions: AvailabilityException[]
): PersonWeekStats {
  const unavailableDays = getUnavailableDays(person, week, exceptions);
  const availableDays = getAvailableDays(person, week, exceptions);
  const assignedDays = getAssignedDays(person.id, week, assignments);
  const remainingDays = Math.max(0, availableDays - assignedDays);
  const utilization = availableDays > 0 ? (assignedDays / availableDays) * 100 : assignedDays > 0 ? Infinity : 0;

  return {
    personId: person.id,
    week,
    contractDays: person.contractDaysPerWeek,
    unavailableDays,
    availableDays,
    assignedDays,
    remainingDays,
    utilization,
    isOverAllocated: assignedDays > availableDays,
  };
}

export function getWeightedDemand(daysPerWeek: number, probability: number): number {
  return daysPerWeek * (probability / 100);
}

// Lower index = higher priority. Used to sort the open-demand panel:
// sold first, then planned/proposal (sorted by probability inside that group),
// then internal/non-billable last.
const STATUS_PRIORITY: Record<string, number> = {
  sold: 0,
  planned: 1,
  proposal: 1,
  internal: 2,
  non_billable: 2,
};

// Role seniority: lower index = more senior. Used as the secondary sort key.
const ROLE_SENIORITY: Record<string, number> = {
  Partner: 0,
  'Associate Partner': 1,
  Principal: 2,
  Lead: 3,
  'Senior Consultant': 4,
  Consultant: 5,
};

export function buildOpenDemandItems(
  demands: ProjectDemand[],
  projects: Project[],
  assignments: Assignment[]
): OpenDemandItem[] {
  const items = demands
    .map((demand) => {
      const project = projects.find((p) => p.id === demand.projectId);
      if (!project) return null;
      const filledCount = assignments.filter((a) => a.projectDemandId === demand.id).length;
      const openCount = Math.max(0, demand.quantity - filledCount);
      return { demand, project, filledCount, openCount };
    })
    .filter((item): item is OpenDemandItem => item !== null && item.openCount > 0);

  items.sort((a, b) => {
    const pa = STATUS_PRIORITY[a.project.status] ?? 99;
    const pb = STATUS_PRIORITY[b.project.status] ?? 99;
    if (pa !== pb) return pa - pb;
    // Within the planned/proposal bucket, higher probability comes first.
    if (pa === 1 && a.project.probability !== b.project.probability) {
      return b.project.probability - a.project.probability;
    }
    // Secondary: role seniority.
    const ra = ROLE_SENIORITY[a.demand.roleRequired] ?? 99;
    const rb = ROLE_SENIORITY[b.demand.roleRequired] ?? 99;
    if (ra !== rb) return ra - rb;
    // Tertiary: earliest start date so urgent items float up.
    return a.demand.startDate.localeCompare(b.demand.startDate);
  });

  return items;
}

export function isUrgentDemand(demand: ProjectDemand): boolean {
  const start = new Date(demand.startDate);
  const now = new Date();
  const twoWeeks = 14 * 24 * 60 * 60 * 1000;
  return start.getTime() - now.getTime() <= twoWeeks;
}
