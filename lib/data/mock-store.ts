'use client';

/**
 * Data layer entry point. When `NEXT_PUBLIC_SUPABASE_URL` and the anon key
 * are present, every call delegates to `supabase-store.ts` (real database).
 * Otherwise it operates on in-memory arrays seeded from `seed/data.ts`,
 * which is the convenient mode for local development.
 *
 * The exported surface (getMockStore, subscribeMockStore, upsertX, deleteX,
 * canUndo, undoLastAction) is identical in both modes so components don't
 * need to know which backend is active.
 */

import { isSupabaseConfigured } from '@/lib/supabase/client';
import * as supa from './supabase-store';
import {
  SEED_PEOPLE,
  SEED_PROJECTS,
  SEED_PROJECT_DEMANDS,
  SEED_ASSIGNMENTS,
  SEED_AVAILABILITY_EXCEPTIONS,
} from '@/seed/data';
import type {
  Person,
  Project,
  ProjectDemand,
  Assignment,
  AvailabilityException,
  StaffingStore,
} from '@/types';

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

// ---------------------------------------------------------------------------
// In-memory state for mock mode
// ---------------------------------------------------------------------------
let _people: Person[] = deepClone(SEED_PEOPLE);
let _projects: Project[] = deepClone(SEED_PROJECTS);
let _demands: ProjectDemand[] = deepClone(SEED_PROJECT_DEMANDS);
let _assignments: Assignment[] = deepClone(SEED_ASSIGNMENTS);
let _exceptions: AvailabilityException[] = deepClone(SEED_AVAILABILITY_EXCEPTIONS);

type Listener = () => void;
const mockListeners = new Set<Listener>();
function notifyMock() {
  mockListeners.forEach((l) => l());
}

// ---------------------------------------------------------------------------
// Undo history — up to 5 snapshots, works in both modes
// ---------------------------------------------------------------------------
const MAX_HISTORY = 5;
const _history: StaffingStore[] = [];

function currentStore(): StaffingStore {
  if (isSupabaseConfigured) return supa.getStore();
  return {
    people: _people,
    projects: _projects,
    projectDemands: _demands,
    assignments: _assignments,
    availabilityExceptions: _exceptions,
  };
}

function pushHistory() {
  _history.push(deepClone(currentStore()));
  if (_history.length > MAX_HISTORY) _history.shift();
}

export function canUndo(): boolean {
  return _history.length > 0;
}

export function undoLastAction(): void {
  const snapshot = _history.pop();
  if (!snapshot) return;
  if (isSupabaseConfigured) {
    supa.restoreSnapshot(snapshot);
    return;
  }
  _people = snapshot.people;
  _projects = snapshot.projects;
  _demands = snapshot.projectDemands;
  _assignments = snapshot.assignments;
  _exceptions = snapshot.availabilityExceptions;
  notifyMock();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function subscribeMockStore(listener: Listener): () => void {
  if (isSupabaseConfigured) return supa.subscribeStore(listener);
  mockListeners.add(listener);
  return () => {
    mockListeners.delete(listener);
  };
}

/** Surface load errors from Supabase. Always returns null in mock mode. */
export function getLastLoadError(): string | null {
  if (isSupabaseConfigured) return supa.getLastLoadError();
  return null;
}

/** Force a refetch. No-op in mock mode (seed data is always in memory). */
export function reloadStore(): Promise<void> {
  if (isSupabaseConfigured) return supa.reloadStore();
  return Promise.resolve();
}

export function getMockStore(): StaffingStore {
  if (isSupabaseConfigured) return supa.getStore();
  return {
    people: deepClone(_people),
    projects: deepClone(_projects),
    projectDemands: deepClone(_demands),
    assignments: deepClone(_assignments),
    availabilityExceptions: deepClone(_exceptions),
  };
}

// ---------- Assignments ----------

export async function upsertAssignment(
  assignment: Assignment
): Promise<{ error: { message: string } | null }> {
  pushHistory();
  if (isSupabaseConfigured) return supa.upsertAssignment(assignment);
  const idx = _assignments.findIndex((a) => a.id === assignment.id);
  if (idx >= 0) {
    _assignments[idx] = { ...assignment, updatedAt: new Date().toISOString() };
  } else {
    _assignments.push({
      ...assignment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  notifyMock();
  return { error: null };
}

export function deleteAssignment(id: string): void {
  pushHistory();
  if (isSupabaseConfigured) return supa.deleteAssignment(id);
  _assignments = _assignments.filter((a) => a.id !== id);
  notifyMock();
}

export function moveAssignment(
  id: string,
  updates: Partial<Pick<Assignment, 'personId' | 'startDate' | 'endDate' | 'daysPerWeek'>>
): void {
  pushHistory();
  if (isSupabaseConfigured) return supa.moveAssignment(id, updates);
  const idx = _assignments.findIndex((a) => a.id === id);
  if (idx < 0) return;
  _assignments[idx] = { ..._assignments[idx], ...updates, updatedAt: new Date().toISOString() };
  notifyMock();
}

// ---------- Projects ----------

export function upsertProject(project: Project): void {
  pushHistory();
  if (isSupabaseConfigured) return supa.upsertProject(project);

  // Detect date change so we can cascade to the underlying demands + assignments.
  const existing = _projects.find((p) => p.id === project.id);
  const datesChanged =
    existing != null &&
    (existing.startDate !== project.startDate || existing.endDate !== project.endDate);

  const idx = _projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    _projects[idx] = { ...project, updatedAt: new Date().toISOString() };
  } else {
    _projects.push({
      ...project,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  if (datesChanged) {
    const now = new Date().toISOString();
    _demands = _demands.map((d) =>
      d.projectId === project.id
        ? { ...d, startDate: project.startDate, endDate: project.endDate, updatedAt: now }
        : d
    );
    _assignments = _assignments.map((a) =>
      a.projectId === project.id
        ? { ...a, startDate: project.startDate, endDate: project.endDate, updatedAt: now }
        : a
    );
  }

  notifyMock();
}

export function deleteProject(id: string): void {
  pushHistory();
  if (isSupabaseConfigured) return supa.deleteProject(id);
  _projects = _projects.filter((p) => p.id !== id);
  _demands = _demands.filter((d) => d.projectId !== id);
  _assignments = _assignments.filter((a) => a.projectId !== id);
  notifyMock();
}

// ---------- Demands ----------

export function upsertDemand(demand: ProjectDemand): void {
  pushHistory();
  if (isSupabaseConfigured) return supa.upsertDemand(demand);

  const idx = _demands.findIndex((d) => d.id === demand.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    _demands[idx] = { ...demand, updatedAt: now };
    // Cascade role characteristics AND dates to linked assignments.
    _assignments = _assignments.map((a) =>
      a.projectDemandId === demand.id
        ? {
            ...a,
            daysPerWeek: demand.daysPerWeek,
            assignedRole: demand.roleRequired,
            startDate: demand.startDate,
            endDate: demand.endDate,
            updatedAt: now,
          }
        : a
    );
  } else {
    _demands.push({ ...demand, createdAt: now, updatedAt: now });
  }

  // Recompute the project's date range as the envelope of all its demands.
  const siblings = _demands.filter((d) => d.projectId === demand.projectId);
  if (siblings.length > 0) {
    const minStart = siblings.reduce((m, d) => (d.startDate < m ? d.startDate : m), siblings[0].startDate);
    const maxEnd = siblings.reduce((m, d) => (d.endDate > m ? d.endDate : m), siblings[0].endDate);
    const projIdx = _projects.findIndex((p) => p.id === demand.projectId);
    if (projIdx >= 0) {
      const proj = _projects[projIdx];
      if (proj.startDate !== minStart || proj.endDate !== maxEnd) {
        _projects[projIdx] = { ...proj, startDate: minStart, endDate: maxEnd, updatedAt: now };
      }
    }
  }
  notifyMock();
}

export function deleteDemand(id: string): void {
  pushHistory();
  if (isSupabaseConfigured) return supa.deleteDemand(id);
  _demands = _demands.filter((d) => d.id !== id);
  _assignments = _assignments.filter((a) => a.projectDemandId !== id);
  notifyMock();
}

// ---------- People ----------

export function upsertPerson(person: Person): void {
  pushHistory();
  if (isSupabaseConfigured) return supa.upsertPerson(person);
  const idx = _people.findIndex((p) => p.id === person.id);
  if (idx >= 0) {
    _people[idx] = { ...person, updatedAt: new Date().toISOString() };
  } else {
    _people.push({
      ...person,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  notifyMock();
}

export function deletePerson(id: string): void {
  pushHistory();
  if (isSupabaseConfigured) return supa.deletePerson(id);
  _people = _people.filter((p) => p.id !== id);
  _assignments = _assignments.filter((a) => a.personId !== id);
  _exceptions = _exceptions.filter((e) => e.personId !== id);
  notifyMock();
}

// ---------- Availability exceptions ----------

export function upsertException(exception: AvailabilityException): void {
  pushHistory();
  if (isSupabaseConfigured) return supa.upsertException(exception);
  const idx = _exceptions.findIndex((e) => e.id === exception.id);
  if (idx >= 0) {
    _exceptions[idx] = { ...exception, updatedAt: new Date().toISOString() };
  } else {
    _exceptions.push({
      ...exception,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  notifyMock();
}

/** Wipe every existing exception and replace with `next`. One undo step. */
export function replaceAllExceptions(next: AvailabilityException[]): void {
  pushHistory();
  if (isSupabaseConfigured) return supa.replaceAllExceptions(next);
  _exceptions = next.map((e) => ({
    ...e,
    createdAt: e.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  notifyMock();
}

