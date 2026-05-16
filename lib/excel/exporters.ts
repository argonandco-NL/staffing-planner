/**
 * Excel export utilities.
 *
 * Produces a single workbook with three sheets:
 *   1. "Projects"          — one row per project
 *   2. "Roles"             — one row per project demand (role required), with fill stats
 *   3. "Planning overview" — one row per (person × project assignment), plus weekly totals
 *
 * PRIVACY NOTICE: exported files contain staffing data. They are downloaded
 * directly to the user's machine — do not upload them anywhere public.
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type {
  Person,
  Project,
  ProjectDemand,
  Assignment,
  ISOWeek,
} from '@/types';
import { overlapsWeek, isoWeekId } from '@/lib/dates/weeks';
import { getStatusLabel } from '@/lib/ui/projectColors';

function buildProjectsSheet(projects: Project[]) {
  const rows = projects.map((p) => ({
    'Client': p.clientName,
    'Project': p.projectName,
    'Status': getStatusLabel(p.status),
    'Probability (%)': p.probability,
    'Start Date': p.startDate,
    'End Date': p.endDate,
    'Owner': p.ownerName ?? '',
    'Billable': p.billable ? 'Yes' : 'No',
    'Priority': p.priority,
    'Notes': p.notes ?? '',
  }));
  return XLSX.utils.json_to_sheet(rows);
}

function buildRolesSheet(
  demands: ProjectDemand[],
  projects: Project[],
  assignments: Assignment[],
  people: Person[]
) {
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const assignmentsByDemand = new Map<string, Assignment[]>();
  assignments.forEach((a) => {
    if (!a.projectDemandId) return;
    const list = assignmentsByDemand.get(a.projectDemandId) ?? [];
    list.push(a);
    assignmentsByDemand.set(a.projectDemandId, list);
  });

  const rows = demands.map((d) => {
    const project = projectsById.get(d.projectId);
    const filled = assignmentsByDemand.get(d.id) ?? [];
    const filledNames = filled.map((a) => peopleById.get(a.personId)?.name ?? '?').join(', ');
    return {
      'Client': project?.clientName ?? '',
      'Project': project?.projectName ?? '',
      'Role required': d.roleRequired,
      'Days / week': d.daysPerWeek,
      'Start Date': d.startDate,
      'End Date': d.endDate,
      'Quantity': d.quantity,
      'Filled': filled.length,
      'Open': Math.max(0, d.quantity - filled.length),
      'Assigned to': filledNames,
      'Notes': d.notes ?? '',
    };
  });
  return XLSX.utils.json_to_sheet(rows);
}

function buildPlanningSheet(
  people: Person[],
  projects: Project[],
  assignments: Assignment[],
  weeks: ISOWeek[]
) {
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  // One row per assignment, with a column per week showing days assigned in that week.
  const rows = assignments.map((a) => {
    const person = people.find((p) => p.id === a.personId);
    const project = projectsById.get(a.projectId);
    const weekCells: Record<string, number | ''> = {};
    weeks.forEach((w) => {
      const key = `${isoWeekId(w)} ${format(w.startDate, 'MMM d')}`;
      weekCells[key] = overlapsWeek(a.startDate, a.endDate, w) ? a.daysPerWeek : '';
    });
    return {
      'Person': person?.name ?? '',
      'Role (person)': person?.role ?? '',
      'Client': project?.clientName ?? '',
      'Project': project?.projectName ?? '',
      'Assigned role': a.assignedRole,
      'Status': a.status,
      'Start Date': a.startDate,
      'End Date': a.endDate,
      'Days / week': a.daysPerWeek,
      ...weekCells,
    };
  });

  // Sort by person name then start date for a stable, scannable export.
  rows.sort((x, y) => {
    const byName = String(x.Person).localeCompare(String(y.Person));
    if (byName !== 0) return byName;
    return String(x['Start Date']).localeCompare(String(y['Start Date']));
  });

  return XLSX.utils.json_to_sheet(rows);
}

/**
 * Build the workbook and trigger a browser download.
 */
export function exportFullWorkbook(
  people: Person[],
  projects: Project[],
  demands: ProjectDemand[],
  assignments: Assignment[],
  weeks: ISOWeek[]
): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildProjectsSheet(projects), 'Projects');
  XLSX.utils.book_append_sheet(
    wb,
    buildRolesSheet(demands, projects, assignments, people),
    'Roles'
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildPlanningSheet(people, projects, assignments, weeks),
    'Planning overview'
  );

  const stamp = format(new Date(), 'yyyy-MM-dd');
  XLSX.writeFile(wb, `staffing-planner-${stamp}.xlsx`);
}
