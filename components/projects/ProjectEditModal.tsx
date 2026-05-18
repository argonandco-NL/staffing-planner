'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/form-inputs';
import type { Project, ProjectStatus } from '@/types';

interface ProjectEditModalProps {
  open: boolean;
  project: Project | null;
  onSave: (project: Project) => void;
  onClose: () => void;
}

const EMPTY: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
  clientName: '',
  projectName: '',
  status: 'planned',
  probability: 100,
  startDate: '',
  endDate: '',
  billable: true,
  priority: 'medium', // kept in type for DB compat; not exposed in UI
  ownerName: '',
  notes: '',
};

export function ProjectEditModal({ open, project, onSave, onClose }: ProjectEditModalProps) {
  const [form, setForm] = useState<Partial<Project>>({});
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    if (project) {
      setForm({ ...project });
    } else {
      // Prefill both dates with today so the date picker opens on the current
      // year. The user almost always wants the current year, never 1900.
      const today = new Date().toISOString().slice(0, 10);
      setForm({
        ...EMPTY,
        id: crypto.randomUUID(),
        startDate: today,
        endDate: today,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    setMissing([]);
  }, [project, open]);

  function set<K extends keyof Project>(field: K, value: Project[K]) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Selecting "Sold" forces probability to 100 (and locks the input below).
      if (field === 'status' && value === 'sold') {
        next.probability = 100;
      }
      return next;
    });
    // Clear validation error as soon as the user starts typing again.
    if (missing.length > 0) setMissing([]);
  }

  function handleSave() {
    const m: string[] = [];
    if (!form.clientName?.trim()) m.push('client name');
    if (!form.projectName?.trim()) m.push('project name');
    if (!form.startDate) m.push('start date');
    if (!form.endDate) m.push('end date');
    if (m.length > 0) {
      setMissing(m);
      return;
    }
    onSave(form as Project);
  }

  const isNew = !project;
  const isSold = form.status === 'sold';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? 'New Project' : 'Edit Project'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Client name"
              value={form.clientName ?? ''}
              onChange={(e) => set('clientName', e.target.value)}
            />
            <Input
              label="Project name"
              value={form.projectName ?? ''}
              onChange={(e) => set('projectName', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Status"
              value={form.status ?? 'planned'}
              onChange={(e) => set('status', e.target.value as ProjectStatus)}
            >
              <option value="sold">Sold</option>
              <option value="planned">Planned</option>
              <option value="internal">Internal</option>
              <option value="non_billable">Non-billable</option>
            </Select>

            {/* Sold projects always run at 100% probability — locked + greyed
                so the operator can't accidentally drift it. */}
            <Input
              label="Probability (%)"
              type="number"
              min={0}
              max={100}
              value={String(form.probability ?? 100)}
              disabled={isSold}
              className={isSold ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}
              onChange={(e) => set('probability', Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start date"
              type="date"
              value={form.startDate ?? ''}
              onChange={(e) => set('startDate', e.target.value)}
            />
            <Input
              label="End date"
              type="date"
              value={form.endDate ?? ''}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </div>

          <Input
            label="Owner"
            value={form.ownerName ?? ''}
            onChange={(e) => set('ownerName', e.target.value)}
          />

          <Textarea
            label="Notes"
            rows={2}
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>

        <DialogFooter>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
            </div>
            {missing.length > 0 && (
              <p className="text-xs text-red-600">
                Please enter {missing.join(', ')}.
              </p>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
