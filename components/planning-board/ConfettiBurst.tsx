'use client';

import { useEffect, useState } from 'react';

const COLORS = ['#4ade80', '#60a5fa', '#fbbf24', '#f472b6', '#c084fc', '#34d399'];
const PIECE_COUNT = 20;

interface Piece {
  id: number;
  color: string;
  dx: number;
  dy: number;
  rotation: number;
  delay: number;
}

interface ConfettiBurstProps {
  origin: { x: number; y: number } | null;
  nonce: number;
}

/**
 * Brief celebratory burst of confetti pieces anchored at `origin`, replayed
 * whenever `nonce` changes. Self-clears so the overlay is empty between bursts.
 */
export function ConfettiBurst({ origin, nonce }: ConfettiBurstProps) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!origin || nonce === 0) return;

    setPieces(
      Array.from({ length: PIECE_COUNT }, (_, id) => {
        // Radiate outward in all directions: random angle around the full
        // circle, random distance so the burst looks organic.
        const angle = Math.random() * Math.PI * 2;
        const distance = 60 + Math.random() * 80;
        return {
          id,
          color: COLORS[id % COLORS.length],
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          rotation: Math.random() * 720 - 360,
          delay: Math.random() * 0.1,
        };
      })
    );

    const timeout = setTimeout(() => setPieces([]), 1200);
    return () => clearTimeout(timeout);
  }, [nonce, origin]);

  if (!origin || pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50" aria-hidden="true">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute h-2 w-2 rounded-sm"
          style={{
            left: origin.x,
            top: origin.y,
            backgroundColor: piece.color,
            animation: `confetti-fall 0.9s ease-out ${piece.delay}s forwards`,
            '--confetti-dx': `${piece.dx}px`,
            '--confetti-dy': `${piece.dy}px`,
            '--confetti-rotation': `${piece.rotation}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
