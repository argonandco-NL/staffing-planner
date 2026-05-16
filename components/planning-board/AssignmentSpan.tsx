'use client';

import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { getProjectStyle } from '@/lib/ui/projectColors';
import type { Assignment, Project } from '@/types';

interface AssignmentSpanProps {
  assignment: Assignment;
  project: Project;
  /** Absolute position within the overlay layer */
  posStyle: React.CSSProperties;
}

export function AssignmentSpan({ assignment, project, posStyle }: AssignmentSpanProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: assignment.id,
    data: { type: 'assignment', assignment, project },
  });

  const colorStyle = getProjectStyle(project);
  const spanWidth = typeof posStyle.width === 'number' ? posStyle.width : 0;
  const showLabel = spanWidth >= 60;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={`${project.clientName} — ${project.projectName}\n${assignment.daysPerWeek}d/week · ${assignment.assignedRole}`}
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
      }}
    >
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
  );
}
