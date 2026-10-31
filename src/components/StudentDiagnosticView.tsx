import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileText,
  HelpCircle,
  MapPin,
  Printer,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  BatchRecord,
  PracticeQuestion,
  StudentRecord,
} from '../types/academic';
import {
  computeBatchAnalytics,
  enrichStudentSummaryFromAttempts,
  getStudentExactScoreSummary,
  getStudentWeakTopicDiagnostics,
} from '../utils/analyticsEngine';

interface StudentDiagnosticViewProps {
  student: StudentRecord;
  batch: BatchRecord;
  questionBank: PracticeQuestion[];
  onBackToBatch: () => void;
  onSelectStudent: (student: StudentRecord, batch: BatchRecord) => void;
  onQueueReport: (student: StudentRecord, batch: BatchRecord) => void;
}

export const StudentDiagnosticView: React.FC<StudentDiagnosticViewProps> = ({
  student: rawStudent,
  batch,
  questionBank,
  onBackToBatch,
  onSelectStudent,
  onQueueReport,
}) => {
  const student = enrichStudentSummaryFromAttempts(rawStudent);
  const scoreMeta = getStudentExactScoreSummary(student);
  const batchSummary = computeBatchAnalytics(batch);
  const { weakTopics, strongTopics } = getStudentWeakTopicDiagnostics(
    student,
    questionBank
  );

  // Default to the latest appeared test so subject marks & score breakdown are never zeroed by a trailing absent test
  const findDefaultAttemptIndex = () => {
    for (let i = student.testAttempts.length - 1; i >= 0; i--) {
      if (student.testAttempts[i].appeared !== false) {
        return i;
      }
    }
    return Math.max(0, student.testAttempts.length - 1);
  };

  const [selectedAttemptIdx, setSelectedAttemptIdx] = useState<number>(
    findDefaultAttemptIndex
  );

  useEffect(() => {
    setSelectedAttemptIdx(findDefaultAttemptIndex());
  }, [student.id, student.testAttempts.length]);

  const [activeTopicId, setActiveTopicId] = useState<string>(
    weakTopics[0]?.topicId || student.topicScores[0]?.topicId || ''
  );
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});
  const [queuedFeedback, setQueuedFeedback] = useState(false);

  const selectedTopicDiag =
    weakTopics.find((t) => t.topicId === activeTopicId) || weakTopics[0];

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  const handleToggleSolution = (questionId: string) => {
    setRevealedSolutions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleQuickQueueReport = () => {
    setQueuedFeedback(true);
    setTimeout(() => {
      setQueuedFeedback(false);
      onQueueReport(student, batch);
    }, 350);
  };

  // SVG Test Progression Chart Coordinates
  const chartWidth = 740;
  const chartHeight = 250;
  const padLeft = 46;
  const padRight = 26;
  const padTop = 24;
  const padBottom = 42;
  const innerW = chartWidth - padLeft - padRight;
  const innerH = chartHeight - padTop - padBottom;

  const yMin = 0;
  const yMax = 100;

  const xForIndex = (idx: number, total: number) => {
    if (total <= 1) return padLeft + innerW / 2;
    return padLeft + (idx / (total - 1)) * innerW;
  };

  const yForPct = (pct: number) => {
    const clamped = Math.min(yMax, Math.max(yMin, pct));
    return padTop + innerH - ((clamped - yMin) / (yMax - yMin)) * innerH;
  };

  const studentLinePoints = student.testAttempts
    .map((t, i) => `${xForIndex(i, student.testAttempts.length)},${yForPct(t.percentage)}`)
    .join(' ');

  const studentAreaPoints =
    student.testAttempts.length > 0
      ? `${xForIndex(0, student.testAttempts.length)},${padTop + innerH} ${studentLinePoints} ${xForIndex(
          student.testAttempts.length - 1,
          student.testAttempts.length
        )},${padTop + innerH}`
      : '';

  const batchAvgLinePoints = student.testAttempts
    .map((att, i) => {
      const matchedPt =
        batchSummary.longitudinalSeries.find(
          (pt) =>
            pt.testId === att.testId ||
            pt.testName.toLowerCase() === att.testName.toLowerCase()
        ) || batchSummary.longitudinalSeries[i];
      const pct = matchedPt ? matchedPt.batchAvgPct : batchSummary.overallBatchAvgPct;
      return `${xForIndex(i, student.testAttempts.length)},${yForPct(pct)}`;
    })
    .join(' ');

  const inspectedAttempt =
    student.testAttempts[selectedAttemptIdx] ||
    student.testAttempts[student.testAttempts.length - 1];

  const appearedAttempts = student.testAttempts.filter((t) => t.appeared !== false);

  const avgSubjectPct = (subKey: string) => {
    if (appearedAttempts.length === 0) return 0;
    const vals = appearedAttempts
      .map(
        (att) =>
          att.subjectScores.find((s) =>
            s.subject.toLowerCase().includes(subKey.toLowerCase())
          )?.percentage
      )
      .filter((v): v is number => v !== undefined);
    if (vals.length === 0) return 0;
    return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
  };

  const thirdSubjectName = batch.subjects[2] || 'Mathematics';

  return (
    <div className="space-y-8 pb-16 transition-all duration-300">
      {/* Top Executive Student Dossier Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-indigo-950/30 border border-slate-800/90 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <button
                type="button"
                onClick={onBackToBatch}
                className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium transition-colors no-print cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to {batch.name}</span>
              </button>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-slate-200 font-semibold">
                Reg No: {student.regNo}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-indigo-300 font-medium">
                Batch: {student.batchName}
              </span>
              <span aria-hidden="true">·</span>
              <span>Stream: {student.stream}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight font-display">
                {student.name}
              </h1>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                  student.interventionStatus === 'Urgent Intervention'
                    ? 'bg-rose-950/60 border-rose-700/60 text-rose-300'
                    : student.interventionStatus === 'Watch'
                    ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                    : 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                }`}
              >
                {student.interventionStatus}
              </span>
            </div>

            {/* Coaching Center / Region Metadata Bar */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
              {(student.regionName || student.combinedCenterName || student.centerName) && (
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>
                    {student.regionName ? `Region: ${student.regionName}` : ''}
                    {student.combinedCenterName
                      ? ` · Combined Center: ${student.combinedCenterName}`
                      : ''}
                    {student.centerName ? ` · Center: ${student.centerName}` : ''}
                  </span>
                </span>
              )}
              <span>
                Faculty Lead:{' '}
                <strong className="text-slate-200 font-medium">
                  {student.classTeacherName}
                </strong>
              </span>
            </div>
          </div>

          {/* Quick Student Switcher & Report Dispatch Actions */}
          <div className="flex flex-wrap items-center gap-3 no-print">
            <div>
              <label htmlFor="quick-student-select" className="sr-only">
                Switch Student Profile in Batch
              </label>
              <select
                id="quick-student-select"
                value={student.id}
                onChange={(e) => {
                  const found = batch.students.find((s) => s.id === e.target.value);
                  if (found) onSelectStudent(found, batch);
                }}
                className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {batch.students.map((s) => {
                  const sm = getStudentExactScoreSummary(s);
                  return (
                    <option key={s.id} value={s.id}>
                      #{s.rankInBatch} · {s.name} ({s.regNo}) —{' '}
                      {sm.hasAppeared
                        ? `${sm.latestMarks}/${sm.latestMax} (${s.overallAvgPct}% Mean)`
                        : 'Absent'}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Print Dossier</span>
            </button>

            <button
              type="button"
              onClick={handleQuickQueueReport}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {queuedFeedback ? 'Opening Report Queue...' : 'Send Report to Parent / Teacher'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* 4-Card Executive Student KPI Row with Exact Per-Test Excel Marks */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Selected Assessment Score (Excel Exact)</span>
            <Award className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-bold font-mono-tabular text-slate-50">
              {inspectedAttempt && inspectedAttempt.appeared !== false
                ? `${inspectedAttempt.totalMarks} / ${inspectedAttempt.maxMarks}`
                : scoreMeta.hasAppeared
                ? `${scoreMeta.latestMarks} / ${scoreMeta.latestMax}`
                : 'Absent'}
            </span>
            {(inspectedAttempt?.appeared !== false || scoreMeta.hasAppeared) && (
              <span className="text-sm font-mono-tabular font-semibold text-indigo-400">
                (
                {(inspectedAttempt?.appeared !== false
                  ? inspectedAttempt.percentage
                  : scoreMeta.latestPct
                ).toFixed(2)}
                %)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300 font-mono-tabular truncate">
            {inspectedAttempt ? (
              <>
                <strong className="text-indigo-300">{inspectedAttempt.testName}</strong> (
                {inspectedAttempt.testDate})
                {inspectedAttempt.appeared === false ? ' — Marked Absent' : ''}
              </>
            ) : (
              'No scheduled assessments'
            )}
          </p>
          {/* Interactive Test Switcher Pills inside Card 1 */}
          <div className="flex flex-wrap gap-1 pt-1">
            {student.testAttempts.map((att, tIdx) => {
              const active = tIdx === selectedAttemptIdx;
              const isApp = att.appeared !== false;
              return (
                <button
                  key={`${att.testId}-${tIdx}`}
                  type="button"
                  onClick={() => setSelectedAttemptIdx(tIdx)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular border transition-colors cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-500 font-semibold'
                      : isApp
                      ? 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/40 text-slate-500 border-slate-800/50'
                  }`}
                >
                  {att.testName.replace(/^Milestone[-:\s]*/i, 'M-')}:{' '}
                  {isApp ? `${att.totalMarks}/${att.maxMarks}` : 'Abs'}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Best &amp; Mean Assessment Score</span>
            {student.growthDeltaPct >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-bold font-mono-tabular text-emerald-400">
              {scoreMeta.hasAppeared
                ? `${scoreMeta.bestMarks} / ${scoreMeta.bestMax}`
                : '0 / 0'}
            </span>
            {scoreMeta.hasAppeared && (
              <span className="text-sm font-mono-tabular font-semibold text-slate-200">
                ({scoreMeta.bestPct.toFixed(2)}% Peak)
              </span>
            )}
          </div>
          <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, student.overallAvgPct)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 truncate">
            {scoreMeta.hasAppeared ? (
              <>
                Peak in <strong className="text-slate-200">{scoreMeta.bestTestName}</strong> · Mean
                Across {appearedAttempts.length} Appeared:{' '}
                <strong className="text-indigo-300 font-mono-tabular">
                  {student.overallAvgPct.toFixed(2)}%
                </strong>
              </>
            ) : (
              '0 assessments attempted in schedule'
            )}
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Multi-Tier Rank Standing</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono-tabular text-slate-50">
              #{student.rankInBatch}
            </span>
            <span className="text-xs font-mono-tabular text-indigo-400">
              of {batch.students.length} in Batch ({student.batchPercentile}%ile)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono-tabular text-slate-300 pt-0.5">
            {student.bestOfflineRank && (
              <span>
                Best Offline: <strong className="text-slate-100">#{student.bestOfflineRank}</strong>
              </span>
            )}
            {student.bestRegionalRank && (
              <span>
                Regional: <strong className="text-emerald-400">#{student.bestRegionalRank}</strong>
              </span>
            )}
            {student.bestCenterRank && (
              <span>
                Center: <strong className="text-indigo-300">#{student.bestCenterRank}</strong>
              </span>
            )}
            {!student.bestOfflineRank && !student.bestRegionalRank && !student.bestCenterRank && (
              <span className="text-slate-400">
                {weakTopics.length} priority weak topics flagged
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Attendance &amp; Participation</span>
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-bold font-mono-tabular ${
                student.attendancePct < 75
                  ? 'text-rose-400'
                  : student.attendancePct < 82
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {student.attendancePct}%
            </span>
            <span className="text-xs font-mono-tabular text-slate-400">
              ({appearedAttempts.length}/{student.testAttempts.length} Tests)
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                student.attendancePct < 75
                  ? 'bg-rose-500'
                  : student.attendancePct < 82
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, student.attendancePct)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">
            {student.attendancePct < 75
              ? 'Below 75% benchmark — parent alert advised'
              : 'Meets institutional attendance requirement'}
          </p>
        </div>
      </section>

      {/* Complete Coaching Test-by-Test Score Ledger Table (Exact Mapping of User's Excel Structure) */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>
                Complete Coaching Test-by-Test Ledger ({student.testAttempts.length} Scheduled
                Assessments · {appearedAttempts.length} Appeared)
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Exact mapping of Region, Center, Batch, Test Date, Test Name, Test Type, Out of,
              Marks Obtained (Score), Avg. Score %, Subject % &amp; Marks, and Offline / Regional /
              Center Ranks. Click any row to inspect its breakdown below.
            </p>
          </div>
          <div className="text-xs font-mono-tabular text-slate-300 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg shrink-0">
            {scoreMeta.hasAppeared ? (
              <>
                Latest:{' '}
                <strong className="text-indigo-400">
                  {scoreMeta.latestMarks} / {scoreMeta.latestMax}
                </strong>{' '}
                ({scoreMeta.latestPct.toFixed(2)}%) · Best:{' '}
                <strong className="text-emerald-400">
                  {scoreMeta.bestMarks} / {scoreMeta.bestMax}
                </strong>{' '}
                · Mean: <strong>{student.overallAvgPct.toFixed(2)}%</strong>
              </>
            ) : (
              <span className="text-rose-400">0 Appeared Assessments</span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3">Batch</th>
                <th className="py-3 px-3">Test Date</th>
                <th className="py-3 px-3">Test Name</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3 text-right">Out of</th>
                <th className="py-3 px-3 text-right">Score (Marks)</th>
                <th className="py-3 px-3 text-right">Avg. Score</th>
                <th className="py-3 px-3 text-right">Avg. Physics</th>
                <th className="py-3 px-3 text-right">Avg. Chemistry</th>
                <th className="py-3 px-3 text-right">
                  Avg. {thirdSubjectName === 'Biology' ? 'Biology' : 'Maths'}
                </th>
                <th className="py-3 px-3 text-right">Offline Rank</th>
                <th className="py-3 px-3 text-right">Regional Rank</th>
                <th className="py-3 px-3 text-right">Center Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono-tabular">
              {student.testAttempts.map((att, idx) => {
                const isAppeared = att.appeared !== false;
                const isSelected = idx === selectedAttemptIdx;
                const phy = att.subjectScores.find(
                  (s) => s.subject.toLowerCase() === 'physics'
                );
                const chem = att.subjectScores.find(
                  (s) => s.subject.toLowerCase() === 'chemistry'
                );
                const mathBio =
                  att.subjectScores.find(
                    (s) =>
                      s.subject.toLowerCase().includes('math') ||
                      s.subject.toLowerCase().includes('bio')
                  ) || att.subjectScores[2];

                const offRank = att.offlineRank ?? (isAppeared ? att.rankInTest : undefined);
                const regRank = att.regionalRank;
                const cenRank = att.centerRank;

                return (
                  <tr
                    key={`${att.testId}-${idx}`}
                    onClick={() => setSelectedAttemptIdx(idx)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/40 hover:bg-indigo-950/60'
                        : isAppeared
                        ? 'hover:bg-slate-800/50'
                        : 'bg-slate-950/40 text-slate-500 hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-300 whitespace-nowrap">
                      {att.batchCodeForTest || student.batchName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                      {att.testDate}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-100 whitespace-nowrap">
                      {att.testName}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-400 whitespace-nowrap">
                      {att.testType || 'Main'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {att.maxMarks}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                      {isAppeared ? (
                        <span className="text-slate-100">
                          {att.totalMarks}{' '}
                          <span className="text-slate-500 font-normal">/ {att.maxMarks}</span>
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded bg-rose-950/50 border border-rose-800/50 text-rose-300 text-[10px] font-sans font-medium">
                          Absent
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                      {isAppeared ? (
                        <span
                          className={
                            att.percentage >= 60
                              ? 'text-emerald-400'
                              : att.percentage >= 40
                              ? 'text-indigo-400'
                              : 'text-amber-400'
                          }
                        >
                          {att.percentage.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {isAppeared && phy ? (
                        <div>
                          <span className="text-slate-200">{phy.percentage.toFixed(2)}%</span>
                          <span className="text-[10px] text-slate-500 ml-1">
                            ({phy.marksObtained}/{phy.maxMarks})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {isAppeared && chem ? (
                        <div>
                          <span className="text-slate-200">{chem.percentage.toFixed(2)}%</span>
                          <span className="text-[10px] text-slate-500 ml-1">
                            ({chem.marksObtained}/{chem.maxMarks})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {isAppeared && mathBio ? (
                        <div>
                          <span className="text-slate-200">
                            {mathBio.percentage.toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-slate-500 ml-1">
                            ({mathBio.marksObtained}/{mathBio.maxMarks})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {isAppeared && offRank ? `#${offRank}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-medium">
                      {isAppeared && regRank ? `#${regRank}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-indigo-300 font-medium">
                      {isAppeared && cenRank ? `#${cenRank}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {appearedAttempts.length > 0 && (
              <tfoot>
                <tr className="bg-slate-950/90 border-t border-slate-800 font-mono-tabular text-xs font-semibold text-slate-200">
                  <td colSpan={4} className="py-3 px-3 font-sans text-slate-300">
                    Appeared Assessment Summary ({appearedAttempts.length} of{' '}
                    {student.testAttempts.length} Scheduled Tests — Exact Per-Test Scale)
                  </td>
                  <td className="py-3 px-3 text-right text-slate-400">
                    {scoreMeta.latestMax}
                  </td>
                  <td className="py-3 px-3 text-right text-indigo-300 whitespace-nowrap">
                    Latest: {scoreMeta.latestMarks}/{scoreMeta.latestMax} · Best:{' '}
                    {scoreMeta.bestMarks}/{scoreMeta.bestMax}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-400">
                    {student.overallAvgPct.toFixed(2)}% Mean
                  </td>
                  <td className="py-3 px-3 text-right text-slate-200">
                    {avgSubjectPct('phys').toFixed(2)}% Mean
                  </td>
                  <td className="py-3 px-3 text-right text-slate-200">
                    {avgSubjectPct('chem').toFixed(2)}% Mean
                  </td>
                  <td className="py-3 px-3 text-right text-slate-200">
                    {avgSubjectPct(thirdSubjectName === 'Biology' ? 'bio' : 'math').toFixed(2)}% Mean
                  </td>
                  <td className="py-3 px-3 text-right text-slate-300">
                    {student.bestOfflineRank ? `Best #${student.bestOfflineRank}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-400">
                    {student.bestRegionalRank ? `Best #${student.bestRegionalRank}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right text-indigo-300">
                    {student.bestCenterRank ? `Best #${student.bestCenterRank}` : '—'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Main Split: Test-by-Test Trajectory vs Monthly Attendance & Intervention Reasons */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Columns: Student vs Batch Longitudinal Progression Chart */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Test-by-Test Score Trajectory vs Batch Average
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any test point on the curve to inspect exact subject marks obtained below
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-200">
                <span className="w-2.5 h-0.5 bg-indigo-400 inline-block" />
                {student.name}
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-0.5 bg-slate-500 inline-block" />
                Batch Avg
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto min-w-[540px]"
              role="img"
              aria-label={`Performance trajectory chart for ${student.name}`}
            >
              <defs>
                <linearGradient id="studentScoreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {[0, 25, 50, 75, 100].map((val) => {
                const y = yForPct(val);
                return (
                  <g key={val}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={chartWidth - padRight}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 text-[10px] font-mono-tabular"
                    >
                      {val}%
                    </text>
                  </g>
                );
              })}

              {studentAreaPoints && (
                <polygon points={studentAreaPoints} fill="url(#studentScoreFill)" />
              )}

              {/* Batch Average Comparison Curve */}
              <polyline
                fill="none"
                stroke="#64748b"
                strokeWidth="1.75"
                strokeDasharray="4 4"
                points={batchAvgLinePoints}
              />

              {/* Student Score Curve */}
              <polyline
                fill="none"
                stroke="#818cf8"
                strokeWidth="2.75"
                points={studentLinePoints}
              />

              {/* Interactive Data Points */}
              {student.testAttempts.map((attempt, idx) => {
                const total = student.testAttempts.length;
                const x = xForIndex(idx, total);
                const y = yForPct(attempt.percentage);
                const isAppeared = attempt.appeared !== false;
                const isSelected = idx === selectedAttemptIdx;
                const labelY = y < 36 ? y + 18 : Math.max(18, y - 16);
                const shortTestCode =
                  attempt.testName.length > 11
                    ? attempt.testName.split(' ')[0]
                    : attempt.testName;
                return (
                  <g
                    key={attempt.testId}
                    onClick={() => setSelectedAttemptIdx(idx)}
                    className="cursor-pointer"
                  >
                    {isSelected && (
                      <circle
                        cx={x}
                        cy={y}
                        r="9"
                        fill="none"
                        stroke="#818cf8"
                        strokeWidth="1.5"
                        strokeOpacity="0.6"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? '5.5' : '4.5'}
                      fill={isAppeared ? '#090D16' : '#1e293b'}
                      stroke={isAppeared ? '#818cf8' : '#f43f5e'}
                      strokeWidth="2.5"
                    />
                    <text
                      x={x}
                      y={labelY}
                      textAnchor="middle"
                      className={`text-[10px] font-mono-tabular font-semibold ${
                        isAppeared ? 'fill-slate-100' : 'fill-rose-400'
                      }`}
                    >
                      {isAppeared ? (
                        <>
                          <tspan x={x} dy="0">
                            {attempt.totalMarks}/{attempt.maxMarks}
                          </tspan>
                          <tspan x={x} dy="10" className="fill-indigo-300 text-[9px]">
                            ({attempt.percentage.toFixed(1)}%)
                          </tspan>
                        </>
                      ) : (
                        'Absent'
                      )}
                    </text>
                    <text
                      x={x}
                      y={chartHeight - 10}
                      textAnchor="middle"
                      className={`text-[10px] font-mono-tabular ${
                        isSelected ? 'fill-indigo-300 font-semibold' : 'fill-slate-400'
                      }`}
                    >
                      {shortTestCode}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Selected Assessment Subject Breakdown Strip */}
          {inspectedAttempt && (
            <div className="pt-4 border-t border-slate-800/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-300 font-medium">
                  Subject Marks Breakdown in{' '}
                  <strong className="text-indigo-300">{inspectedAttempt.testName}</strong> (
                  {inspectedAttempt.testDate})
                </span>
                <span className="font-mono-tabular text-slate-200 font-semibold">
                  {inspectedAttempt.appeared !== false
                    ? `Total Score: ${inspectedAttempt.totalMarks} / ${inspectedAttempt.maxMarks} (${inspectedAttempt.percentage}%)`
                    : `Absent (0 / ${inspectedAttempt.maxMarks})`}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {inspectedAttempt.subjectScores.map((sub) => (
                  <div
                    key={sub.subject}
                    className="p-3.5 bg-slate-950/90 border border-slate-800/80 rounded-lg space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">{sub.subject}</span>
                      <span className="font-mono-tabular font-bold text-indigo-400">
                        {inspectedAttempt.appeared !== false
                          ? `${sub.percentage.toFixed(2)}%`
                          : 'Absent'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            inspectedAttempt.appeared !== false
                              ? Math.min(100, sub.percentage)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-tabular">
                      <span>Marks Obtained:</span>
                      <strong className="text-slate-200">
                        {sub.marksObtained} / {sub.maxMarks}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Columns: Monthly Attendance Vitality & Diagnostic Reasons */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Attendance Log &amp; Academic Flags
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Class attendance consistency and automated academic diagnostic triggers
              </p>
            </div>

            <div className="space-y-2.5">
              {student.monthlyAttendance.map((m) => (
                <div key={m.month} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{m.month} 2026</span>
                    <span className="font-mono-tabular text-slate-400">
                      {m.classesAttended}/{m.classesHeld} classes ·{' '}
                      <strong
                        className={
                          m.percentage < 75
                            ? 'text-rose-400'
                            : m.percentage < 82
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }
                      >
                        {m.percentage}%
                      </strong>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        m.percentage < 75
                          ? 'bg-rose-500'
                          : m.percentage < 82
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, m.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Automated Diagnostic Observations */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <AlertTriangle
                className={`w-4 h-4 ${
                  student.interventionStatus === 'Urgent Intervention'
                    ? 'text-rose-400'
                    : student.interventionStatus === 'Watch'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              />
              <span>Diagnostic Observations</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-400">
              {student.interventionReasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-slate-500">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Weak Area Identification & Prescribed Practice Questions Workbench */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Weak-Area Topic Diagnostics &amp; Prescribed Practice Questions
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any weak or moderate syllabus chapter on the left to assign or practice
              targeted remedial questions with step-by-step solutions
            </p>
          </div>
          <div className="text-xs font-mono-tabular text-indigo-400">
            {weakTopics.length} Priority Topics Identified · {strongTopics.length} Strong Chapters
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 Columns: Topic Accuracy Matrix */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-semibold text-slate-300">
              Priority Weak &amp; Moderate Chapters (Click to open practice questions)
            </div>

            <div className="space-y-2">
              {weakTopics.map((topic) => {
                const isSelected = selectedTopicDiag?.topicId === topic.topicId;
                return (
                  <button
                    key={topic.topicId}
                    type="button"
                    onClick={() => setActiveTopicId(topic.topicId)}
                    className={`w-full p-3.5 rounded-lg border text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 text-slate-100'
                        : 'bg-slate-950/80 border-slate-800/80 text-slate-300 hover:bg-slate-950'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-100 truncate">
                          {topic.topicName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-tabular">
                        {topic.subject} · {topic.questionsCorrect}/{topic.questionsAttempted}{' '}
                        correct · {topic.recommendedQuestions.length} prescribed Qs
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div
                          className={`text-sm font-mono-tabular font-bold ${
                            topic.accuracyPct < 60 ? 'text-rose-400' : 'text-amber-400'
                          }`}
                        >
                          {topic.accuracyPct}%
                        </div>
                        <div className="text-[10px] text-slate-500">{topic.status}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </button>
                );
              })}
            </div>

            {strongTopics.length > 0 && (
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="text-xs font-medium text-slate-400">
                  Mastered / Strong Chapters ({strongTopics.length})
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {strongTopics.map((st) => (
                    <div
                      key={st.topicId}
                      className="px-3 py-2 bg-slate-950/50 border border-slate-800/50 rounded-md flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-300 truncate">
                        {st.topicName}{' '}
                        <span className="text-slate-500">({st.subject})</span>
                      </span>
                      <span className="font-mono-tabular text-emerald-400 font-medium">
                        {st.accuracyPct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right 7 Columns: Interactive Prescribed Question Workbench */}
          <div className="lg:col-span-7 space-y-4">
            {selectedTopicDiag ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
                  <div>
                    <div className="text-xs text-indigo-400 font-medium">
                      Prescribed Remedial Drill · {selectedTopicDiag.subject}
                    </div>
                    <h3 className="text-base font-semibold text-slate-100 mt-0.5">
                      {selectedTopicDiag.topicName} (Current Accuracy:{' '}
                      <span className="font-mono-tabular text-rose-400">
                        {selectedTopicDiag.accuracyPct}%
                      </span>
                      )
                    </h3>
                  </div>
                  <BookOpen className="w-5 h-5 text-indigo-400 shrink-0" />
                </div>

                <div className="space-y-5">
                  {selectedTopicDiag.recommendedQuestions.map((q, qIdx) => {
                    const userChoice = selectedAnswers[q.id];
                    const isAnswered = userChoice !== undefined;
                    const isCorrect = userChoice === q.correctIndex;
                    const showSolution = revealedSolutions[q.id] || isAnswered;

                    return (
                      <div
                        key={q.id}
                        className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg space-y-3.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                          <span className="font-mono-tabular font-semibold text-indigo-300">
                            Question 0{qIdx + 1} · {q.difficulty} Level
                          </span>
                          <span className="font-mono-tabular">
                            Target Time: {q.expectedMinutes} mins
                          </span>
                        </div>

                        <p className="text-sm text-slate-100 leading-relaxed font-medium">
                          {q.questionText}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {q.options.map((opt, optIdx) => {
                            const isSelectedOpt = userChoice === optIdx;
                            const isRightOpt = q.correctIndex === optIdx;

                            let btnStyle =
                              'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700';
                            if (isAnswered) {
                              if (isRightOpt) {
                                btnStyle =
                                  'bg-emerald-950/50 border-emerald-500/70 text-emerald-200';
                              } else if (isSelectedOpt && !isRightOpt) {
                                btnStyle =
                                  'bg-rose-950/50 border-rose-500/70 text-rose-200';
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => handleSelectOption(q.id, optIdx)}
                                className={`px-3.5 py-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${btnStyle}`}
                              >
                                <span>
                                  <strong className="font-mono-tabular mr-1.5">
                                    {String.fromCharCode(65 + optIdx)}.
                                  </strong>
                                  {opt}
                                </span>
                                {isAnswered && isRightOpt && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="text-xs text-slate-400 flex items-center gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Hint: {q.hint}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleSolution(q.id)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                          >
                            {showSolution ? 'Hide Solution Steps' : 'View Step-by-Step Solution'}
                          </button>
                        </div>

                        {showSolution && (
                          <div className="p-3.5 bg-slate-950 border border-slate-800/90 rounded-lg space-y-1.5 text-xs">
                            <div className="font-semibold text-slate-200">
                              {isAnswered
                                ? isCorrect
                                  ? 'Correct Answer! Step-by-Step Derivation:'
                                  : 'Review Step-by-Step Solution:'
                                : 'Step-by-Step Faculty Solution:'}
                            </div>
                            <ol className="list-decimal list-inside space-y-1 text-slate-300">
                              {q.solutionSteps.map((step, sIdx) => (
                                <li key={sIdx}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
};
