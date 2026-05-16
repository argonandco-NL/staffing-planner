import {
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  format,
  parseISO,
} from 'date-fns';
import type { ISOWeek } from '@/types';

/**
 * ISO-week utilities. All week boundaries follow ISO 8601:
 * weeks start Monday, end Sunday. The 13-week planning horizon
 * is anchored on the current week.
 */

export function getNext13Weeks(from?: Date): ISOWeek[] {
  const anchor = from ?? new Date();
  const start = startOfISOWeek(anchor);
  const weeks: ISOWeek[] = [];
  for (let i = 0; i < 13; i++) {
    const weekStart = addWeeks(start, i);
    const weekEnd = endOfISOWeek(weekStart);
    const week = getISOWeek(weekStart);
    const year = getISOWeekYear(weekStart);
    weeks.push({
      year,
      week,
      startDate: weekStart,
      endDate: weekEnd,
      label: `W${week} ${format(weekStart, 'MMM d')}`,
    });
  }
  return weeks;
}

export function overlapsWeek(startDate: string, endDate: string, week: ISOWeek): boolean {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  return start <= week.endDate && end >= week.startDate;
}

export function isoWeekId(week: ISOWeek): string {
  return `${week.year}-W${String(week.week).padStart(2, '0')}`;
}
