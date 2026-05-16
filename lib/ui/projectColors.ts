import type { Project, ProjectStatus } from '@/types';

// ---------------------------------------------------------------------------
// Runtime style function — used everywhere assignment bars and status badges
// are rendered. Returns inline CSS so probability-shaded blue is computed
// at runtime (Tailwind can't generate arbitrary dynamic class names).
// ---------------------------------------------------------------------------

export function getProjectStyle(project: Project): React.CSSProperties {
  switch (project.status) {
    case 'sold':
      return { backgroundColor: '#16a34a', color: '#fff' }; // green-600

    case 'planned':
    case 'proposal': {
      // Probability = opacity: p=10 → 10% opaque (very light blue), p=90 → 90% opaque (dark blue).
      // Floor at 0.08 so even 0% probability is faintly visible.
      const alpha = Math.max(0.08, project.probability / 100);
      return {
        backgroundColor: `rgba(29, 78, 216, ${alpha})`, // blue-700 base
        color: '#fff',
      };
    }

    case 'internal':
    case 'non_billable':
      return { backgroundColor: '#9333ea', color: '#fff' }; // purple-600

    default:
      return { backgroundColor: '#94a3b8', color: '#fff' };
  }
}

// ---------------------------------------------------------------------------
// Status labels — "planned" and "proposal" both show as "Planned"
// ---------------------------------------------------------------------------

export function getStatusLabel(status: ProjectStatus): string {
  switch (status) {
    case 'sold': return 'Sold';
    case 'planned':
    case 'proposal': return 'Planned';
    case 'internal': return 'Internal';
    case 'non_billable': return 'Non-billable';
    default: return status;
  }
}

// Legend swatches for the planning board header
export const LEGEND_ITEMS = [
  { label: 'Sold', style: { backgroundColor: '#16a34a' } },
  { label: 'Planned (high prob.)', style: { backgroundColor: 'rgba(29,78,216,0.9)' } },
  { label: 'Planned (low prob.)', style: { backgroundColor: 'rgba(29,78,216,0.15)' } },
  { label: 'Internal', style: { backgroundColor: '#9333ea' } },
] as const;
