'use client';

import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import { getProjectStyle } from '@/lib/ui/projectColors';
import type { Assignment, Project } from '@/types';

interface AssignmentSpanProps {
  assignment: Assignment;
  project: Project;
  /** Absolute position within the overlay layer */
  posStyle: React.CSSProperties;
  /** True when this assignment is part of a concurrent set that exceeds the person's contract capacity */
  isOverCapacity?: boolean;
  /** Fade this bar (a different project is currently selected) */
  dimmed?: boolean;
  /** Click handler — used to highlight all bars of the same project */
  onSelect?: () => void;
  /** Mark this bar with a subtle "new" indicator (added in the last 3 days) */
  isNew?: boolean;
}

export function AssignmentSpan({
  assignment,
  project,
  posStyle,
  isOverCapacity,
  dimmed,
  onSelect,
  isNew,
}: AssignmentSpanProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: assignment.id,
    data: { type: 'assignment', assignment, project },
  });

  const colorStyle = getProjectStyle(project);
  const spanWidth = typeof posStyle.width === 'number' ? posStyle.width : 0;
  const showLabel = spanWidth >= 60;
  const barColor = String(colorStyle.backgroundColor || '#1f2937');

  return (
    <Tooltip
      content={`${project.clientName} — ${project.projectName}\n${assignment.daysPerWeek}d/week · ${assignment.assignedRole}`}
      borderColor={barColor}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
        className={cn(
          'absolute flex items-center overflow-hidden rounded-sm',
          'cursor-grab select-none touch-none',
          'hover:brightness-110 active:cursor-grabbing',
          isDragging && 'opacity-30'
        )}
        style={{
          ...posStyle,
          ...colorStyle,
          fontSize: '10px',
          fontWeight: 500,
          lineHeight: 1,
          paddingLeft: showLabel ? 4 : 0,
          paddingRight: showLabel ? 4 : 0,
          pointerEvents: 'auto',
          opacity: dimmed ? 0.25 : undefined,
          transition: 'opacity 120ms ease',
          boxShadow: isOverCapacity
            ? 'inset 0 0 0 1.5px #fca5a5'
            : 'inset 0 0 0 1px rgba(255,255,255,0.8)',
        }}
      >
      {isNew && (
        <span
          className="absolute top-0 right-0 rounded-bl bg-yellow-200 px-1 text-[8px] font-bold uppercase tracking-wide leading-[11px] text-yellow-900 pointer-events-none"
          aria-label="Newly added"
        >
          New
        </span>
      )}
      {showLabel && (
        <span className="truncate">
          {project.clientName.replace('Client ', '')}
          {' '}—{' '}
          {project.projectName}
          {' '}—{' '}
          {assignment.assignedRole}
          {spanWidth >= 160 && ` · ${assignment.daysPerWeek}d`}
        </span>
      )}
      {/* Probability badge for uncertain assignments */}
      {project.probability < 90 && showLabel && (
        <span
          className="ml-auto shrink-0 opacity-75"
          style={{ fontSize: 9 }}
        >
          {project.probability}%
        </span>
      )}
      </div>
    </Tooltip>
  );
}
