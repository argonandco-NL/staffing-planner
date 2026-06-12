'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Download, Info, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { getMockStore, replaceAllExceptions } from '@/lib/data/mock-store';
import { parseHolidayFile } from '@/lib/excel/importers';
import { exportFullWorkbook } from '@/lib/excel/exporters';
import { getNext13Weeks } from '@/lib/dates/weeks';

// Records when holidays were last imported so the sheet can show it across
// sessions. Stored as an ISO timestamp string.
const LAST_HOLIDAY_IMPORT_KEY = 'holidays:last-import';

// Privacy notice: real holiday or staffing spreadsheets must never be committed
// to the repo — see the banner inside the page for a user-facing reminder.

type ImportStatus =
  | { kind: 'idle' }
  | { kind: 'parsing' }
  | { kind: 'done'; imported: number; warnings: string[] }
  | { kind: 'error'; message: string };

export function ImportExportView() {
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<ImportStatus>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Read on mount (not during render) to avoid an SSR/CSR hydration mismatch.
  const [lastImport, setLastImport] = useState<string | null>(null);

  useEffect(() => {
    setLastImport(localStorage.getItem(LAST_HOLIDAY_IMPORT_KEY));
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setStatus({ kind: 'parsing' });
    try {
      const store = getMockStore();
      const { exceptions, warnings } = await parseHolidayFile(file, store.people);
      // Each import REPLACES the previous holiday list — the spreadsheet is
      // the source of truth, the app just mirrors it.
      replaceAllExceptions(exceptions);
      const now = new Date().toISOString();
      localStorage.setItem(LAST_HOLIDAY_IMPORT_KEY, now);
      setLastImport(now);
      setStatus({ kind: 'done', imported: exceptions.length, warnings });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to parse file.',
      });
    }
  }

  function handleExport() {
    const store = getMockStore();
    const weeks = getNext13Weeks();
    exportFullWorkbook(
      store.people,
      store.projects,
      store.projectDemands,
      store.assignments,
      weeks
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-base font-semibold text-slate-900">Import / Export</h1>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-3xl">
        {/* Privacy notice */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-semibold mb-0.5">Privacy notice</p>
            <p>
              Holiday spreadsheets and exports contain personal availability data. Do not
              upload these files to public locations. Exports go straight to your machine.
            </p>
          </div>
        </div>

        {/* Import section */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Import — holiday planning</h2>
          <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            {lastImport ? (
              <span>
                Last import:{' '}
                <span className="font-medium text-slate-700">
                  {format(new Date(lastImport), "d MMM yyyy 'at' HH:mm")}
                </span>
              </span>
            ) : (
              <span>No holidays imported yet.</span>
            )}
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Upload the team holiday spreadsheet. The first sheet is read; any row
            below a header containing the cells{' '}
            <code className="bg-slate-100 px-1 rounded">Wie</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">Ref</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">Van</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">Tot</code>{' '}
            becomes one holiday entry. <strong>Each import replaces the previous one.</strong>
          </p>

          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(e) => {
                handleFiles(e.target.files);
                // Reset so the same file can be re-selected.
                e.target.value = '';
              }}
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50'
              }`}
            >
              <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-700">Drop your Excel file here</p>
              <p className="text-xs text-slate-500 mt-1">Accepts .xlsx and .xls</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse files
              </Button>
            </div>

            {/* Status */}
            {status.kind === 'parsing' && (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                Parsing file…
              </div>
            )}
            {status.kind === 'done' && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs">
                <p className="font-medium text-green-800">
                  Imported {status.imported} availability {status.imported === 1 ? 'entry' : 'entries'}.
                </p>
                {status.warnings.length > 0 && (
                  <ul className="mt-1 list-disc list-inside text-amber-700 space-y-0.5 max-h-32 overflow-auto">
                    {status.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {status.kind === 'error' && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {status.message}
              </div>
            )}
          </div>
        </section>

        {/* Export section */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Export</h2>
          <p className="mb-3 text-xs text-slate-500">
            Downloads a single Excel workbook with three sheets: a list of projects, the role
            demand per project (filled vs open), and a per-person planning overview for the
            next 13 weeks.
          </p>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <Download className="h-4 w-4 text-slate-400 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800">Projects, roles, and planning overview</p>
              <p className="text-xs text-slate-500">Single .xlsx file, three sheets</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              Export .xlsx
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
