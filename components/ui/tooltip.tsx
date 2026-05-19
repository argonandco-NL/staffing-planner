'use client';

import { useState, useRef, useLayoutEffect } from 'react';
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
  const [pos, setPos] = useState<{ top: number; left: number; visible: boolean }>({
    top: 0,
    left: 0,
    visible: false,
  });
  const ref = useRef<HTMLDivElement>(null);

  // After each render, measure the tooltip and clamp into the viewport.
  // Runs before paint, so the user never sees the unclamped position.
  useLayoutEffect(() => {
    if (!mouse || !ref.current) {
      if (pos.visible) setPos((p) => ({ ...p, visible: false }));
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const margin = 8;
    // Default: above-right of cursor.
    let top = mouse.y - margin - rect.height;
    let left = mouse.x + 12;
    // If right edge would overflow, flip to the left of the cursor.
    if (left + rect.width > window.innerWidth - margin) {
      left = mouse.x - 12 - rect.width;
    }
    // Hard clamp horizontally.
    if (left < margin) left = margin;
    if (left + rect.width > window.innerWidth - margin) {
      left = window.innerWidth - rect.width - margin;
    }
    // If above the viewport, flip below the cursor.
    if (top < margin) top = mouse.y + 16;
    // Hard clamp vertically.
    if (top + rect.height > window.innerHeight - margin) {
      top = window.innerHeight - rect.height - margin;
    }
    setPos({ top, left, visible: true });
  }, [mouse, pos.visible]);

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
          ref={ref}
          className="fixed z-50 pointer-events-none"
          style={{
            top: pos.top,
            left: pos.left,
            visibility: pos.visible ? 'visible' : 'hidden',
          }}
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
