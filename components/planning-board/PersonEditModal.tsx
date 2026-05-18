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
import { Input, Select } from '@/components/ui/form-inputs';
import { ROLES } from '@/lib/constants/roles';
import type { Person, PersonRole } from '@/types';

interface PersonEditModalProps {
  open: boolean;
  person: Person | null; // null = adding a new person
  onSave: (person: Person) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function PersonEditModal({
  open,
  person,
  onSave,
  onDelete,
  onClose,
}: PersonEditModalProps) {
  const [form, setForm] = useState<Partial<Person>>({});

  useEffect(() => {
    if (person) {
      setForm({ ...person });
    } else {
      setForm({
        id: crypto.randomUUID(),
        name: '',
        role: 'Consultant',
        contractDaysPerWeek: 5,
        defaultAvailableDaysPerWeek: 5,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }, [person, open]);

  function set<K extends keyof Person>(field: K, value: Person[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    if (!form.name || !form.role) return;
    // Keep defaultAvailableDaysPerWeek in sync with the contract by default —
    // we don't expose it separately because the app uses contractDaysPerWeek
    // for capacity calculations.
    const next: Person = {
      ...(form as Person),
      name: form.name!.trim(),
      defaultAvailableDaysPerWeek: form.contractDaysPerWeek ?? 5,
    };
    onSave(next);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{person ? 'Edit person' : 'Add person'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            label="Name"
            value={form.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Role"
              value={form.role ?? 'Consultant'}
              onChange={(e) => set('role', e.target.value as PersonRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Select
              label="Contract days / week"
              value={String(form.contractDaysPerWeek ?? 5)}
              onChange={(e) => set('contractDaysPerWeek', Number(e.target.value))}
            >
              {[1, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((d) => (
                <option key={d} value={d}>
                  {d}d
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={form.active ?? true}
              onChange={(e) => set('active', e.target.checked)}
            />
            Active (uncheck to hide from the planning board without deleting)
          </label>
        </div>

        <DialogFooter>
          {person && onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete(person.id);
                onClose();
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!form.name?.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
