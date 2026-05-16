'use client';

import { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canUndo, undoLastAction, subscribeMockStore } from '@/lib/data/mock-store';

export function UndoButton() {
  const [enabled, setEnabled] = useState(canUndo());

  useEffect(() => {
    return subscribeMockStore(() => setEnabled(canUndo()));
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) undoLastAction();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={!enabled}
      onClick={undoLastAction}
      title="Undo (Ctrl+Z)"
    >
      <Undo2 className="h-4 w-4" />
    </Button>
  );
}
