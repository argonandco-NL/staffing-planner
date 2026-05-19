'use client';

/**
 * Supabase-backed data layer. Mirrors the synchronous API of mock-store so
 * that the rest of the codebase doesn't have to know whether it's talking to
 * an in-memory store or a real database.
 *
 * Strategy:
 *  1. On first call to getStore()/subscribeStore(), kick off a one-time bulk
 *     fetch of every relevant table and populate an in-memory cache.
 *  2. All reads return synchronously from that cache.
 *  3. All writes update the cache + notify listeners immediately, then fire
 *     the corresponding Supabase request in the background. Failures are
 *     logged; the optimistic update is left in place to keep the UI snappy.
 *  4. Cascades (delete demand → delete linked assignments, edit demand →
 *     propagate role/daysPerWeek to assignments) are applied locally *and*
 *     issued explicitly to Supabase, so other tabs see the same end state
 *     after they reload.
 */

import { supabase } from '@/lib/supabase/client';
import type {
  Person,
  Project,
  ProjectDemand,
  Assignment,
  AvailabilityException,
  StaffingStore,
  ProjectStatus,
  ProjectPriority,
  PersonRole,
  AssignmentStatus,
  AvailabilityExceptionType,
} from '@/types';

// ---------------------------------------------------------------------------
// Cache + listeners
// ---------------------------------------------------------------------------

function emptyStore(): StaffingStore {
  return {
    people: [],
    projects: [],
    projectDemands: [],
    assignments: [],
    availabilityExceptions: [],
  };
}

let _cache: StaffingStore = emptyStore();
let _loadPromise: Promise<void> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}

// ---------------------------------------------------------------------------
// Row <-> domain mappers (Postgres snake_case <-> TypeScript camelCase)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function personFromRow(r: Row): Person {
  return {
    id: r.id as string,
    name: r.name as string,
    role: r.role as PersonRole,
    contractDaysPerWeek: Number(r.contract_days_per_week),
    defaultAvailableDaysPerWeek: Number(r.default_available_days_per_week),
    employmentStartDate: (r.employment_start_date as string | null) ?? undefined,
    employmentEndDate: (r.employment_end_date as string | null) ?? undefined,
    active: Boolean(r.active),
    color: (r.color as string | null) ?? undefined,
    notes: (r.notes as string | null) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function personToRow(p: Person): Row {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    contract_days_per_week: p.contractDaysPerWeek,
    default_available_days_per_week: p.defaultAvailableDaysPerWeek,
    employment_start_date: p.employmentStartDate ?? null,
    employment_end_date: p.employmentEndDate ?? null,
    active: p.active,
    color: p.color ?? null,
    notes: p.notes ?? null,
  };
}

function projectFromRow(r: Row): Project {
  return {
    id: r.id as string,
    clientName: r.client_name as string,
    projectName: r.project_name as string,
    status: r.status as ProjectStatus,
    probability: Number(r.probability),
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    ownerName: (r.owner_name as string | null) ?? undefined,
    priority: r.priority as ProjectPriority,
    billable: Boolean(r.billable),
    notes: (r.notes as string | null) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function projectToRow(p: Project): Row {
  return {
    id: p.id,
    client_name: p.clientName,
    project_name: p.projectName,
    status: p.status,
    probability: p.probability,
    start_date: p.startDate,
    end_date: p.endDate,
    owner_name: p.ownerName ?? null,
    priority: p.priority,
    billable: p.billable,
    notes: p.notes ?? null,
  };
}

function demandFromRow(r: Row): ProjectDemand {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    roleRequired: r.role_required as string,
    daysPerWeek: Number(r.days_per_week),
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    quantity: Number(r.quantity),
    notes: (r.notes as string | null) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function demandToRow(d: ProjectDemand): Row {
  return {
    id: d.id,
    project_id: d.projectId,
    role_required: d.roleRequired,
    days_per_week: d.daysPerWeek,
    start_date: d.startDate,
    end_date: d.endDate,
    quantity: d.quantity,
    notes: d.notes ?? null,
  };
}

function assignmentFromRow(r: Row): Assignment {
  return {
    id: r.id as string,
    personId: r.person_id as string,
    projectId: r.project_id as string,
    projectDemandId: (r.project_demand_id as string | null) ?? undefined,
    assignedRole: r.assigned_role as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    daysPerWeek: Number(r.days_per_week),
    status: r.status as AssignmentStatus,
    billable: Boolean(r.billable),
    notes: (r.notes as string | null) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function assignmentToRow(a: Assignment): Row {
  return {
    id: a.id,
    person_id: a.personId,
    project_id: a.projectId,
    project_demand_id: a.projectDemandId ?? null,
    assigned_role: a.assignedRole,
    start_date: a.startDate,
    end_date: a.endDate,
    days_per_week: a.daysPerWeek,
    status: a.status,
    billable: a.billable,
    notes: a.notes ?? null,
  };
}

function exceptionFromRow(r: Row): AvailabilityException {
  return {
    id: r.id as string,
    personId: r.person_id as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    unavailableDaysPerWeek: Number(r.unavailable_days_per_week),
    type: r.type as AvailabilityExceptionType,
    notes: (r.notes as string | null) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function exceptionToRow(e: AvailabilityException): Row {
  return {
    id: e.id,
    person_id: e.personId,
    start_date: e.startDate,
    end_date: e.endDate,
    unavailable_days_per_week: e.unavailableDaysPerWeek,
    type: e.type,
    notes: e.notes ?? null,
  };
}

// ---------------------------------------------------------------------------
// Bulk fetch
// ---------------------------------------------------------------------------

async function loadAll(): Promise<void> {
  if (!supabase) return;
  const [peopleRes, projectsRes, demandsRes, assignmentsRes, exceptionsRes] = await Promise.all([
    supabase.from('people').select('*').order('created_at', { ascending: true }),
    supabase.from('projects').select('*').order('created_at', { ascending: true }),
    supabase.from('project_demands').select('*').order('created_at', { ascending: true }),
    supabase.from('assignments').select('*').order('created_at', { ascending: true }),
    supabase.from('availability_exceptions').select('*').order('created_at', { ascending: true }),
  ]);

  const errors = [peopleRes.error, projectsRes.error, demandsRes.error, assignmentsRes.error, exceptionsRes.error]
    .filter(Boolean);
  if (errors.length > 0) {
    console.error('Failed to load data from Supabase:', errors);
  }

  _cache = {
    people: (peopleRes.data ?? []).map(personFromRow),
    projects: (projectsRes.data ?? []).map(projectFromRow),
    projectDemands: (demandsRes.data ?? []).map(demandFromRow),
    assignments: (assignmentsRes.data ?? []).map(assignmentFromRow),
    availabilityExceptions: (exceptionsRes.data ?? []).map(exceptionFromRow),
  };
  notify();
}

function ensureLoaded() {
  if (_loadPromise) return _loadPromise;
  _loadPromise = loadAll().catch((e) => {
    console.error('Initial Supabase load failed:', e);
  });
  return _loadPromise;
}

// ---------------------------------------------------------------------------
// Public API — mirrors mock-store
// ---------------------------------------------------------------------------

export function getStore(): StaffingStore {
  ensureLoaded();
  // Return a fresh top-level snapshot so React's setState sees a new object
  // reference and re-renders. Returning `_cache` directly causes setState's
  // Object.is bail-out — after an in-place mutation the listener fires but
  // React skips the re-render, so the planning board doesn't update until
  // something else (e.g. week-shift) forces a render.
  return { ..._cache };
}

export function subscribeStore(listener: Listener): () => void {
  listeners.add(listener);
  ensureLoaded();
  return () => {
    listeners.delete(listener);
  };
}

// ---------- Assignments ----------

export async function upsertAssignment(
  assignment: Assignment
): Promise<{ error: { message: string } | null }> {
  const previous = _cache.assignments.find((a) => a.id === assignment.id);
  const idx = _cache.assignments.findIndex((a) => a.id === assignment.id);
  if (idx >= 0) _cache.assignments[idx] = assignment;
  else _cache.assignments.push(assignment);
  notify();

  const { error } = await supabase!
    .from('assignments')
    .upsert(assignmentToRow(assignment));

  if (error) {
    // Revert the optimistic cache update so the UI doesn't show a phantom
    // assignment. Demand-panel rebuilds open count from cached assignments,
    // so this restoration also brings the open demand back into view.
    if (previous) {
      const i = _cache.assignments.findIndex((a) => a.id === assignment.id);
      if (i >= 0) _cache.assignments[i] = previous;
    } else {
      _cache.assignments = _cache.assignments.filter((a) => a.id !== assignment.id);
    }
    notify();
    console.error('upsertAssignment failed:', error.message, {
      assignmentId: assignment.id,
      projectId: assignment.projectId,
      status: assignment.status,
    });
    return { error: { message: error.message } };
  }
  return { error: null };
}

export function deleteAssignment(id: string): void {
  _cache.assignments = _cache.assignments.filter((a) => a.id !== id);
  notify();

  void supabase!
    .from('assignments')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error('deleteAssignment failed:', error);
    });
}

export function moveAssignment(
  id: string,
  updates: Partial<Pick<Assignment, 'personId' | 'startDate' | 'endDate' | 'daysPerWeek'>>
): void {
  const idx = _cache.assignments.findIndex((a) => a.id === id);
  if (idx < 0) return;
  const updated = { ..._cache.assignments[idx], ...updates };
  _cache.assignments[idx] = updated;
  notify();

  const patch: Row = {};
  if (updates.personId !== undefined) patch.person_id = updates.personId;
  if (updates.startDate !== undefined) patch.start_date = updates.startDate;
  if (updates.endDate !== undefined) patch.end_date = updates.endDate;
  if (updates.daysPerWeek !== undefined) patch.days_per_week = updates.daysPerWeek;

  void supabase!
    .from('assignments')
    .update(patch)
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error('moveAssignment failed:', error);
    });
}

// ---------- Projects ----------

export function upsertProject(project: Project): void {
  // Detect date change so we can cascade to demands + assignments below.
  const existing = _cache.projects.find((p) => p.id === project.id);
  const datesChanged =
    existing != null &&
    (existing.startDate !== project.startDate || existing.endDate !== project.endDate);

  const idx = _cache.projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) _cache.projects[idx] = project;
  else _cache.projects.push(project);

  if (datesChanged) {
    _cache.projectDemands = _cache.projectDemands.map((d) =>
      d.projectId === project.id
        ? { ...d, startDate: project.startDate, endDate: project.endDate }
        : d
    );
    _cache.assignments = _cache.assignments.map((a) =>
      a.projectId === project.id
        ? { ...a, startDate: project.startDate, endDate: project.endDate }
        : a
    );
  }
  notify();

  void (async () => {
    const { error: projError } = await supabase!.from('projects').upsert(projectToRow(project));
    if (projError) {
      console.error('upsertProject failed:', projError);
      return;
    }
    if (datesChanged) {
      const [{ error: dErr }, { error: aErr }] = await Promise.all([
        supabase!
          .from('project_demands')
          .update({ start_date: project.startDate, end_date: project.endDate })
          .eq('project_id', project.id),
        supabase!
          .from('assignments')
          .update({ start_date: project.startDate, end_date: project.endDate })
          .eq('project_id', project.id),
      ]);
      if (dErr) console.error('upsertProject demand cascade failed:', dErr);
      if (aErr) console.error('upsertProject assignment cascade failed:', aErr);
    }
  })();
}


export function deleteProject(id: string): void {
  _cache.projects = _cache.projects.filter((p) => p.id !== id);
  _cache.projectDemands = _cache.projectDemands.filter((d) => d.projectId !== id);
  _cache.assignments = _cache.assignments.filter((a) => a.projectId !== id);
  notify();

  // DB foreign keys cascade demand + assignment deletes for us.
  void supabase!
    .from('projects')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error('deleteProject failed:', error);
    });
}

// ---------- Demands ----------

export function upsertDemand(demand: ProjectDemand): void {
  const existing = _cache.projectDemands.find((d) => d.id === demand.id);
  const isUpdate = !!existing;

  const idx = _cache.projectDemands.findIndex((d) => d.id === demand.id);
  if (idx >= 0) _cache.projectDemands[idx] = demand;
  else _cache.projectDemands.push(demand);

  if (isUpdate) {
    // Cascade role characteristics AND dates to linked assignments.
    _cache.assignments = _cache.assignments.map((a) =>
      a.projectDemandId === demand.id
        ? {
            ...a,
            daysPerWeek: demand.daysPerWeek,
            assignedRole: demand.roleRequired,
            startDate: demand.startDate,
            endDate: demand.endDate,
          }
        : a
    );
  }

  // Recompute the parent project's date range as the envelope of all its demands.
  const siblings = _cache.projectDemands.filter((d) => d.projectId === demand.projectId);
  let projectUpdate: { startDate: string; endDate: string } | null = null;
  if (siblings.length > 0) {
    const minStart = siblings.reduce((m, d) => (d.startDate < m ? d.startDate : m), siblings[0].startDate);
    const maxEnd = siblings.reduce((m, d) => (d.endDate > m ? d.endDate : m), siblings[0].endDate);
    const pIdx = _cache.projects.findIndex((p) => p.id === demand.projectId);
    if (pIdx >= 0) {
      const proj = _cache.projects[pIdx];
      if (proj.startDate !== minStart || proj.endDate !== maxEnd) {
        _cache.projects[pIdx] = { ...proj, startDate: minStart, endDate: maxEnd };
        projectUpdate = { startDate: minStart, endDate: maxEnd };
      }
    }
  }

  notify();

  void (async () => {
    const { error: upsertError } = await supabase!
      .from('project_demands')
      .upsert(demandToRow(demand));
    if (upsertError) {
      console.error('upsertDemand failed:', upsertError);
      return;
    }
    if (isUpdate) {
      const { error: cascadeError } = await supabase!
        .from('assignments')
        .update({
          days_per_week: demand.daysPerWeek,
          assigned_role: demand.roleRequired,
          start_date: demand.startDate,
          end_date: demand.endDate,
        })
        .eq('project_demand_id', demand.id);
      if (cascadeError) console.error('upsertDemand cascade failed:', cascadeError);
    }
    if (projectUpdate) {
      const { error: projError } = await supabase!
        .from('projects')
        .update({ start_date: projectUpdate.startDate, end_date: projectUpdate.endDate })
        .eq('id', demand.projectId);
      if (projError) console.error('upsertDemand project envelope update failed:', projError);
    }
  })();
}

export function deleteDemand(id: string): void {
  _cache.projectDemands = _cache.projectDemands.filter((d) => d.id !== id);
  _cache.assignments = _cache.assignments.filter((a) => a.projectDemandId !== id);
  notify();

  // Schema sets project_demand_id to NULL on demand delete, so we have to
  // remove the linked assignments explicitly to match local cascade behaviour.
  void (async () => {
    const { error: assignmentError } = await supabase!
      .from('assignments')
      .delete()
      .eq('project_demand_id', id);
    if (assignmentError) console.error('deleteDemand cascade failed:', assignmentError);

    const { error: demandError } = await supabase!
      .from('project_demands')
      .delete()
      .eq('id', id);
    if (demandError) console.error('deleteDemand failed:', demandError);
  })();
}

// ---------- People ----------

export function upsertPerson(person: Person): void {
  const idx = _cache.people.findIndex((p) => p.id === person.id);
  if (idx >= 0) _cache.people[idx] = person;
  else _cache.people.push(person);
  notify();

  void supabase!
    .from('people')
    .upsert(personToRow(person))
    .then(({ error }) => {
      if (error) console.error('upsertPerson failed:', error);
    });
}

export function deletePerson(id: string): void {
  _cache.people = _cache.people.filter((p) => p.id !== id);
  // Mirror the schema's ON DELETE CASCADE so the UI updates immediately.
  _cache.assignments = _cache.assignments.filter((a) => a.personId !== id);
  _cache.availabilityExceptions = _cache.availabilityExceptions.filter((e) => e.personId !== id);
  notify();

  void supabase!
    .from('people')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error('deletePerson failed:', error);
    });
}

// ---------- Availability exceptions ----------

export function upsertException(exception: AvailabilityException): void {
  const idx = _cache.availabilityExceptions.findIndex((e) => e.id === exception.id);
  if (idx >= 0) _cache.availabilityExceptions[idx] = exception;
  else _cache.availabilityExceptions.push(exception);
  notify();

  void supabase!
    .from('availability_exceptions')
    .upsert(exceptionToRow(exception))
    .then(({ error }) => {
      if (error) console.error('upsertException failed:', error);
    });
}

/**
 * Wipe every availability exception currently on file and insert the supplied
 * list as the new state. Used by the holiday importer so a re-import fully
 * replaces the previous upload.
 */
export function replaceAllExceptions(next: AvailabilityException[]): void {
  _cache.availabilityExceptions = [...next];
  notify();

  void (async () => {
    // Delete everything then bulk-insert. The schema has no FKs pointing at
    // exceptions, so order doesn't matter for other tables.
    const { error: delError } = await supabase!
      .from('availability_exceptions')
      .delete()
      .not('id', 'is', null); // delete-all needs a filter; this matches all rows
    if (delError) console.error('replaceAllExceptions delete failed:', delError);
    if (next.length > 0) {
      const { error: insError } = await supabase!
        .from('availability_exceptions')
        .insert(next.map(exceptionToRow));
      if (insError) console.error('replaceAllExceptions insert failed:', insError);
    }
  })();
}

// ---------- Snapshot restore (used by undo) ----------

/**
 * Replace the local cache with `snapshot`, then reconcile Supabase so it
 * matches: rows present in cache but missing from snapshot are deleted, and
 * everything in snapshot is upserted. Order respects FK constraints.
 */
export function restoreSnapshot(snapshot: StaffingStore): void {
  // Take a snapshot of current IDs *before* we mutate the cache so we know
  // what to delete from Supabase.
  const beforeIds = {
    assignments: new Set(_cache.assignments.map((a) => a.id)),
    exceptions: new Set(_cache.availabilityExceptions.map((e) => e.id)),
    demands: new Set(_cache.projectDemands.map((d) => d.id)),
    projects: new Set(_cache.projects.map((p) => p.id)),
    people: new Set(_cache.people.map((p) => p.id)),
  };

  _cache = {
    people: snapshot.people,
    projects: snapshot.projects,
    projectDemands: snapshot.projectDemands,
    assignments: snapshot.assignments,
    availabilityExceptions: snapshot.availabilityExceptions,
  };
  notify();

  const snapshotIds = {
    assignments: new Set(snapshot.assignments.map((a) => a.id)),
    exceptions: new Set(snapshot.availabilityExceptions.map((e) => e.id)),
    demands: new Set(snapshot.projectDemands.map((d) => d.id)),
    projects: new Set(snapshot.projects.map((p) => p.id)),
    people: new Set(snapshot.people.map((p) => p.id)),
  };

  const deletes = {
    assignments: [...beforeIds.assignments].filter((id) => !snapshotIds.assignments.has(id)),
    exceptions: [...beforeIds.exceptions].filter((id) => !snapshotIds.exceptions.has(id)),
    demands: [...beforeIds.demands].filter((id) => !snapshotIds.demands.has(id)),
    projects: [...beforeIds.projects].filter((id) => !snapshotIds.projects.has(id)),
    people: [...beforeIds.people].filter((id) => !snapshotIds.people.has(id)),
  };

  void (async () => {
    if (!supabase) return;
    try {
      // Delete children first to keep FK constraints happy.
      if (deletes.assignments.length)
        await supabase.from('assignments').delete().in('id', deletes.assignments);
      if (deletes.exceptions.length)
        await supabase.from('availability_exceptions').delete().in('id', deletes.exceptions);
      if (deletes.demands.length)
        await supabase.from('project_demands').delete().in('id', deletes.demands);
      if (deletes.projects.length)
        await supabase.from('projects').delete().in('id', deletes.projects);
      if (deletes.people.length)
        await supabase.from('people').delete().in('id', deletes.people);

      // Upsert parents first.
      if (snapshot.people.length)
        await supabase.from('people').upsert(snapshot.people.map(personToRow));
      if (snapshot.projects.length)
        await supabase.from('projects').upsert(snapshot.projects.map(projectToRow));
      if (snapshot.projectDemands.length)
        await supabase.from('project_demands').upsert(snapshot.projectDemands.map(demandToRow));
      if (snapshot.assignments.length)
        await supabase.from('assignments').upsert(snapshot.assignments.map(assignmentToRow));
      if (snapshot.availabilityExceptions.length)
        await supabase
          .from('availability_exceptions')
          .upsert(snapshot.availabilityExceptions.map(exceptionToRow));
    } catch (e) {
      console.error('restoreSnapshot Supabase sync failed:', e);
    }
  })();
}

// ---------- Reset (used by mock-store when in mock mode; no-op for Supabase) ----------

export function resetStore(): void {
  // Re-fetch everything from Supabase so the UI snaps back to server state.
  _loadPromise = null;
  ensureLoaded();
}
