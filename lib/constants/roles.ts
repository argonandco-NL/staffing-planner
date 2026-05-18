import type { PersonRole } from '@/types';

export const ROLES: PersonRole[] = [
  'Partner',
  'Associate Partner',
  'Principal',
  'Lead',
  'Senior Consultant',
  'Consultant',
];

export const ROLE_ORDER: Record<string, number> = Object.fromEntries(
  ROLES.map((r, i) => [r, i])
);
