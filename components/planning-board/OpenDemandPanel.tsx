'use client';

import { useState, useEffect } from 'react';
import { useDraggable, useDroppable, useDndContext } from '@dnd-kit/core';
import { AlertTriangle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const { setNodeRef, isOver } = useDroppable({
    id: 'demand-panel',
    data: { type: 'demand-panel' },
  });

  const dnd = useDndContext();
  const activeData = dnd.active?.data.current as { type?: string } | undefined;
  const showDropHint = isOver && activeData?.type === 'assignment';

  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse when there's nothing to show.
  useEffect(() => {
    if (items.length === 0) setCollapsed(true);
  }, [items.length]);

  if (collapsed) {
    return (
      <aside
        ref={setNodeRef}
        className={cn(
          'flex h-full w-8 flex-col border-l border-slate-200 bg-slate-50 transition-all',
          showDropHint && 'bg-blue-50 ring-2 ring-inset ring-blue-400'
        )}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="flex h-full w-full flex-col items-center justify-start gap-2 py-3 text-slate-500 hover:bg-slate-100"
          title="Expand open demand panel"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          <span
            className="text-[10px] font-semibold uppercase tracking-wide text-slate-400"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Open
          </span>
          <span className="text-[10px] font-bold text-slate-700">{items.length}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      ref={setNodeRef}
      className={cn(
        'flex h-full w-64 flex-col border-l border-slate-200 bg-slate-50',
        showDropHint && 'bg-blue-50 ring-2 ring-inset ring-blue-400'
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Open Demand
        </span>
        <div className="flex items-center gap-1.5">
          <Badge variant="destructive">{items.length}</Badge>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            title="Collapse panel"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="text-center text-xs text-slate-400 mt-6">No open demand</p>
        ) : (
          items.map((item) => (
            <DraggableDemandCard key={item.demand.id} item={item} />
          ))
        )}
      </div>
    </aside>
  );
}
