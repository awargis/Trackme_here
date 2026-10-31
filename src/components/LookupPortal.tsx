import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  FileSpreadsheet,
  Search,
  SlidersHorizontal,
  UserCheck,
  Users,
} from 'lucide-react';
import { BatchRecord, StudentRecord } from '../types/academic';
import {
  computeBatchAnalytics,
  enrichStudentSummaryFromAttempts,
  getStudentExactScoreSummary,
  resolveLookupQuery,
} from '../utils/analyticsEngine';

interface LookupPortalProps {
  batches: BatchRecord[];
  onOpenStudent: (student: StudentRecord, batch: BatchRecord) => void;
  onOpenBatch: (batch: BatchRecord) => void;
  onOpenImportModal: () => void;
}

export const LookupPortal: React.FC<LookupPortalProps> = ({
  batches,
  onOpenStudent,
  onOpenBatch,
  onOpenImportModal,
}) => {
  const [lookupMode, setLookupMode] = useState<'student' | 'batch'>('student');
  const [studentQuery, setStudentQuery] = useState('');
  const [batchQuery, setBatchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveMatches, setLiveMatches] = useState<StudentRecord[]>([]);

  const totalStudentsCount = batches.reduce((acc, b) => acc + b.students.length, 0);
  const totalTestsCount = batches.reduce((acc, b) => acc + b.tests.length, 0);

  const handleStudentInputChange = (value: string) => {
    setStudentQuery(value);
    setErrorMessage(null);

    if (value.trim().length >= 2) {
      const res = resolveLookupQuery(batches, value, batchQuery);
      if (res.candidateStudents && res.candidateStudents.length > 0) {
        setLiveMatches(res.candidateStudents.slice(0, 5));
      } else {
        setLiveMatches([]);
      }
    } else {
      setLiveMatches([]);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (lookupMode === 'batch') {
      const targetQ = batchQuery.trim() || batches[0]?.name || '';
      const res = resolveLookupQuery(batches, '', targetQ);
      if (res.mode === 'batch' && res.matchedBatch) {
        onOpenBatch(res.matchedBatch);
      } else {
        setErrorMessage(
          res.errorMessage || 'Please select or enter a valid Batch Name to view batch analytics.'
        );
      }
      return;
    }

    if (!studentQuery.trim()) {
      setErrorMessage(
        'Please enter a Student Name (e.g., NAMAN RAJPUT or Aarav Mehta) or Registration No (e.g., 23273301).'
      );
      return;
    }

    const res = resolveLookupQuery(batches, studentQuery, batchQuery);
    if (res.mode === 'student' && res.matchedStudent && res.matchedBatch) {
      onOpenStudent(res.matchedStudent, res.matchedBatch);
    } else if (res.mode === 'batch' && res.matchedBatch) {
      onOpenBatch(res.matchedBatch);
    } else {
      setErrorMessage(
        res.errorMessage || 'No matching student record found. Check the name or registration ID.'
      );
    }
  };

  const quickPresetStudents: { label: string; student: StudentRecord; batch: BatchRecord }[] = [];
  const pushPreset = (s: StudentRecord, b: BatchRecord) => {
    if (quickPresetStudents.some((p) => p.student.regNo === s.regNo)) return;
    const enriched = enrichStudentSummaryFromAttempts(s);
    const scoreMeta = getStudentExactScoreSummary(enriched);
    const label = scoreMeta.hasAppeared
      ? `${b.name} · Latest: ${scoreMeta.latestMarks}/${scoreMeta.latestMax} · Best: ${scoreMeta.bestMarks}/${scoreMeta.bestMax}`
      : `${b.name} · 0/${enriched.testsScheduledCount ?? 1} Appeared (Absent)`;
    quickPresetStudents.push({
      label,
      student: enriched,
      batch: b,
    });
  };

  // Highlight coaching batch S1A-LJ21W students first if available, then top JEE/NEET profiles
  const coachingBatch = batches.find((b) => b.name.toUpperCase() === 'S1A-LJ21W');
  if (coachingBatch) {
    for (const s of coachingBatch.students.slice(0, 2)) {
      pushPreset(s, coachingBatch);
    }
  }
  for (const b of batches) {
    for (const s of b.students) {
      if (quickPresetStudents.length < 4) {
        pushPreset(s, b);
      }
    }
  }

  return (
    <div className="space-y-12 pb-16 transition-all duration-300">
      {/* Hero Split Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-4">
        {/* Left Column: Executive Introduction & Command Search */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-indigo-950/30 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-xl">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>Academic Telemetry &amp; Diagnostic Suite</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-indigo-300 font-semibold">
                {batches.length} Active Batches
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{totalStudentsCount} Enrolled Profiles</span>
            </div>

            <h1
              className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Precision Student Diagnostics & Longitudinal Batch Intelligence
            </h1>

            <p className="text-slate-300 text-base leading-relaxed max-w-2xl">
              Enter a student’s name or registration number alongside their batch to inspect
              exact test-by-test scores, attendance vitality, and targeted practice questions for weak
              topics—or launch a full batch command dashboard for top/bottom decile and
              intervention analytics.
            </p>

            {/* Interactive Mode Segmented Switch */}
            <div
              role="tablist"
              aria-label="Lookup mode selector"
              className="inline-flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
            >
              <button
                type="button"
                role="tab"
                aria-selected={lookupMode === 'student'}
                onClick={() => {
                  setLookupMode('student');
                  setErrorMessage(null);
                }}
                className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                  lookupMode === 'student'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Student / Parent Lookup
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={lookupMode === 'batch'}
                onClick={() => {
                  setLookupMode('batch');
                  setErrorMessage(null);
                }}
                className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                  lookupMode === 'batch'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Teacher Batch Command Lookup
              </button>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearchSubmit} className="space-y-4 pt-2">
              {lookupMode === 'student' ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-7 relative">
                    <label
                      htmlFor="student-lookup-input"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Student Name or Registration No.
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="student-lookup-input"
                        type="text"
                        value={studentQuery}
                        onChange={(e) => handleStudentInputChange(e.target.value)}
                        placeholder="e.g. NAMAN RAJPUT, 23273301, or Aarav Mehta"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    {/* Autocomplete Quick Matches Dropdown */}
                    {liveMatches.length > 0 && (
                      <div className="mt-1.5 bg-slate-950 border border-slate-800 rounded-lg divide-y divide-slate-800/80 overflow-hidden">
                        {liveMatches.map((match) => {
                          const matchBatch =
                            batches.find((b) => b.id === match.batchId) || batches[0];
                          if (!matchBatch) return null;
                          const sm = getStudentExactScoreSummary(match);
                          return (
                            <button
                              key={match.id}
                              type="button"
                              onClick={() => onOpenStudent(match, matchBatch)}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-slate-900 flex items-center justify-between gap-3 transition-colors"
                            >
                              <div>
                                <span className="text-sm font-medium text-slate-100">
                                  {match.name}
                                </span>
                                <span className="text-xs text-slate-400 ml-2 font-mono-tabular">
                                  {match.regNo} · {match.batchName}
                                </span>
                              </div>
                              <span className="text-xs font-mono-tabular text-indigo-400 whitespace-nowrap shrink-0">
                                {sm.hasAppeared
                                  ? `${sm.latestMarks}/${sm.latestMax} (${match.overallAvgPct}% Mean) →`
                                  : `Absent (0%) →`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-5">
                    <label
                      htmlFor="batch-select-input"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Batch Name (Optional Filter)
                    </label>
                    <select
                      id="batch-select-input"
                      value={batchQuery}
                      onChange={(e) => {
                        setBatchQuery(e.target.value);
                        setErrorMessage(null);
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="">All Academic Batches</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-12">
                    <label
                      htmlFor="teacher-batch-input"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Enter or Select Batch Name for Complete Teacher Analytics
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        id="teacher-batch-input"
                        type="text"
                        value={batchQuery}
                        onChange={(e) => {
                          setBatchQuery(e.target.value);
                          setErrorMessage(null);
                        }}
                        placeholder="Type batch name e.g. LJ121, AJ221EA, or S1A-LJ21W"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <select
                        aria-label="Quick select batch"
                        value={batchQuery}
                        onChange={(e) => {
                          setBatchQuery(e.target.value);
                          setErrorMessage(null);
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                      >
                        <option value="">Select Loaded Batch</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.name}>
                            {b.name} — {b.stream}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="px-4 py-2.5 bg-rose-950/50 border border-rose-800/70 rounded-lg text-xs text-rose-200"
                >
                  {errorMessage}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>
                    {lookupMode === 'student'
                      ? 'Open Student Performance Dashboard'
                      : 'Launch Batch Command Dashboard'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                  <span>Upload Excel / PDF Marks</span>
                </button>
              </div>
            </form>
          </div>

          {/* Quick Profiles Strip */}
          <div className="pt-6 mt-6 border-t border-slate-800/80">
            <div className="text-xs text-slate-400 mb-3">
              {quickPresetStudents.length > 0
                ? 'Loaded Student Profiles (Exact Per-Test Excel Marks — Click to inspect full dossier):'
                : 'Database Clean & Ready — Upload your Excel sheet to populate batches & student profiles:'}
            </div>
            {quickPresetStudents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {quickPresetStudents.map(({ label, student, batch }) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => onOpenStudent(student, batch)}
                    className="px-3.5 py-2.5 bg-slate-950/70 hover:bg-slate-800/80 rounded-lg text-left transition-colors flex items-center justify-between gap-2 group cursor-pointer border border-slate-800/60"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                        {student.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-tabular truncate">
                        {student.regNo} · {label}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono-tabular font-semibold text-indigo-400">
                        {student.overallAvgPct}%
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono-tabular">
                        Att {student.attendancePct}%
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-300">
                  All previous demo/seed rows have been removed from the database. Upload your new
                  Excel file to populate exact batch-isolated results.
                </div>
                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Upload New Excel Sheet</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Batch Telemetry & Instant Teacher Access */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900/90 border border-slate-800 rounded-xl p-6 sm:p-8">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Active Academic Batches
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select any batch to inspect Top 10, Bottom 10, longitudinal growth &amp; Excel sheet ledger
                </p>
              </div>
              <Users className="w-5 h-5 text-indigo-400 shrink-0" />
            </div>

            {batches.length > 0 ? (
              <div className="divide-y divide-slate-800/80 border-t border-b border-slate-800/80">
                {batches.map((batch) => {
                  const summary = computeBatchAnalytics(batch);
                  return (
                    <div
                      key={batch.id}
                      className="py-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-100">
                            {batch.name}
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {batch.stream} · <span className="font-mono-tabular">{batch.code}</span> ·{' '}
                            {batch.leadFaculty}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenBatch(batch)}
                          className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Open Batch View →
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2 pt-1 text-xs">
                        <div>
                          <div className="text-slate-500">Students</div>
                          <div className="font-mono-tabular font-semibold text-slate-200 mt-0.5">
                            {summary.totalStudents}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Batch Avg</div>
                          <div className="font-mono-tabular font-semibold text-slate-200 mt-0.5">
                            {summary.overallBatchAvgPct}%
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Net Growth</div>
                          <div
                            className={`font-mono-tabular font-semibold mt-0.5 ${
                              summary.overallGrowthDeltaPct >= 0
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {summary.overallGrowthDeltaPct >= 0 ? '+' : ''}
                            {summary.overallGrowthDeltaPct}%
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Interventions</div>
                          <div className="font-mono-tabular font-semibold text-amber-400 mt-0.5">
                            {summary.interventionStudents.length} flagged
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 px-4 text-center border-t border-b border-slate-800/80 space-y-3">
                <FileSpreadsheet className="w-8 h-8 text-indigo-400 mx-auto opacity-80" />
                <div className="text-sm font-semibold text-slate-200">
                  0 Batches in Database (Ready for Fresh Upload)
                </div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  Upload your Excel result sheet to automatically create each batch from the{' '}
                  <span className="font-mono-tabular text-indigo-300">batch</span> column (e.g.,{' '}
                  <span className="font-mono-tabular text-indigo-300">LJ121</span>,{' '}
                  <span className="font-mono-tabular text-indigo-300">AJ221EA</span>) with strict
                  per-batch student isolation.
                </p>
                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Import Excel / PDF Result Sheet</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-5 mt-6 border-t border-slate-800/80 flex items-center justify-between gap-4 text-xs text-slate-400">
            <span>
              Supports Excel (<span className="font-mono-tabular">.xlsx</span>), CSV, and PDF
              assessment sheets
            </span>
            <span className="font-mono-tabular text-slate-300">
              {totalTestsCount} Chronological Tests Indexed
            </span>
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column Capability & Workflow Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>01. Instant Profile Lookup</span>
            <Search className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-100">
            Name or Registration ID Search
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Parents, students, or faculty can enter a student name or registration number with
            their batch to open an interactive performance dossier.
          </p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>02. Cohort Intelligence</span>
            <BarChart3 className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-100">
            Top 10, Bottom 10 & Growth Curves
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Teachers inspect longitudinal batch growth across sequential tests, top/bottom
            decile benchmarks, and automated attendance-score intervention flags.
          </p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>03. Topic Remediation</span>
            <BookOpen className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-100">
            Weak-Topic Question Prescriptions
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Automatically isolates chapters with sub-benchmark accuracy and prescribes
            interactive, syllabus-aligned practice questions with step-by-step solutions.
          </p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>04. Governed Communication</span>
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-100">
            Admin-Approved Parent Reports
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Queue comprehensive student progress reports for parents or class teachers with
            formal administrator approval gating and printable PDF dossiers.
          </p>
        </div>
      </section>
    </div>
  );
};
