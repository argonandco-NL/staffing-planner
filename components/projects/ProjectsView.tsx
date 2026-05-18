'use client';

import { Fragment, useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, AlertCircle, ChevronRight } from 'lucide-react';
import { UndoButton } from '@/components/ui/UndoButton';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getProjectStyle, getStatusLabel } from '@/lib/ui/projectColors';
import {
  getMockStore,
  subscribeMockStore,
  upsertProject,
  deleteProject,
  upsertDemand,
  deleteDemand,
} from '@/lib/data/mock-store';
import { ProjectEditModal } from './ProjectEditModal';
import { DemandEditModal } from './DemandEditModal';
import type { StaffingStore, Project, ProjectDemand } from '@/types';
import { cn } from '@/lib/utils';

export function ProjectsView() {
  const [store, setStore] = useState<StaffingStore>(getMockStore());
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [editingDemand, setEditingDemand] = useState<ProjectDemand | null>(null);
  const [demandProjectId, setDemandProjectId] = useState('');
  const [demandModalOpen, setDemandModalOpen] = useState(false);

  useEffect(() => subscribeMockStore(() => setStore(getMockStore())), []);

  function toggleExpand(projectId: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function openNewProject() {
    setEditingProject(null);
    setProjectModalOpen(true);
  }

  function openEditProject(project: Project) {
    setEditingProject(project);
    setProjectModalOpen(true);
  }

  function openNewDemand(projectId: string) {
    setEditingDemand(null);
    setDemandProjectId(projectId);
    setDemandModalOpen(true);
  }

  function openEditDemand(demand: ProjectDemand) {
    setEditingDemand(demand);
    setDemandProjectId(demand.projectId);
    setDemandModalOpen(true);
  }

  function handleSaveDemand(demand: ProjectDemand) {
    upsertDemand(demand);
    setDemandModalOpen(false);
  }

  function handleDeleteDemand(id: string) {
    deleteDemand(id);
    setDemandModalOpen(false);
  }

  // Single pass: index assignments by demand, derive fill stats and per-project open counts.
  const filledByDemand = new Map<string, number>();
  store.assignments.forEach((a) => {
    if (!a.projectDemandId) return;
    filledByDemand.set(a.projectDemandId, (filledByDemand.get(a.projectDemandId) ?? 0) + 1);
  });

  const demandFill = new Map<string, { filled: number; open: number }>();
  const openCountByProject = new Map<string, number>();
  store.projectDemands.forEach((d) => {
    const filled = filledByDemand.get(d.id) ?? 0;
    const open = Math.max(0, d.quantity - filled);
    demandFill.set(d.id, { filled, open });
    if (open > 0) {
      openCountByProject.set(d.projectId, (openCountByProject.get(d.projectId) ?? 0) + open);
    }
  });

  const grouped: Record<'sold' | 'planned' | 'internal', Project[]> = {
    sold: store.projects.filter((p) => p.status === 'sold'),
    planned: store.projects.filter((p) => p.status === 'planned' || p.status === 'proposal'),
    internal: store.projects.filter((p) => p.status === 'internal' || p.status === 'non_billable'),
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-base font-semibold text-slate-900">Projects</h1>
        <span className="text-xs text-slate-400">{store.projects.length} projects</span>
        <div className="ml-auto flex items-center gap-2">
          <UndoButton />
          <Button size="sm" onClick={openNewProject}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New project
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {Object.entries(grouped).map(([group, projects]) => (
          <section key={group}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {group === 'sold' ? 'Sold / Confirmed' : group === 'planned' ? 'Planned' : 'Internal / Non-billable'}
              {' '}({projects.length})
            </h2>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="w-6 px-2 py-2" />
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Client</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Project</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Prob.</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Start</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">End</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Open roles</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Notes</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-4 text-center text-xs text-slate-400">
                        No projects
                      </td>
                    </tr>
                  ) : (
                    projects.map((project) => {
                      const isExpanded = expandedProjects.has(project.id);
                      const projectDemands = store.projectDemands.filter(
                        (d) => d.projectId === project.id
                      );
                      const openRoles = openCountByProject.get(project.id) ?? 0;

                      return (
                        <Fragment key={project.id}>
                          {/* Project row */}
                          <tr
                            className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                            onClick={() => toggleExpand(project.id)}
                          >
                            <td className="px-2 py-2">
                              <ChevronRight
                                className={cn(
                                  'h-3.5 w-3.5 transition-transform duration-150 text-slate-400',
                                  isExpanded && 'rotate-90'
                                )}
                              />
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {project.clientName}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{project.projectName}</td>
                            <td className="px-3 py-2">
                              <span
                                className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                                style={getProjectStyle(project)}
                              >
                                {getStatusLabel(project.status)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{project.probability}%</td>
                            <td className="px-3 py-2 text-xs text-slate-500">
                              {format(new Date(project.startDate), 'MMM d, yyyy')}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500">
                              {format(new Date(project.endDate), 'MMM d, yyyy')}
                            </td>
                            <td className="px-3 py-2">
                              {openRoles > 0 ? (
                                <div className="flex items-center gap-1 text-amber-700">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  <span className="text-xs font-medium">{openRoles} open</span>
                                </div>
                              ) : projectDemands.length > 0 ? (
                                <span className="text-xs text-green-600 font-medium">Fully staffed</span>
                              ) : (
                                <div className="flex items-center gap-1 text-amber-700">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  <span className="text-xs font-medium">No roles yet — define one</span>
                                </div>
                              )}
                            </td>
                            <td
                              className="px-3 py-2 text-xs text-slate-500 max-w-[240px]"
                              title={project.notes ?? ''}
                            >
                              <div className="truncate">{project.notes?.trim() || '—'}</div>
                            </td>
                            <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  onClick={() => openEditProject(project)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  onClick={() => deleteProject(project.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded demand rows */}
                          {isExpanded && (
                            <tr className="bg-slate-50">
                              <td colSpan={10} className="px-6 pb-3 pt-1">
                                <div className="rounded border border-slate-200 bg-white">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="px-3 py-1.5 text-left font-medium text-slate-500">
                                          Role
                                        </th>
                                        <th className="px-3 py-1.5 text-left font-medium text-slate-500">
                                          d/wk
                                        </th>
                                        <th className="px-3 py-1.5 text-left font-medium text-slate-500">
                                          Start
                                        </th>
                                        <th className="px-3 py-1.5 text-left font-medium text-slate-500">
                                          End
                                        </th>
                                        <th className="px-3 py-1.5 text-left font-medium text-slate-500">
                                          Filled
                                        </th>
                                        <th className="px-3 py-1.5 text-left font-medium text-slate-500">
                                          Open
                                        </th>
                                        <th className="px-3 py-1.5 text-left font-medium text-slate-500">
                                          Notes
                                        </th>
                                        <th className="px-3 py-1.5" />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {projectDemands.length === 0 ? (
                                        <tr>
                                          <td
                                            colSpan={8}
                                            className="px-3 py-3 text-center text-slate-400"
                                          >
                                            No roles defined yet
                                          </td>
                                        </tr>
                                      ) : (
                                        projectDemands.map((demand) => {
                                          const stats = demandFill.get(demand.id) ?? {
                                            filled: 0,
                                            open: demand.quantity,
                                          };
                                          return (
                                            <tr
                                              key={demand.id}
                                              className="border-b border-slate-100 last:border-0"
                                            >
                                              <td className="px-3 py-1.5 font-medium text-slate-700">
                                                {demand.roleRequired}
                                              </td>
                                              <td className="px-3 py-1.5 text-slate-600">
                                                {demand.daysPerWeek}d
                                              </td>
                                              <td className="px-3 py-1.5 text-slate-500">
                                                {format(new Date(demand.startDate), 'MMM d, yyyy')}
                                              </td>
                                              <td className="px-3 py-1.5 text-slate-500">
                                                {format(new Date(demand.endDate), 'MMM d, yyyy')}
                                              </td>
                                              <td className="px-3 py-1.5 text-slate-600">
                                                {stats.filled}
                                              </td>
                                              <td className="px-3 py-1.5">
                                                {stats.open > 0 ? (
                                                  <Badge variant="destructive">
                                                    {stats.open}
                                                  </Badge>
                                                ) : (
                                                  <span className="text-green-600 font-medium">
                                                    ✓
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-3 py-1.5 text-slate-400 max-w-[160px] truncate">
                                                {demand.notes ?? '—'}
                                              </td>
                                              <td className="px-3 py-1.5 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                  <button
                                                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                    onClick={() => openEditDemand(demand)}
                                                  >
                                                    <Pencil className="h-3 w-3" />
                                                  </button>
                                                  <button
                                                    className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                                    onClick={() => handleDeleteDemand(demand.id)}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}
                                    </tbody>
                                  </table>
                                  <div className="border-t border-slate-100 px-3 py-1.5">
                                    <button
                                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                      onClick={() => openNewDemand(project.id)}
                                    >
                                      <Plus className="h-3 w-3" />
                                      Add role
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <ProjectEditModal
        open={projectModalOpen}
        project={editingProject}
        onSave={(p) => { upsertProject(p); setProjectModalOpen(false); }}
        onClose={() => setProjectModalOpen(false)}
      />

      <DemandEditModal
        open={demandModalOpen}
        demand={editingDemand}
        projectId={demandProjectId}
        project={store.projects.find((p) => p.id === demandProjectId)}
        onSave={handleSaveDemand}
        onDelete={handleDeleteDemand}
        onClose={() => setDemandModalOpen(false)}
      />
    </div>
  );
}
