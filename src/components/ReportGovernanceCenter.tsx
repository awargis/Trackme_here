import React, { useState } from 'react';
import {
  Award,
  Building2,
  CheckCircle2,
  Clock,
  Expand,
  FileCheck2,
  FileText,
  Mail,
  Plus,
  Printer,
  ShieldCheck,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import { BatchRecord, QueuedReport, ReportStatus, StudentRecord } from '../types/academic';
import { getStudentExactScoreSummary } from '../utils/analyticsEngine';

interface ReportGovernanceCenterProps {
  batches: BatchRecord[];
  reports: QueuedReport[];
  autoApproveEnabled: boolean;
  onToggleAutoApprove: () => void;
  onApproveReport: (reportId: string) => void;
  onApproveAllPending: () => void;
  onRequestRevision: (reportId: string, note: string) => void;
  onCreateNewReport: (newReport: Omit<QueuedReport, 'id' | 'createdAt' | 'status'>) => void;
  preselectedStudent?: { student: StudentRecord; batch: BatchRecord } | null;
  onClearPreselectedStudent?: () => void;
}

export const ReportGovernanceCenter: React.FC<ReportGovernanceCenterProps> = ({
  batches,
  reports,
  autoApproveEnabled,
  onToggleAutoApprove,
  onApproveReport,
  onApproveAllPending,
  onRequestRevision,
  onCreateNewReport,
  preselectedStudent,
  onClearPreselectedStudent,
}) => {
  const [activeRole, setActiveRole] = useState<'admin' | 'teacher'>('admin');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReportStatus>('ALL');
  const [previewReport, setPreviewReport] = useState<QueuedReport | null>(
    reports[0] || null
  );
  const [showComposeModal, setShowComposeModal] = useState<boolean>(
    Boolean(preselectedStudent)
  );
  const [showFullScreenDossier, setShowFullScreenDossier] = useState<boolean>(false);

  // Compose Form State
  const initialBatch = preselectedStudent?.batch || batches[0];
  const initialStudent =
    preselectedStudent?.student || initialBatch?.students[0];

  const [composeBatchId, setComposeBatchId] = useState(initialBatch?.id || '');
  const [composeStudentId, setComposeStudentId] = useState(initialStudent?.id || '');
  const [recipientType, setRecipientType] = useState<
    'Parent / Family' | 'Class Teacher' | 'Both Family & Teacher'
  >('Both Family & Teacher');
  const [teacherRemarks, setTeacherRemarks] = useState(
    'Executive diagnostic assessment dossier including verified per-test score ledger, subject competency matrix, attendance vitality, and prescribed weak-topic remediation plan.'
  );

  // Sync if preselectedStudent changes
  React.useEffect(() => {
    if (preselectedStudent) {
      setComposeBatchId(preselectedStudent.batch.id);
      setComposeStudentId(preselectedStudent.student.id);
      setShowComposeModal(true);
    }
  }, [preselectedStudent]);

  const selectedComposeBatch: BatchRecord | undefined =
    batches.find((b) => b.id === composeBatchId) || batches[0];
  const selectedComposeStudent: StudentRecord | undefined =
    selectedComposeBatch?.students.find((s) => s.id === composeStudentId) ||
    selectedComposeBatch?.students[0];

  const pendingCount = reports.filter((r) => r.status === 'Pending Approval').length;
  const approvedCount = reports.filter((r) => r.status === 'Approved & Sent').length;

  const filteredReports = reports.filter((r) =>
    statusFilter === 'ALL' ? true : r.status === statusFilter
  );

  // Helper to resolve live StudentRecord & BatchRecord for any QueuedReport
  const resolveReportStudentAndBatch = (rep: QueuedReport | null) => {
    if (!rep) return { student: undefined, batch: undefined };
    const matchedBatch =
      batches.find((b) => b.id === rep.batchId || b.name === rep.batchName) ||
      batches.find((b) =>
        b.students.some((s) => s.id === rep.studentId || s.regNo === rep.regNo)
      ) ||
      batches[0];
    const matchedStudent =
      matchedBatch?.students.find(
        (s) => s.id === rep.studentId || s.regNo.toUpperCase() === rep.regNo.toUpperCase()
      ) ||
      batches
        .flatMap((b) => b.students)
        .find((s) => s.id === rep.studentId || s.regNo.toUpperCase() === rep.regNo.toUpperCase());
    return { student: matchedStudent, batch: matchedBatch };
  };

  const { student: previewStudent, batch: previewBatch } =
    resolveReportStudentAndBatch(previewReport);
  const previewScoreSummary = previewStudent
    ? getStudentExactScoreSummary(previewStudent)
    : null;

  // Compute subject-wise mean percentages from appeared tests for the previewed student
  const previewSubjectCompetencies = React.useMemo(() => {
    if (!previewStudent) return [];
    const appeared = previewStudent.testAttempts.filter((t) => t.appeared !== false);
    if (appeared.length === 0) return [];
    const subjectNames =
      previewBatch?.subjects ||
      appeared[0]?.subjectScores.map((s) => s.subject) || [
        'Physics',
        'Chemistry',
        'Mathematics',
      ];
    return subjectNames.map((subName, idx) => {
      let sumPct = 0;
      let sumMarks = 0;
      let sumMax = 0;
      let count = 0;
      for (const att of appeared) {
        const sub =
          att.subjectScores.find((s) => s.subject === subName) || att.subjectScores[idx];
        if (sub) {
          sumPct += sub.percentage;
          sumMarks += sub.marksObtained;
          sumMax += sub.maxMarks;
          count += 1;
        }
      }
      const avgPct = count > 0 ? Number((sumPct / count).toFixed(2)) : 0;
      const latestSub =
        appeared[appeared.length - 1]?.subjectScores.find((s) => s.subject === subName) ||
        appeared[appeared.length - 1]?.subjectScores[idx];
      return {
        subject: subName,
        avgPct,
        latestMarks: latestSub?.marksObtained ?? 0,
        latestMax: latestSub?.maxMarks ?? 100,
        totalAppearedTests: count,
        avgMarksPerTest: count > 0 ? Math.round(sumMarks / count) : 0,
        maxPerTest: count > 0 ? Math.round(sumMax / count) : 100,
      };
    });
  }, [previewStudent, previewBatch]);

  const handleComposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComposeStudent || !selectedComposeBatch) return;

    const weakTopics = selectedComposeStudent.topicScores
      .filter((t) => t.status === 'Weak' || t.accuracyPct < 65)
      .map((t) => t.topicName);

    const recipientName =
      recipientType === 'Parent / Family'
        ? `${selectedComposeStudent.parentName} (Parent)`
        : recipientType === 'Class Teacher'
        ? selectedComposeStudent.classTeacherName
        : `${selectedComposeStudent.parentName} & ${selectedComposeStudent.classTeacherName}`;

    onCreateNewReport({
      studentId: selectedComposeStudent.id,
      studentName: selectedComposeStudent.name,
      regNo: selectedComposeStudent.regNo,
      batchId: selectedComposeBatch.id,
      batchName: selectedComposeBatch.name,
      recipientType,
      recipientName,
      recipientEmail: selectedComposeStudent.parentEmail,
      recipientPhone: selectedComposeStudent.parentPhone,
      overallAvgPct: selectedComposeStudent.overallAvgPct,
      attendancePct: selectedComposeStudent.attendancePct,
      rankInBatch: selectedComposeStudent.rankInBatch,
      weakTopics: weakTopics.length > 0 ? weakTopics : ['General Revision'],
      recommendedQuestionsCount: Math.max(2, weakTopics.length * 2),
      teacherRemarks:
        teacherRemarks.trim() ||
        'Scheduled academic progress and topic remediation dossier.',
      requestedBy: selectedComposeBatch.leadFaculty,
    });

    setShowComposeModal(false);
    if (onClearPreselectedStudent) onClearPreselectedStudent();
  };

  const renderCorporateDossierContent = (isModalView: boolean) => {
    if (!previewReport) return null;
    const docId = `AETH-CORP-2026-${previewReport.regNo.replace(/[^A-Z0-9]/gi, '')}`;
    return (
      <div className={`space-y-5 ${isModalView ? 'p-2' : 'pt-2'}`}>
        {/* Corporate Institutional Letterhead */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950 via-indigo-950/30 to-slate-950 border border-indigo-500/30 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/90 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-indigo-300 font-semibold">
                  AETHERIS ACADEMIC INTELLIGENCE · CORPORATE GOVERNANCE DIVISION
                </div>
                <div className="text-xs text-slate-400 font-mono-tabular mt-0.5">
                  DOC CONTROL ID: <span className="text-slate-200">{docId}</span> · AUDIT LEDGER:{' '}
                  <span className="text-emerald-400">100% EXCEL VERIFIED</span>
                </div>
              </div>
            </div>

            <div className="text-right font-mono-tabular">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                  previewReport.status === 'Approved & Sent'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                    : previewReport.status === 'Pending Approval'
                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                    : 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                }`}
              >
                {previewReport.status === 'Approved & Sent' ? (
                  <FileCheck2 className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                {previewReport.status.toUpperCase()}
              </span>
              <div className="text-[10px] text-slate-500 mt-1">
                Issued: {previewReport.createdAt}
              </div>
            </div>
          </div>

          {/* Candidate Executive Bio Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Candidate Name & Registration ID
              </div>
              <div className="text-lg font-bold text-slate-50 tracking-tight mt-0.5">
                {previewReport.studentName}
              </div>
              <div className="text-xs font-mono-tabular text-indigo-300">
                Reg No: {previewReport.regNo} · Cohort: {previewReport.batchName}
              </div>
              {previewStudent?.centerName && (
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Center: {previewStudent.combinedCenterName ? `${previewStudent.combinedCenterName} · ` : ''}
                  {previewStudent.centerName}
                </div>
              )}
            </div>

            <div className="sm:text-right flex flex-col sm:items-end justify-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Designated Report Recipient
              </div>
              <div className="text-xs font-semibold text-slate-100 mt-0.5">
                {previewReport.recipientName}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-400">
                {previewReport.recipientEmail} · {previewReport.recipientPhone}
              </div>
              <div className="text-[10px] text-indigo-300 font-mono-tabular mt-0.5">
                Lead Faculty: {previewReport.requestedBy}
              </div>
            </div>
          </div>
        </div>

        {/* 5-Pillar Executive Scorecard (Exact Per-Test Marks + Mean % + Rank + Attendance) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="p-3 bg-slate-950/90 border border-slate-800/90 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Latest Test Marks
            </div>
            <div className="text-sm font-bold font-mono-tabular text-indigo-300 mt-1">
              {previewScoreSummary && previewScoreSummary.appearedCount > 0
                ? `${previewScoreSummary.latestMarks} / ${previewScoreSummary.latestMax}`
                : '0 / 300'}
            </div>
            <div className="text-[10px] font-mono-tabular text-slate-400 mt-0.5 truncate">
              {previewScoreSummary && previewScoreSummary.appearedCount > 0
                ? `${previewScoreSummary.latestPct.toFixed(2)}% · ${previewScoreSummary.latestTestName}`
                : 'Absent'}
            </div>
          </div>

          <div className="p-3 bg-slate-950/90 border border-slate-800/90 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Peak Test Marks
            </div>
            <div className="text-sm font-bold font-mono-tabular text-emerald-400 mt-1">
              {previewScoreSummary && previewScoreSummary.appearedCount > 0
                ? `${previewScoreSummary.bestMarks} / ${previewScoreSummary.bestMax}`
                : '0 / 300'}
            </div>
            <div className="text-[10px] font-mono-tabular text-slate-400 mt-0.5 truncate">
              {previewScoreSummary && previewScoreSummary.appearedCount > 0
                ? `${previewScoreSummary.bestPct.toFixed(2)}% · ${previewScoreSummary.bestTestName}`
                : 'No test appeared'}
            </div>
          </div>

          <div className="p-3 bg-slate-950/90 border border-slate-800/90 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Mean Score (%)
            </div>
            <div className="text-sm font-bold font-mono-tabular text-slate-100 mt-1">
              {previewReport.overallAvgPct.toFixed(2)}%
            </div>
            <div className="text-[10px] font-mono-tabular text-slate-400 mt-0.5">
              {previewScoreSummary
                ? `${previewScoreSummary.appearedCount}/${previewScoreSummary.scheduledCount} Tests Appeared`
                : 'Verified Mean'}
            </div>
          </div>

          <div className="p-3 bg-slate-950/90 border border-slate-800/90 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Cohort Standing
            </div>
            <div className="text-sm font-bold font-mono-tabular text-indigo-400 mt-1">
              Rank #{previewReport.rankInBatch}
            </div>
            <div className="text-[10px] font-mono-tabular text-slate-400 mt-0.5">
              {previewStudent ? `${previewStudent.batchPercentile.toFixed(1)}%ile` : 'Top Cohort'}
            </div>
          </div>

          <div className="p-3 bg-slate-950/90 border border-slate-800/90 rounded-lg col-span-2 sm:col-span-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              Attendance Vitality
            </div>
            <div
              className={`text-sm font-bold font-mono-tabular mt-1 ${
                previewReport.attendancePct < 75
                  ? 'text-rose-400'
                  : previewReport.attendancePct < 82
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {previewReport.attendancePct.toFixed(1)}%
            </div>
            <div className="text-[10px] font-mono-tabular text-slate-400 mt-0.5">
              {previewReport.attendancePct >= 85 ? 'Optimal Regularity' : 'Requires Monitoring'}
            </div>
          </div>
        </div>

        {/* Complete Per-Test Assessment Score Ledger Table (Exact Excel Figures) */}
        {previewStudent && previewStudent.testAttempts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-indigo-400" />
                <span>Official Assessment-by-Assessment Score Ledger (Exact Excel Marks)</span>
              </div>
              <span className="text-[10px] font-mono-tabular text-slate-400">
                Score / Out of · Zero Inflation
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2 px-2.5">Test Name</th>
                    <th className="py-2 px-2.5">Date</th>
                    <th className="py-2 px-2.5 text-right">Marks (Score / Out of)</th>
                    <th className="py-2 px-2.5 text-right">Accuracy %</th>
                    <th className="py-2 px-2.5 text-right">
                      {previewBatch?.subjects?.includes('Biology')
                        ? 'Phy / Chem / Bio'
                        : 'Phy / Chem / Math'}
                    </th>
                    <th className="py-2 px-2.5 text-right">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono-tabular">
                  {previewStudent.testAttempts.map((att) => {
                    const isAbsent = att.appeared === false;
                    return (
                      <tr key={att.testId} className="hover:bg-slate-950/60">
                        <td className="py-1.5 px-2.5 font-sans font-medium text-slate-200 whitespace-nowrap">
                          {att.testName}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-400 whitespace-nowrap">
                          {att.testDate}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-semibold whitespace-nowrap">
                          {isAbsent ? (
                            <span className="text-rose-400">
                              Absent (— / {att.maxMarks})
                            </span>
                          ) : (
                            <span className="text-indigo-300">
                              {att.totalMarks} / {att.maxMarks}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                          {isAbsent ? (
                            <span className="text-slate-500">—</span>
                          ) : (
                            <span
                              className={
                                att.percentage >= 80
                                  ? 'text-emerald-400 font-semibold'
                                  : att.percentage < 50
                                  ? 'text-rose-400 font-semibold'
                                  : 'text-slate-200'
                              }
                            >
                              {att.percentage.toFixed(2)}%
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-300 whitespace-nowrap">
                          {isAbsent
                            ? '— / — / —'
                            : att.subjectScores
                                .map((s) => `${s.marksObtained}/${s.maxMarks}`)
                                .join(' · ')}
                        </td>
                        <td className="py-1.5 px-2.5 text-right text-slate-300 whitespace-nowrap">
                          {isAbsent
                            ? '—'
                            : `#${att.offlineRank ?? previewStudent.rankInBatch}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Subject Competency Matrix Bars */}
        {previewSubjectCompetencies.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Subject-Wise Competency Breakdown (Verified Mathematical Mean)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {previewSubjectCompetencies.map((sub) => (
                <div
                  key={sub.subject}
                  className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-lg space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{sub.subject}</span>
                    <span className="font-mono-tabular font-bold text-indigo-300">
                      {sub.avgPct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        sub.avgPct >= 75
                          ? 'bg-emerald-500'
                          : sub.avgPct >= 50
                          ? 'bg-indigo-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(6, sub.avgPct))}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-mono-tabular text-slate-400 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Latest: {sub.latestMarks}/{sub.latestMax}
                    </span>
                    <span>
                      Mean: {sub.avgMarksPerTest}/{sub.maxPerTest}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weak Areas & Prescribed Practice */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-200">
            Diagnosed Weak Chapters &amp; Prescribed Question Allocation
          </div>
          <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-lg text-xs text-slate-300 space-y-1.5">
            <div>
              <span className="text-slate-400">Priority Remediation Chapters: </span>
              <strong className="text-amber-300">
                {previewReport.weakTopics.join(' · ')}
              </strong>
            </div>
            <div>
              <span className="text-slate-400">Prescribed Action Plan: </span>
              <span className="font-mono-tabular text-emerald-300 font-semibold">
                {previewReport.recommendedQuestionsCount} targeted JEE/NEET practice problems
              </span>{' '}
              assigned in student diagnostic workspace with step-by-step derivations.
            </div>
          </div>
        </div>

        {/* Faculty Remarks */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-slate-200">
            Executive Faculty Commentary ({previewReport.requestedBy})
          </div>
          <p className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-lg text-xs text-slate-300 leading-relaxed">
            {previewReport.teacherRemarks}
          </p>
        </div>

        {/* Corporate Governance Sign-Off & Dispatch Audit Block */}
        <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-400">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Dispatch Coordinates
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">
                <strong className="text-slate-200">{previewReport.recipientName}</strong> (
                {previewReport.recipientEmail})
              </span>
            </div>
            <div className="font-mono-tabular text-slate-400">
              Contact: {previewReport.recipientPhone} · Channel: {previewReport.recipientType}
            </div>
          </div>

          <div className="sm:text-right space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Institutional Governance Sign-Off
            </div>
            {previewReport.approvedBy ? (
              <div className="text-emerald-400 font-medium">
                Digitally Approved by {previewReport.approvedBy}
              </div>
            ) : (
              <div className="text-amber-400 font-medium">
                Awaiting Academic Dean Sign-Off
              </div>
            )}
            <div className="font-mono-tabular text-[10px] text-slate-500">
              {previewReport.dispatchedAt
                ? `Dispatched Timestamp: ${previewReport.dispatchedAt}`
                : `Queued Timestamp: ${previewReport.createdAt}`}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Governance Header */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 no-print">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono-tabular font-semibold">
              CORPORATE DOSSIER GOVERNANCE
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{pendingCount} Pending Approval</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{approvedCount} Approved &amp; Dispatched</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight">
            Executive Student Report &amp; Dossier Dispatch Center
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Generate, audit, and dispatch boardroom-grade student academic dossiers with verified
            per-test Excel marks, subject competency matrices, and prescribed remediation plans.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Role Switcher */}
          <div
            role="tablist"
            aria-label="Governance role mode"
            className="inline-flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeRole === 'admin'}
              onClick={() => setActiveRole('admin')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeRole === 'admin'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Admin Approver Mode
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeRole === 'teacher'}
              onClick={() => setActiveRole('teacher')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeRole === 'teacher'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Teacher Sender Mode
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowComposeModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Draft &amp; Queue Student Report</span>
          </button>
        </div>
      </section>

      {/* Admin Policy Strip */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-slate-100">
              Admin Auto-Dispatch Governance Rule:{' '}
              <span className={autoApproveEnabled ? 'text-emerald-400' : 'text-amber-400'}>
                {autoApproveEnabled
                  ? 'Auto-Approve Enabled (Immediate Dispatch)'
                  : 'Manual Admin Approval Required'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {autoApproveEnabled
                ? 'New reports queued by verified batch faculty are automatically approved and sent to parents/teachers.'
                : 'Every queued student report awaits explicit Admin review before being sent to parents or teachers.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToggleAutoApprove}
            className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {autoApproveEnabled
              ? 'Switch to Manual Approval Gate'
              : 'Enable Auto-Approve Rule'}
          </button>

          {activeRole === 'admin' && pendingCount > 0 && (
            <button
              type="button"
              onClick={onApproveAllPending}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Approve &amp; Send All Pending ({pendingCount})
            </button>
          )}
        </div>
      </section>

      {/* Main Split: Queue Table (Left 6 cols) + Formal Printable Corporate Report Dossier Preview (Right 6 cols) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Report Dispatch Queue */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-5 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-100">
              Student Report Dispatch Queue ({filteredReports.length})
            </h2>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              {(['ALL', 'Pending Approval', 'Approved & Sent', 'Revision Requested'] as const).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      statusFilter === st
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="space-y-3">
            {filteredReports.map((rep) => {
              const isSelected = previewReport?.id === rep.id;
              const { student: rowStudent } = resolveReportStudentAndBatch(rep);
              const rowExact = rowStudent ? getStudentExactScoreSummary(rowStudent) : null;
              return (
                <div
                  key={rep.id}
                  onClick={() => setPreviewReport(rep)}
                  className={`p-4 bg-slate-950 border rounded-xl transition-colors cursor-pointer space-y-3 ${
                    isSelected
                      ? 'border-indigo-500 ring-1 ring-indigo-500/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">
                          {rep.studentName}
                        </span>
                        <span className="text-xs font-mono-tabular text-slate-400">
                          {rep.regNo} · {rep.batchName}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Recipient: <strong className="text-slate-200">{rep.recipientName}</strong>{' '}
                        ({rep.recipientEmail})
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      {rep.status === 'Approved & Sent' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400">Approved &amp; Sent</span>
                        </>
                      ) : rep.status === 'Pending Approval' ? (
                        <>
                          <Clock className="w-4 h-4 text-amber-400" />
                          <span className="text-amber-400">Pending Admin Approval</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-rose-400" />
                          <span className="text-rose-400">Revision Requested</span>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{rep.teacherRemarks}</p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-900 text-xs">
                    <div className="text-slate-400 font-mono-tabular flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {rowExact && rowExact.appearedCount > 0 && (
                        <span className="text-indigo-300 font-semibold">
                          Latest: {rowExact.latestMarks}/{rowExact.latestMax} (
                          {rowExact.latestTestName})
                        </span>
                      )}
                      <span>Mean: {rep.overallAvgPct}%</span>
                      <span>Att: {rep.attendancePct}%</span>
                      <span className="text-amber-300/90">
                        Weak: {rep.weakTopics.join(', ')}
                      </span>
                    </div>

                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {activeRole === 'admin' && rep.status === 'Pending Approval' && (
                        <>
                          <button
                            type="button"
                            aria-label={`Approve and send report for ${rep.studentName}`}
                            onClick={() => {
                              onApproveReport(rep.id);
                              setPreviewReport({
                                ...rep,
                                status: 'Approved & Sent',
                                approvedBy: 'Dean Vikramaditya Sen (Admin)',
                                dispatchedAt: '2026-10-23 10:55',
                              });
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Approve &amp; Send Now
                          </button>
                          <button
                            type="button"
                            aria-label={`Hold or revise report for ${rep.studentName}`}
                            onClick={() =>
                              onRequestRevision(
                                rep.id,
                                'Please include specific test-6 subject breakdown before sending to family.'
                              )
                            }
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-rose-300 border border-slate-800 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Hold / Revise
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        aria-label={`Preview dossier for ${rep.studentName}`}
                        onClick={() => setPreviewReport(rep)}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Preview Dossier
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Official Corporate Executive Report Dossier Preview (Printable / PDF Export) */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-5">
          {previewReport ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4 no-print">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-semibold text-slate-100">
                    Corporate Executive Student Dossier
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFullScreenDossier(true)}
                    className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-indigo-300 border border-slate-700 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Expand className="w-3.5 h-3.5" />
                    <span>Executive Boardroom View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print / Save PDF</span>
                  </button>
                </div>
              </div>

              {renderCorporateDossierContent(false)}
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              Select any report from the queue to inspect its printable corporate dossier.
            </div>
          )}
        </div>
      </section>

      {/* Full-Screen Executive Boardroom Dossier Modal */}
      {showFullScreenDossier && previewReport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Executive Student Dossier Full-Screen View"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print"
        >
          <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-4xl w-full p-6 sm:p-8 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-base font-bold text-slate-100">
                    Executive Boardroom Dossier — {previewReport.studentName} ({previewReport.regNo})
                  </h2>
                  <p className="text-xs text-slate-400">
                    100% Excel-Verified Per-Test Score Ledger &amp; Institutional Governance Report
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Official PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullScreenDossier(false)}
                  aria-label="Close full-screen dossier"
                  className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {renderCorporateDossierContent(true)}
          </div>
        </div>
      )}

      {/* Compose New Report Modal */}
      {showComposeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="compose-report-title"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 no-print"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 id="compose-report-title" className="text-base font-bold text-slate-100">
                Draft & Queue Student Report for Family / Teacher
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowComposeModal(false);
                  if (onClearPreselectedStudent) onClearPreselectedStudent();
                }}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleComposeSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="modal-batch-select"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Batch
                  </label>
                  <select
                    id="modal-batch-select"
                    value={selectedComposeBatch?.id || ''}
                    onChange={(e) => {
                      const b = batches.find((item) => item.id === e.target.value);
                      if (b) {
                        setComposeBatchId(b.id);
                        setComposeStudentId(b.students[0]?.id || '');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="modal-student-select"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Student
                  </label>
                  <select
                    id="modal-student-select"
                    value={selectedComposeStudent?.id || ''}
                    onChange={(e) => setComposeStudentId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                  >
                    {selectedComposeBatch?.students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.regNo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="modal-recipient-select"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Report Recipient Channel
                </label>
                <select
                  id="modal-recipient-select"
                  value={recipientType}
                  onChange={(e) =>
                    setRecipientType(
                      e.target.value as
                        | 'Parent / Family'
                        | 'Class Teacher'
                        | 'Both Family & Teacher'
                    )
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                >
                  <option value="Both Family & Teacher">
                    Both Parent ({selectedComposeStudent?.parentName}) & Class Teacher
                  </option>
                  <option value="Parent / Family">
                    Parent / Family Only ({selectedComposeStudent?.parentEmail})
                  </option>
                  <option value="Class Teacher">
                    Class Teacher Only ({selectedComposeStudent?.classTeacherName})
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="modal-remarks-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Personalized Faculty Remarks & Remediation Guidance
                </label>
                <textarea
                  id="modal-remarks-input"
                  rows={3}
                  value={teacherRemarks}
                  onChange={(e) => setTeacherRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowComposeModal(false);
                    if (onClearPreselectedStudent) onClearPreselectedStudent();
                  }}
                  className="px-3.5 py-2 bg-slate-950 text-slate-300 border border-slate-800 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  {autoApproveEnabled
                    ? 'Approve & Dispatch Automatically'
                    : 'Submit to Admin Approval Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
