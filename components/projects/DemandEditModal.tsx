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
import { ROLES } from '@/lib/constants/roles';
import type { Project, ProjectDemand } from '@/types';

interface DemandEditModalProps {
  open: boolean;
  demand: ProjectDemand | null; // null = new
  projectId: string;
  /** Parent project — used to pre-fill date defaults when adding a new demand. */
  project?: Project;
  onSave: (demand: ProjectDemand) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function DemandEditModal({
  open,
  demand,
  projectId,
  project,
  onSave,
  onDelete,
  onClose,
}: DemandEditModalProps) {
  const [form, setForm] = useState<Partial<ProjectDemand>>({});

  useEffect(() => {
    if (demand) {
      setForm({ ...demand });
    } else {
      setForm({
        id: crypto.randomUUID(),
        projectId,
        roleRequired: 'Consultant',
        daysPerWeek: 5,
        startDate: project?.startDate ?? '',
        endDate: project?.endDate ?? '',
        quantity: 1,
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }, [demand, projectId, project, open]);

  function set<K extends keyof ProjectDemand>(field: K, value: ProjectDemand[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    if (!form.roleRequired || !form.startDate || !form.endDate) return;
    onSave(form as ProjectDemand);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{demand ? 'Edit Role Demand' : 'Add Role Demand'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Select
            label="Role required"
            value={form.roleRequired ?? 'Consultant'}
            onChange={(e) => set('roleRequired', e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>

          <Select
            label="Days per week"
            value={String(form.daysPerWeek ?? 4)}
            onChange={(e) => set('daysPerWeek', Number(e.target.value))}
          >
            {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((d) => (
              <option key={d} value={d}>
                {d}d/wk
              </option>
            ))}
          </Select>

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

          <Textarea
            label="Notes"
            rows={2}
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>

        <DialogFooter>
          {demand && onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete(demand.id);
                onClose();
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
