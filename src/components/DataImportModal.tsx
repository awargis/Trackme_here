import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  BatchRecord,
  UploadCategory,
  UploadedStudentRow,
} from '../types/academic.ts';
import {
  normalizeSmartExcelRows,
  parseDelimitedOrPdfTextToRows,
} from '../utils/analyticsEngine.ts';

interface DataImportModalProps {
  batches: BatchRecord[];
  activeBatch?: BatchRecord;
  onClose: () => void;
  onCommitRows: (
    batchId: string,
    rows: UploadedStudentRow[],
    uploadCategory: UploadCategory
  ) => Promise<void>;
  onClearDatabase?: () => Promise<void>;
}

const SAMPLE_COACHING_MULTITEST_CSV = `region,combined_center,center,Reg No,student_name,batch,class_stream,test_date,test_name,Test Type,Out of,Score,Avg. Score,Avg. Physics,Avg. Chemistry,Avg. Maths,Offline Rank,Regional Rank,Center Rank
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23273301,NAMAN RAJPUT,S1A-LJ11M,12 JEE,17 May 2026,Milestone:1,Main,300,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23273301,NAMAN RAJPUT,S1A-LJ21W,12 JEE,17 June 2026,Milestone-1,Main,144,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23273301,NAMAN RAJPUT,S1A-LJ21W,12 JEE,01 July 2026,Milestone-2,Main,144,81,56.25%,35.42%,54.17%,79.17%,8,7,7
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23273301,NAMAN RAJPUT,S1A-LJ21W,12 JEE,05 August 2026,Milestone-4,Main,144,39,27.08%,45.83%,20.83%,14.58%,17,8,8
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23273301,NAMAN RAJPUT,S1A-LJ21W,12 JEE,09 August 2026,AITS - 1,Main,300,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23273301,NAMAN RAJPUT,S1A-LJ21W,12 JEE,26 August 2026,Milestone-5,Main,144,37,25.69%,25.00%,8.33%,43.75%,10,2,2
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23273302,TRISHA MISHRA,S1A-LJ11M,12 JEE,17 May 2026,Milestone:1,Main,300,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23273302,TRISHA MISHRA,S1A-LJ21W,12 JEE,17 June 2026,Milestone-1,Main,144,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291335,YASH SINGH,S1A-LJ11M,12 JEE,17 May 2026,Milestone:1,Main,300,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291335,YASH SINGH,S1A-LJ21W,12 JEE,17 June 2026,Milestone-1,Main,144,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291335,YASH SINGH,S1A-LJ21W,12 JEE,01 July 2026,Milestone-2,Main,144,90,62.50%,35.42%,62.50%,89.58%,6,6,6
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291335,YASH SINGH,S1A-LJ21W,12 JEE,05 August 2026,Milestone-4,Main,144,61,42.36%,31.25%,58.33%,37.50%,6,3,3
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291335,YASH SINGH,S1A-LJ21W,12 JEE,09 August 2026,AITS - 1,Main,300,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291335,YASH SINGH,S1A-LJ21W,12 JEE,26 August 2026,Milestone-5,Main,144,13,9.03%,0.00%,0.00%,27.08%,20,7,7
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291336,Abhyuday Singh,S1A-LJ11M,12 JEE,17 May 2026,Milestone:1,Main,300,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291336,Abhyuday Singh,S1A-LJ21W,12 JEE,17 June 2026,Milestone-1,Main,144,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291336,Abhyuday Singh,S1A-LJ21W,12 JEE,01 July 2026,Milestone-2,Main,144,98,68.06%,52.08%,62.50%,89.58%,4,4,4
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291336,Abhyuday Singh,S1A-LJ21W,12 JEE,05 August 2026,Milestone-4,Main,144,41,28.47%,20.83%,33.33%,31.25%,15,7,7
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291336,Abhyuday Singh,S1A-LJ21W,12 JEE,09 August 2026,AITS - 1,Main,300,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291336,Abhyuday Singh,S1A-LJ21W,12 JEE,26 August 2026,Milestone-5,Main,144,34,23.61%,25.00%,8.33%,37.50%,13,4,4
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291337,Aryan Singh,S1A-LJ11M,12 JEE,17 May 2026,Milestone:1,Main,300,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291337,Aryan Singh,S1A-LJ21W,12 JEE,17 June 2026,Milestone-1,Main,144,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291337,Aryan Singh,S1A-LJ21W,12 JEE,01 July 2026,Milestone-2,Main,144,81,56.25%,35.42%,62.50%,70.83%,8,7,7
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291337,Aryan Singh,S1A-LJ21W,12 JEE,05 August 2026,Milestone-4,Main,144,44,30.56%,20.83%,41.67%,29.17%,11,6,6
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291337,Aryan Singh,S1A-LJ21W,12 JEE,09 August 2026,AITS - 1,Main,300,,,,,,,,
UP,Varanasi Vidyapeeth,GD Global school (S-SIP),23291337,Aryan Singh,S1A-LJ21W,12 JEE,26 August 2026,Milestone-5,Main,144,12,8.33%,0.00%,0.00%,25.00%,22,8,8`;

const SAMPLE_COMBINED_CSV = `RegNo,Name,Batch,Attendance,T1,T2,T3,T4,T5,T6,Physics,Chemistry,Math,WeakTopics
REG-2027-801,Siddhant Kulkarni,Apex JEE-Adv 2027,94.5,79,82,85,87,90,93,91,89,95,Electrochemistry;Wave Optics & Interference
REG-2027-802,Kritika Malhotra,Apex JEE-Adv 2027,71.2,60,57,54,51,48,45,42,46,49,Rotational Dynamics;Electrostatics & Capacitors
REG-2027-803,Devansh Chaturvedi,Apex JEE-Adv 2027,88.0,68,70,73,76,78,81,79,76,84,Chemical Equilibrium & Ionic;Definite Integration & Area`;

const SAMPLE_RESULTS_ONLY_CSV = `RegNo,StudentName,T1,T2,T3,T4,T5,T6,Physics,Chemistry,Math,WeakTopics
REG-2027-101,Aarav Mehta,94,95,96,97,98,99,99,98,100,Wave Optics & Interference
REG-2027-105,Kabir Singhania,76,78,81,84,86,88,87,85,90,Coordination Compounds;Definite Integration & Area
REG-2027-804,Niharika Deshmukh,74,76,79,81,84,86,85,83,89,Thermodynamics & Carnot Cycle`;

const SAMPLE_ATTENDANCE_ONLY_CSV = `RegNo,StudentName,ClassesAttended,ClassesHeld,AttendancePct
REG-2027-101,Aarav Mehta,142,146,97.3
REG-2027-105,Kabir Singhania,135,146,92.5
REG-2027-106,Ishaan Verma,131,146,89.7`;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

const MAX_PREVIEW_ROWS = 50;

export const DataImportModal: React.FC<DataImportModalProps> = ({
  batches,
  activeBatch,
  onClose,
  onCommitRows,
  onClearDatabase,
}) => {
  const [targetBatchId, setTargetBatchId] = useState<string>('__auto_from_file__');
  const [uploadCategory, setUploadCategory] = useState<UploadCategory>('combined');
  const [parsedRows, setParsedRows] = useState<UploadedStudentRow[]>([]);
  const [rawPasteText, setRawPasteText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseStatus, setParseStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);

  const selectedBatch = batches.find((b) => b.id === targetBatchId) || activeBatch;
  const fallbackBatchName = selectedBatch?.name || 'Uploaded Coaching Batch';
  const existingBatchRegKeys = new Set(
    batches.flatMap((b) =>
      b.students.map((s) => `${b.name.trim().toUpperCase()}__${s.regNo.trim().toUpperCase()}`)
    )
  );

  const extractMergedRowsFromSheet = (sheet: XLSX.WorkSheet): Record<string, unknown>[] => {
    // Detect if the actual header row is offset below a title banner (scan first 10 rows)
    const matrix = XLSX.utils.sheet_to_json< unknown[] >(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });
    let headerRowOffset = 0;
    for (let r = 0; r < Math.min(10, matrix.length); r++) {
      const rowCells = (matrix[r] || []).map((c) => String(c ?? '').toLowerCase());
      const hasRegOrName = rowCells.some((c) =>
        /reg\s*_?no|registration|roll\s*_?no|student\s*_?name|candidate|batch/i.test(c)
      );
      const hasScoreOrTest = rowCells.some((c) =>
        /test|score|marks|out\s*of|attendance|physics|chemistry|math/i.test(c)
      );
      if (hasRegOrName && hasScoreOrTest) {
        headerRowOffset = r;
        break;
      }
    }

    const formattedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
      blankrows: false,
      range: headerRowOffset,
    });
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: true,
      blankrows: false,
      range: headerRowOffset,
    });

    return formattedRows.map((fRow, idx) => {
      const rRow = rawRows[idx] || {};
      const merged: Record<string, unknown> = { ...fRow };
      for (const key of Object.keys(merged)) {
        const val = merged[key];
        const rawVal = rRow[key];
        if (typeof val === 'string' && val.trim().startsWith('###') && rawVal !== undefined) {
          merged[key] = rawVal;
        } else if (
          typeof rawVal === 'number' &&
          /out\s*of|max\s*marks|total\s*marks|full\s*marks|score|marks|rank|attended|held/i.test(
            key
          ) &&
          !/avg|pct|percent/i.test(key)
        ) {
          merged[key] = rawVal;
        }
      }
      return merged;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseStatus(null);
    setErrorMessage(null);
    setIsExtracting(true);

    // Yield one frame so the loading spinner paints immediately before parsing large workbooks
    await new Promise((resolve) => setTimeout(resolve, 25));

    const lower = file.name.toLowerCase();

    try {
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        let totalRawRows = 0;
        const allNormalized: UploadedStudentRow[] = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          const jsonRows = extractMergedRowsFromSheet(sheet);
          if (jsonRows.length === 0) continue;
          totalRawRows += jsonRows.length;

          const isGenericSheetName = /^sheet\d*$|^data$|^result|^export|^table/i.test(
            sheetName.trim()
          );
          const sheetFallbackBatch = !isGenericSheetName
            ? sheetName.trim()
            : fallbackBatchName;

          const normalizedSheet = normalizeSmartExcelRows(
            jsonRows,
            sheetFallbackBatch,
            uploadCategory
          );
          allNormalized.push(...normalizedSheet);
        }

        if (allNormalized.length > 0) {
          const uniqueBatches = Array.from(
            new Set(allNormalized.map((r) => r.batchName).filter(Boolean))
          );
          setParsedRows(allNormalized);
          setParseStatus(
            `Processed ${totalRawRows} spreadsheet rows into ${
              allNormalized.length
            } student records strictly isolated across ${uniqueBatches.length} batch${
              uniqueBatches.length === 1 ? '' : 'es'
            }: ${uniqueBatches.slice(0, 6).join(', ')}${
              uniqueBatches.length > 6 ? '...' : ''
            }.`
          );
          setIsExtracting(false);
          return;
        }
      }

      if (lower.endsWith('.pdf')) {
        const buffer = await file.arrayBuffer();
        const base64Data = arrayBufferToBase64(buffer);
        let rawTextFallback = '';
        try {
          rawTextFallback = await file.text();
        } catch {
          rawTextFallback = '';
        }

        const response = await fetch('/api/ingest/extract-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data,
            rawTextFallback,
            batchName: fallbackBatchName,
            uploadCategory,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as {
            rows: UploadedStudentRow[];
            engine: string;
          };
          if (Array.isArray(data.rows) && data.rows.length > 0) {
            setParsedRows(data.rows);
            setParseStatus(
              `Extracted ${data.rows.length} structured student records from PDF "${file.name}" (${
                data.engine === 'gemini-3.8-flash'
                  ? 'Gemini AI Table Extractor'
                  : 'Structured PDF Table Parser'
              }).`
            );
            setIsExtracting(false);
            return;
          }
        }
      }

      // Text or fallback table extraction
      const textContent = await file.text();
      const workbook = XLSX.read(textContent, { type: 'string' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: '',
        raw: false,
      });

      if (jsonRows.length > 0) {
        const normalized = normalizeSmartExcelRows(
          jsonRows,
          fallbackBatchName,
          uploadCategory
        );
        if (normalized.length > 0) {
          setParsedRows(normalized);
          setParseStatus(
            `Extracted ${normalized.length} unique student records from "${file.name}".`
          );
          setIsExtracting(false);
          return;
        }
      }

      const extracted = parseDelimitedOrPdfTextToRows(
        textContent,
        fallbackBatchName,
        uploadCategory
      );
      if (extracted.length > 0) {
        setParsedRows(extracted);
        setParseStatus(
          `Extracted ${extracted.length} student records from "${file.name}".`
        );
      } else {
        setErrorMessage(
          `Could not detect valid student rows in "${file.name}". Verify that headers like Reg No and Student Name are present.`
        );
      }
    } catch (err) {
      console.error('File parse error:', err);
      setErrorMessage(
        `Failed to parse "${file.name}". Please ensure it is a valid Excel (.xlsx/.csv) or PDF file.`
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleLoadSamplePreset = (
    presetType: 'coaching_multitest' | 'combined' | 'results_only' | 'attendance_only'
  ) => {
    setErrorMessage(null);
    const category: UploadCategory =
      presetType === 'attendance_only'
        ? 'attendance_only'
        : presetType === 'results_only'
        ? 'results_only'
        : 'combined';
    setUploadCategory(category);

    if (presetType === 'coaching_multitest') {
      setTargetBatchId('__auto_from_file__');
    }

    const csvSource =
      presetType === 'coaching_multitest'
        ? SAMPLE_COACHING_MULTITEST_CSV
        : presetType === 'attendance_only'
        ? SAMPLE_ATTENDANCE_ONLY_CSV
        : presetType === 'results_only'
        ? SAMPLE_RESULTS_ONLY_CSV
        : SAMPLE_COMBINED_CSV;
    setRawPasteText(csvSource);

    const workbook = XLSX.read(csvSource, { type: 'string' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      defval: '',
      raw: false,
    });
    const rows = normalizeSmartExcelRows(jsonRows, fallbackBatchName, category);
    const uniqueBatches = Array.from(new Set(rows.map((r) => r.batchName)));
    setParsedRows(rows);
    setParseStatus(
      `Grouped ${jsonRows.length} raw rows into ${rows.length} student records strictly separated across batch${
        uniqueBatches.length === 1 ? '' : 'es'
      } ${uniqueBatches.join(', ')} ready to commit to Cloud SQL PostgreSQL.`
    );
  };

  const handleParseRawText = () => {
    setErrorMessage(null);
    const source = rawPasteText.trim() || SAMPLE_COACHING_MULTITEST_CSV;

    const workbook = XLSX.read(source, { type: 'string' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      defval: '',
      raw: false,
    });

    if (jsonRows.length > 0) {
      const rows = normalizeSmartExcelRows(
        jsonRows,
        fallbackBatchName,
        uploadCategory
      );
      if (rows.length > 0) {
        setParsedRows(rows);
        setParseStatus(
          `Grouped ${jsonRows.length} raw rows into ${rows.length} unique student profiles ready for Cloud SQL commit.`
        );
        return;
      }
    }

    const rows = parseDelimitedOrPdfTextToRows(
      source,
      fallbackBatchName,
      uploadCategory
    );
    setParsedRows(rows);
    setParseStatus(
      `Parsed ${rows.length} student rows ready to merge by Reg No.`
    );
  };

  const handleDownloadSampleTemplate = () => {
    const csvSource =
      uploadCategory === 'attendance_only'
        ? SAMPLE_ATTENDANCE_ONLY_CSV
        : uploadCategory === 'results_only'
        ? SAMPLE_RESULTS_ONLY_CSV
        : SAMPLE_COACHING_MULTITEST_CSV;
    const blob = new Blob([csvSource], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aetheris_${uploadCategory}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCommit = async () => {
    if (parsedRows.length === 0 || isCommitting) return;
    setIsCommitting(true);
    setErrorMessage(null);
    try {
      await onCommitRows(targetBatchId, parsedRows, uploadCategory);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to save student records to Cloud SQL PostgreSQL. Please try again.'
      );
    } finally {
      setIsCommitting(false);
    }
  };

  const previewSlice = parsedRows.slice(0, MAX_PREVIEW_ROWS);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full p-6 space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 id="import-modal-title" className="text-base font-bold text-slate-100">
                Cloud SQL Data Ingestion — Multi-Test Excel (.xlsx/.csv) & PDF Extractor
              </h2>
              <p className="text-xs text-slate-400">
                Supports test-by-test coaching sheets (Milestone / AITS logs with Out of, Score,
                Avg. Score, Avg. Physics/Chem/Maths) and auto-creates batches from your file.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close import modal"
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File Data Type Selector */}
        <div className="space-y-2">
          <span className="block text-xs font-medium text-slate-300">
            1. Select Uploaded File Structure (Merged Non-Destructively by Registration No)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setUploadCategory('combined')}
              className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                uploadCategory === 'combined'
                  ? 'bg-indigo-600/15 border-indigo-500 text-slate-100'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-semibold">Combined / Multi-Test Log</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Groups multi-test rows (Milestone / AITS) & attendance by Reg No
              </div>
            </button>

            <button
              type="button"
              onClick={() => setUploadCategory('results_only')}
              className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                uploadCategory === 'results_only'
                  ? 'bg-indigo-600/15 border-indigo-500 text-slate-100'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-semibold">Result Sheet Only (Marks / %)</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Updates test scores & weak topics; preserves existing attendance
              </div>
            </button>

            <button
              type="button"
              onClick={() => setUploadCategory('attendance_only')}
              className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                uploadCategory === 'attendance_only'
                  ? 'bg-indigo-600/15 border-indigo-500 text-slate-100'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-semibold">Attendance Report Only</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Updates attendance by Reg No; preserves all test scores
              </div>
            </button>
          </div>
        </div>

        {/* Target Batch & Template Download */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-7">
            <label
              htmlFor="import-batch-target"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              2. Batch Routing in Cloud SQL PostgreSQL
            </label>
            <select
              id="import-batch-target"
              value={targetBatchId}
              onChange={(e) => setTargetBatchId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
            >
              <option value="__auto_from_file__">
                Auto-Create / Match Batch from Excel &apos;batch&apos; Column (e.g. S1A-LJ21W)
              </option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  Force into: {b.name} ({b.code}) — {b.students.length} students in DB
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-5 flex justify-end">
            <button
              type="button"
              onClick={handleDownloadSampleTemplate}
              className="w-full sm:w-auto px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-indigo-300 border border-slate-800 rounded-lg text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Sample Excel/CSV Template</span>
            </button>
          </div>
        </div>

        {/* File Dropzone */}
        <div className="p-5 bg-slate-950 border border-dashed border-slate-700 rounded-xl text-center space-y-2.5">
          {isExtracting ? (
            <div className="flex flex-col items-center justify-center py-2 space-y-2">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              <p className="text-xs font-medium text-indigo-300">
                Grouping test rows by Reg No from {fileName}...
              </p>
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 text-indigo-400 mx-auto" />
              <div className="space-y-1">
                <label
                  htmlFor="spreadsheet-pdf-file-input"
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer underline"
                >
                  Select an Excel (.xlsx/.xls), CSV (.csv), or PDF (.pdf) file
                </label>
                <input
                  id="spreadsheet-pdf-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf,.txt"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
                <p className="text-[11px] text-slate-400">
                  Supports multi-row coaching sheets (Reg No, student_name, batch, test_name, Out
                  of, Score, Avg. Score, Avg. Physics, Avg. Chemistry, Avg. Maths, Offline Rank)
                </p>
                {fileName && (
                  <p className="text-xs text-emerald-400 font-mono-tabular pt-1">
                    Loaded file: {fileName}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Or Paste / Load Sample Presets */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="raw-csv-paste"
              className="text-xs font-medium text-slate-300 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Or Test Instant Presets (Including Your Exact Coaching Format):</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleLoadSamplePreset('coaching_multitest')}
                className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
              >
                Load Sample Milestone / AITS Sheet (S1A-LJ21W)
              </button>
              <button
                type="button"
                onClick={() => handleLoadSamplePreset('results_only')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
              >
                Sample Result-Only Merge
              </button>
              <button
                type="button"
                onClick={() => handleLoadSamplePreset('attendance_only')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
              >
                Sample Attendance-Only Merge
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <textarea
              id="raw-csv-paste"
              rows={3}
              value={rawPasteText}
              onChange={(e) => setRawPasteText(e.target.value)}
              placeholder={SAMPLE_COACHING_MULTITEST_CSV}
              className="flex-1 p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono-tabular text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
            {rawPasteText.trim().length > 0 && (
              <button
                type="button"
                onClick={handleParseRawText}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium self-stretch cursor-pointer"
              >
                Parse Text
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-950/50 border border-rose-800/70 rounded-lg flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Parsed Preview Table */}
        {parseStatus && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg flex items-center justify-between gap-2 text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{parseStatus}</span>
            </div>
            {parsedRows.length > MAX_PREVIEW_ROWS && (
              <span className="text-[11px] text-emerald-400/80 shrink-0">
                Previewing first {MAX_PREVIEW_ROWS} of {parsedRows.length} students
              </span>
            )}
          </div>
        )}

        {previewSlice.length > 0 && (
          <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-56">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="py-2 px-3">Reg No</th>
                  <th className="py-2 px-3">Student Name</th>
                  <th className="py-2 px-3">Center &amp; Batch</th>
                  <th className="py-2 px-3">DB Action</th>
                  <th className="py-2 px-3 text-right">Appeared / Total Tests</th>
                  <th className="py-2 px-3 text-right">Exact Test Marks (Latest &amp; Best)</th>
                  <th className="py-2 px-3 text-right">Avg Phy / Chem / Math</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono-tabular">
                {previewSlice.map((r, i) => {
                  const rowBatchUpper = (r.batchName || fallbackBatchName).trim().toUpperCase();
                  const isMerge = existingBatchRegKeys.has(
                    `${rowBatchUpper}__${r.regNo.trim().toUpperCase()}`
                  );
                  const attDisplay =
                    r.testsScheduled !== undefined
                      ? `${r.testsAppeared}/${r.testsScheduled} (${r.attendancePct}%)`
                      : r.attendancePct !== undefined
                      ? `${r.attendancePct}%`
                      : 'Preserved';

                  const appearedTests = (r.parsedTestAttempts || []).filter(
                    (t) => t.appeared !== false
                  );
                  const latestTest =
                    appearedTests.length > 0
                      ? appearedTests[appearedTests.length - 1]
                      : undefined;
                  const bestTest =
                    appearedTests.length > 0
                      ? [...appearedTests].sort((a, b) => b.percentage - a.percentage)[0]
                      : undefined;

                  const marksDisplay =
                    r.testsAppeared === 0
                      ? `Absent (0 / ${r.parsedTestAttempts?.[0]?.maxMarks ?? 300})`
                      : latestTest
                      ? `${latestTest.totalMarks} / ${latestTest.maxMarks} (${latestTest.percentage.toFixed(
                          2
                        )}%)${
                          bestTest && bestTest.testId !== latestTest.testId
                            ? ` · Best: ${bestTest.totalMarks}/${bestTest.maxMarks}`
                            : ''
                        }`
                      : r.rawScoreMarks !== undefined && r.outOfMarks
                      ? `${r.rawScoreMarks} / ${r.outOfMarks} (${(
                          (r.rawScoreMarks / r.outOfMarks) *
                          100
                        ).toFixed(2)}%)`
                      : r.test6Pct !== undefined
                      ? `${r.test6Pct}%`
                      : 'Preserved';
                  return (
                    <tr key={`${r.batchName}-${r.regNo}-${i}`}>
                      <td className="py-2 px-3 text-slate-300">{r.regNo}</td>
                      <td className="py-2 px-3 font-sans font-medium text-slate-100">
                        {r.name}
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <div className="text-indigo-300 font-medium">{r.batchName}</div>
                        {(r.centerName || r.combinedCenterName) && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                            {r.combinedCenterName ? `${r.combinedCenterName} · ` : ''}
                            {r.centerName}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 font-sans">
                        {isMerge ? (
                          <span className="text-amber-300 text-[11px] font-medium">
                            Merge Reg No
                          </span>
                        ) : (
                          <span className="text-emerald-400 text-[11px] font-medium">
                            New Student
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-300">{attDisplay}</td>
                      <td className="py-2 px-3 text-right text-indigo-400 font-semibold">
                        {marksDisplay}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400">
                        {r.physicsPct !== undefined ||
                        r.chemistryPct !== undefined ||
                        r.mathOrBioPct !== undefined
                          ? `${r.physicsPct ?? '-'}% / ${r.chemistryPct ?? '-'}% / ${
                              r.mathOrBioPct ?? '-'
                            }%`
                          : 'Preserved'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                Strict per-batch isolation — each Excel row routes to its exact Batch column
              </span>
            </div>
            {onClearDatabase && batches.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  void onClearDatabase();
                }}
                className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border border-rose-700/50 rounded text-[11px] font-medium transition-colors cursor-pointer"
              >
                Clear All Existing DB Data
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-950 text-slate-300 border border-slate-800 rounded-lg text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={parsedRows.length === 0 || isCommitting}
              onClick={handleCommit}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                parsedRows.length > 0 && !isCommitting
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isCommitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                Commit {parsedRows.length > 0 ? `${parsedRows.length} Student Records` : 'Records'}{' '}
                to Database
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
