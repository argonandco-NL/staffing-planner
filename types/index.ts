export type PersonRole =
  | 'Partner'
  | 'Associate Partner'
  | 'Principal'
  | 'Lead'
  | 'Senior Consultant'
  | 'Consultant';

/**
 * 'proposal' is kept for database backwards compatibility but is treated
 * identically to 'planned' throughout the UI. Prefer 'planned' for new records.
 */
export type ProjectStatus = 'sold' | 'planned' | 'proposal' | 'internal' | 'non_billable';
export type ProjectPriority = 'low' | 'medium' | 'high';
export type AssignmentStatus = 'confirmed' | 'tentative' | 'proposed';
export type AvailabilityExceptionType = 'holiday' | 'sick' | 'training' | 'other';

export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  contractDaysPerWeek: number;
  defaultAvailableDaysPerWeek: number;
  employmentStartDate?: string;
  employmentEndDate?: string;
  active: boolean;
  color?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  clientName: string;
  projectName: string;
  status: ProjectStatus;
  probability: number;
  startDate: string;
  endDate: string;
  ownerName?: string;
  priority: ProjectPriority;
  billable: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDemand {
  id: string;
  projectId: string;
  roleRequired: string;
  daysPerWeek: number;
  startDate: string;
  endDate: string;
  quantity: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  personId: string;
  projectId: string;
  projectDemandId?: string;
  assignedRole: string;
  startDate: string;
  endDate: string;
  daysPerWeek: number;
  status: AssignmentStatus;
  billable: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityException {
  id: string;
  personId: string;
  startDate: string;
  endDate: string;
  unavailableDaysPerWeek: number;
  type: AvailabilityExceptionType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffingNote {
  id: string;
  projectId?: string;
  personId?: string;
  assignmentId?: string;
  note: string;
  createdAt: string;
  createdBy?: string;
}

export interface ImportBatch {
  id: string;
  type: 'initial_projects' | 'holidays';
  fileName: string;
  importedAt: string;
  importedBy?: string;
  status: string;
  summaryJson?: Record<string, unknown>;
}

// Computed / derived types

export interface ISOWeek {
  year: number;
  week: number;
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface PersonWeekStats {
  personId: string;
  week: ISOWeek;
  contractDays: number;
  unavailableDays: number;
  availableDays: number;
  assignedDays: number;
  remainingDays: number;
  utilization: number; // 0–100+
  isOverAllocated: boolean;
}

export interface OpenDemandItem {
  demand: ProjectDemand;
  project: Project;
  filledCount: number;
  openCount: number;
}

export interface StaffingStore {
  people: Person[];
  projects: Project[];
  projectDemands: ProjectDemand[];
  assignments: Assignment[];
  availabilityExceptions: AvailabilityException[];
}
