'use client';

import { useDraggable } from '@dnd-kit/core';
import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getProjectStyle } from '@/lib/ui/projectColors';
import { isUrgentDemand } from '@/lib/calculations/staffing';
import type { OpenDemandItem } from '@/types';
import { format } from 'date-fns';

interface DemandCardProps {
  item: OpenDemandItem;
}

function DraggableDemandCard({ item }: DemandCardProps) {
  const { demand, project, openCount } = item;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `demand:${demand.id}`,
    data: { type: 'demand', demand, project },
  });

  const urgent = isUrgentDemand(demand);
  const projectStyle = getProjectStyle(project);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'group mb-2 cursor-grab rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm',
        'select-none touch-none',
        isDragging && 'opacity-40',
        urgent && 'border-amber-400 bg-amber-50'
      )}
    >
      {/* Project label */}
      <div
        className="mb-1 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
        style={projectStyle}
      >
        {project.clientName.replace('Client ', '')}
      </div>

      <p className="text-xs font-semibold text-slate-800 truncate">{project.projectName}</p>

      <div className="mt-1 flex items-center gap-2 flex-wrap">
        <Badge variant="secondary">{demand.roleRequired}</Badge>
        <span className="text-xs text-slate-500">{demand.daysPerWeek}d/wk</span>
        {openCount > 1 && (
          <Badge variant="outline" className="text-slate-600">
            {openCount} open
          </Badge>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
        <Clock className="h-3 w-3" />
        {format(new Date(demand.startDate), 'MMM d')} – {format(new Date(demand.endDate), 'MMM d')}
      </div>

      {urgent && (
        <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-700">
          <AlertTriangle className="h-3 w-3" />
          Starts soon
        </div>
      )}
    </div>
  );
}

interface OpenDemandPanelProps {
  items: OpenDemandItem[];
}

export function OpenDemandPanel({ items }: OpenDemandPanelProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-l border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Open Demand
        </span>
        {items.length > 0 && (
          <Badge variant="destructive">{items.length}</Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="text-center text-xs text-slate-400 mt-6">No open demand</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-500">
              Drag a card onto the board to assign.
            </p>
            {items.map((item) => (
              <DraggableDemandCard key={item.demand.id} item={item} />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
