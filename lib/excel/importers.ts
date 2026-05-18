/**
 * Holiday-planning Excel importer for the Argon team spreadsheet.
 *
 * Expected format (any sheet — we use the first one):
 *   - Somewhere in the sheet there is a header row with the cells
 *     "Wie", "Ref", "Van", "Tot" in adjacent columns (column order can vary).
 *   - Every row below that header, until a fully empty row, is treated as
 *     one holiday entry:
 *       Wie  → person name (matched case-insensitively against the people list)
 *       Ref  → free-text description (e.g. "Vakantie", "Verlof", "Training")
 *       Van  → start date
 *       Tot  → end date
 *
 * Dates can be Excel date numbers, native Date objects, or strings in the
 * common Dutch / US formats (D/M/YY, M/D/YY, ISO).
 *
 * PRIVACY NOTICE: do not commit real holiday spreadsheets to the repository.
 */

import * as XLSX from 'xlsx';
import type { AvailabilityException, AvailabilityExceptionType, Person } from '@/types';

export interface HolidayImportResult {
  exceptions: AvailabilityException[];
  warnings: string[];
}

/** Map the Dutch reference word to the closest enum value we have. */
function categorise(ref: string): AvailabilityExceptionType {
  const r = ref.trim().toLowerCase();
  if (r === 'training' || r === 'opleiding' || r === 'cursus') return 'training';
  if (r === 'ziek' || r === 'sick') return 'sick';
  // Vakantie / Verlof / anything else → holiday.
  return 'holiday';
}

function toIsoDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    // Excel serial date → JS Date (Dec 30 1899 epoch with leap-year quirk).
    const ms = Date.UTC(1899, 11, 30) + value * 86400000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // M/D/YY or M/D/YYYY (US / what Excel emits by default in this sheet).
    const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      let [, a, b, y] = m;
      let year = parseInt(y, 10);
      if (year < 100) year += 2000;
      // Heuristic: if both day-candidates are <=12 it's ambiguous, but the
      // company spreadsheet uses M/D/YY (e.g. 4/20/26 = 20 Apr 2026). Honour
      // that by reading the first part as month.
      const month = parseInt(a, 10);
      const day = parseInt(b, 10);
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    // Fall back to ISO / RFC parsing.
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

/** Return the row index containing the "Wie / Ref / Van / Tot" headers, or -1. */
function findHeaderRow(matrix: unknown[][]): { rowIdx: number; cols: { wie: number; ref: number; van: number; tot: number } } | null {
  for (let i = 0; i < matrix.length; i++) {
    const cells = matrix[i].map((c) => String(c ?? '').trim().toLowerCase());
    const wie = cells.indexOf('wie');
    const ref = cells.indexOf('ref');
    const van = cells.indexOf('van');
    const tot = cells.indexOf('tot');
    if (wie >= 0 && ref >= 0 && van >= 0 && tot >= 0) {
      return { rowIdx: i, cols: { wie, ref, van, tot } };
    }
  }
  return null;
}

export async function parseHolidayFile(
  file: File,
  people: Person[]
): Promise<HolidayImportResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { exceptions: [], warnings: ['No sheets found in workbook.'] };
  }
  const sheet = wb.Sheets[sheetName];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false, // dates as strings, easier to debug; toIsoDate handles them
  });

  const header = findHeaderRow(matrix);
  if (!header) {
    return {
      exceptions: [],
      warnings: [
        `Couldn't find a "Wie / Ref / Van / Tot" header row on sheet "${sheetName}". Make sure the holiday list is on the first sheet and has those four columns.`,
      ],
    };
  }

  const peopleByName = new Map(people.map((p) => [p.name.trim().toLowerCase(), p]));

  const exceptions: AvailabilityException[] = [];
  const warnings: string[] = [];

  for (let i = header.rowIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const wieRaw = row[header.cols.wie];
    const refRaw = row[header.cols.ref];
    const vanRaw = row[header.cols.van];
    const totRaw = row[header.cols.tot];

    const wie = String(wieRaw ?? '').trim();
    const ref = String(refRaw ?? '').trim();
    if (!wie && !ref && !vanRaw && !totRaw) continue;
    if (!wie) {
      warnings.push(`Row ${i + 1}: missing name, skipped.`);
      continue;
    }
    const person = peopleByName.get(wie.toLowerCase());
    if (!person) {
      warnings.push(`Row ${i + 1}: no person matches "${wie}", skipped.`);
      continue;
    }

    const startIso = toIsoDate(vanRaw);
    const endIso = toIsoDate(totRaw);
    if (!startIso || !endIso) {
      warnings.push(
        `Row ${i + 1}: invalid or missing date(s) for ${wie}, skipped.`
      );
      continue;
    }
    if (startIso > endIso) {
      warnings.push(
        `Row ${i + 1}: start date after end date for ${wie}, skipped.`
      );
      continue;
    }

    exceptions.push({
      id: crypto.randomUUID(),
      personId: person.id,
      startDate: startIso,
      endDate: endIso,
      // Person is unavailable for their full contract during the period.
      unavailableDaysPerWeek: person.contractDaysPerWeek,
      type: categorise(ref),
      // Keep the Ref text verbatim — used as the label on the yellow bar.
      notes: ref || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return { exceptions, warnings };
}
