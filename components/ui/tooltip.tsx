'use client';

import { useState } from 'react';
import React from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  // Must be a single element so we can inject mouse handlers without a wrapper div.
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  borderColor?: string;
}

export function Tooltip({ content, children, borderColor = '#1f2937' }: TooltipProps) {
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  const enhanced = React.cloneElement(children, {
    onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
      setMouse({ x: e.clientX, y: e.clientY });
      children.props.onMouseMove?.(e);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      setMouse(null);
      children.props.onMouseLeave?.(e);
    },
  });

  return (
    <>
      {enhanced}
      {mouse && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-50 pointer-events-none"
          style={{ top: mouse.y - 8, left: mouse.x + 12, transform: 'translateY(-100%)' }}
        >
          <div
            className="bg-white text-slate-900 text-xs px-2.5 py-1.5 rounded-md shadow-lg"
            style={{ border: `1.5px solid ${borderColor}`, whiteSpace: 'pre' }}
          >
            {content}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
