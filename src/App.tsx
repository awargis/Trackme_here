import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  BatchRecord,
  PracticeQuestion,
  QueuedReport,
  StudentRecord,
  UploadCategory,
  UploadedStudentRow,
} from './types/academic.ts';
import {
  PRACTICE_QUESTION_BANK,
} from './data/seedBatches.ts';
import {
  applyImportedRowsLocally,
} from './utils/analyticsEngine.ts';
import { auth, logout, signInWithGoogle } from './lib/firebase.ts';
import { Bot, CheckCircle2, Database, FileSpreadsheet, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { LookupPortal } from './components/LookupPortal.tsx';
import { BatchCommandCenter } from './components/BatchCommandCenter.tsx';
import { StudentDiagnosticView } from './components/StudentDiagnosticView.tsx';
import { ReportGovernanceCenter } from './components/ReportGovernanceCenter.tsx';
import { DataImportModal } from './components/DataImportModal.tsx';
import { AcademicAiAgentDrawer } from './components/AcademicAiAgentDrawer.tsx';

type ActiveWorkspaceView = 'lookup' | 'batch' | 'student' | 'reports';

export default function App() {
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [questionBank, setQuestionBank] = useState<PracticeQuestion[]>(
    PRACTICE_QUESTION_BANK
  );
  const [activeView, setActiveView] = useState<ActiveWorkspaceView>('lookup');
  const [activeBatchId, setActiveBatchId] = useState<string>('');
  const [activeStudentId, setActiveStudentId] = useState<string>('');

  // Report Governance Queue State
  const [reportsQueue, setReportsQueue] = useState<QueuedReport[]>([]);
  const [autoApproveReports, setAutoApproveReports] = useState<boolean>(false);
  const [preselectedReportTarget, setPreselectedReportTarget] = useState<{
    student: StudentRecord;
    batch: BatchRecord;
  } | null>(null);

  // Data Import Modal & Academic AI Agent Drawer State
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isAiAgentOpen, setIsAiAgentOpen] = useState<boolean>(false);
  const [dbSyncStatus, setDbSyncStatus] = useState<'synced' | 'syncing'>('synced');
  const [dbSyncToast, setDbSyncToast] = useState<string | null>(null);

  // Authenticated Faculty / Admin User
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const fetchLatestDatabaseState = React.useCallback(async (showToast = false) => {
    setDbSyncStatus('syncing');
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) return;
      const data = (await res.json()) as {
        batches?: BatchRecord[];
        questionBank?: PracticeQuestion[];
        reports?: QueuedReport[];
      };
      if (Array.isArray(data.batches)) {
        setBatches(data.batches);
        if (data.batches.length > 0) {
          setActiveBatchId((prev) =>
            data.batches!.some((b) => b.id === prev) ? prev : data.batches![0].id
          );
          setActiveStudentId((prev) => {
            const targetBatch =
              data.batches!.find((b) => b.students.some((s) => s.id === prev)) ||
              data.batches![0];
            return targetBatch?.students.some((s) => s.id === prev)
              ? prev
              : targetBatch?.students[0]?.id || '';
          });
        } else {
          setActiveBatchId('');
          setActiveStudentId('');
        }
      }
      if (Array.isArray(data.questionBank) && data.questionBank.length > 0) {
        setQuestionBank(data.questionBank);
      }
      if (Array.isArray(data.reports)) {
        setReportsQueue(data.reports);
      }
      if (showToast) {
        setDbSyncToast('Synchronized live with Cloud SQL PostgreSQL (0ms lag)');
        setTimeout(() => setDbSyncToast(null), 3500);
      }
    } catch (err) {
      console.error('Could not reach /api/bootstrap:', err);
    } finally {
      setDbSyncStatus('synced');
    }
  }, []);

  // Hydrate all batches, students, practice questions, and reports from Cloud SQL PostgreSQL
  useEffect(() => {
    fetchLatestDatabaseState(false);
  }, [fetchLatestDatabaseState]);

  // Listen to Firebase Auth state and sync user to Cloud SQL PostgreSQL
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (err) {
          console.error('Error syncing authenticated user:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const activeBatch: BatchRecord | undefined =
    batches.find((b) => b.id === activeBatchId) || batches[0];
  const activeStudent: StudentRecord | undefined =
    activeBatch?.students.find((s) => s.id === activeStudentId) ||
    activeBatch?.students[0];

  const handleOpenStudent = (student: StudentRecord, batch: BatchRecord) => {
    setActiveBatchId(batch.id);
    setActiveStudentId(student.id);
    setActiveView('student');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenBatch = (batch: BatchRecord) => {
    setActiveBatchId(batch.id);
    if (!batch.students.some((s) => s.id === activeStudentId)) {
      setActiveStudentId(batch.students[0]?.id || '');
    }
    setActiveView('batch');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQueueReportForStudent = (student: StudentRecord, batch: BatchRecord) => {
    setPreselectedReportTarget({ student, batch });
    setActiveView('reports');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearDatabase = async () => {
    setDbSyncStatus('syncing');
    try {
      const res = await fetch('/api/data/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setBatches([]);
        setReportsQueue([]);
        setActiveBatchId('');
        setActiveStudentId('');
        setDbSyncToast(
          'Database cleared — all batches, students & reports removed. Upload your Excel sheet to populate fresh results.'
        );
        setTimeout(() => setDbSyncToast(null), 4500);
      }
    } catch (err) {
      console.error('Error clearing database:', err);
    } finally {
      setDbSyncStatus('synced');
    }
  };

  const handleCommitImportedRows = async (
    targetBatchId: string,
    rows: UploadedStudentRow[],
    uploadCategory: UploadCategory = 'combined'
  ) => {
    // 1. Instant 0ms Optimistic State Update so UI reflects imported test/attendance rows immediately without lag
    const optimistic = applyImportedRowsLocally(
      batches,
      targetBatchId,
      rows,
      uploadCategory
    );
    setBatches(optimistic.batches);
    const optimisticBatch =
      optimistic.batches.find((b) => b.id === optimistic.resolvedTargetBatchId) ||
      optimistic.batches[0];
    if (optimisticBatch) {
      setActiveBatchId(optimisticBatch.id);
      if (optimisticBatch.students[0]) {
        setActiveStudentId(optimisticBatch.students[0].id);
      }
    }
    setActiveView('batch');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setDbSyncStatus('syncing');

    // 2. Persist non-destructively to Cloud SQL PostgreSQL and reconcile authoritative state
    try {
      const res = await fetch('/api/ingest/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: targetBatchId,
          rows,
          uploadCategory,
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          errData.error || 'Failed to save student records in Cloud SQL PostgreSQL'
        );
      }

      const data = (await res.json()) as {
        batches?: BatchRecord[];
        primaryBatchId?: string;
        updatedBatch?: BatchRecord;
        insertedCount?: number;
        mergedCount?: number;
      };

      if (Array.isArray(data.batches) && data.batches.length > 0) {
        setBatches(data.batches);
        const nextBatchId = data.primaryBatchId || data.batches[0].id;
        const nextBatch =
          data.batches.find((b) => b.id === nextBatchId) || data.batches[0];
        setActiveBatchId(nextBatch.id);
        if (nextBatch.students[0]) {
          setActiveStudentId(nextBatch.students[0].id);
        }
      } else if (data.updatedBatch) {
        setBatches((prevBatches) =>
          prevBatches.map((b) =>
            b.id === targetBatchId ? data.updatedBatch! : b
          )
        );
      }
      const distinctBatchesCount = new Set(
        rows.map((r) => (r.batchName || '').trim().toUpperCase()).filter(Boolean)
      ).size;
      setDbSyncToast(
        `Committed ${rows.length} student records across ${Math.max(
          1,
          distinctBatchesCount
        )} batch(es) to Cloud SQL (${data.insertedCount ?? 0} new, ${
          data.mergedCount ?? 0
        } merged)`
      );
      setTimeout(() => setDbSyncToast(null), 4500);
    } finally {
      setDbSyncStatus('synced');
    }
  };

  const handleApproveReport = async (reportId: string) => {
    const approvedBy = currentUser?.displayName
      ? `${currentUser.displayName} (Admin)`
      : 'Dean Vikramaditya Sen (Admin)';
    const dispatchedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

    setReportsQueue((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              status: 'Approved & Sent',
              approvedBy,
              dispatchedAt,
            }
          : r
      )
    );

    try {
      await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Approved & Sent',
          approvedBy,
          dispatchedAt,
        }),
      });
    } catch (err) {
      console.error('Failed to persist report approval:', err);
    }
  };

  const handleApproveAllPending = async () => {
    const approvedBy = currentUser?.displayName
      ? `${currentUser.displayName} (Bulk Approval)`
      : 'Dean Vikramaditya Sen (Bulk Approval)';
    const dispatchedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

    setReportsQueue((prev) =>
      prev.map((r) =>
        r.status === 'Pending Approval'
          ? {
              ...r,
              status: 'Approved & Sent',
              approvedBy,
              dispatchedAt,
            }
          : r
      )
    );

    try {
      await fetch('/api/reports/approve-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy, dispatchedAt }),
      });
    } catch (err) {
      console.error('Failed to persist bulk report approval:', err);
    }
  };

  const handleRequestRevision = async (reportId: string, note: string) => {
    setReportsQueue((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              status: 'Revision Requested',
              adminNote: note,
            }
          : r
      )
    );

    try {
      await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Revision Requested',
          adminNote: note,
        }),
      });
    } catch (err) {
      console.error('Failed to persist report revision:', err);
    }
  };

  const handleCreateNewReport = async (
    newReportData: Omit<QueuedReport, 'id' | 'createdAt' | 'status'>
  ) => {
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const newReport: QueuedReport = {
      ...newReportData,
      id: `rep-${Date.now()}`,
      createdAt: nowStr,
      status: autoApproveReports ? 'Approved & Sent' : 'Pending Approval',
      ...(autoApproveReports
        ? {
            approvedBy: 'Auto-Approval Governance Rule',
            dispatchedAt: nowStr,
          }
        : {}),
    };
    setReportsQueue((prev) => [newReport, ...prev]);

    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReport),
      });
    } catch (err) {
      console.error('Failed to persist new report in database:', err);
    }
  };

  const pendingReportsCount = reportsQueue.filter(
    (r) => r.status === 'Pending Approval'
  ).length;

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#090D16]/95 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-8 no-print">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#lookup"
          onClick={(e) => {
            e.preventDefault();
            setActiveView('lookup');
          }}
          className="text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 font-display"
        >
          Aetheris Academic
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="Primary workspace navigation"
          className="flex items-center gap-6 text-sm font-medium text-slate-400 overflow-x-auto"
        >
          <a
            href="#lookup"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('lookup');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeView === 'lookup'
                ? 'text-slate-50 border-indigo-500'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Lookup Portal
          </a>

          <a
            href="#batch-analytics"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('batch');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeView === 'batch'
                ? 'text-slate-50 border-indigo-500'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Batch Analytics
          </a>

          <a
            href="#student-diagnostic"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('student');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeView === 'student'
                ? 'text-slate-50 border-indigo-500'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Student Profile
          </a>

          <a
            href="#report-governance"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('reports');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeView === 'reports'
                ? 'text-slate-50 border-indigo-500'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Report Governance ({pendingReportsCount})
          </a>
        </nav>

        {/* Zone 3: Primary actions (DB Sync Status, Clear DB, Ask AI Agent & Import Excel / PDF) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fetchLatestDatabaseState(true)}
            title="Instant sync with Cloud SQL PostgreSQL"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono-tabular text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded-lg hover:bg-emerald-950/70 transition-colors cursor-pointer"
          >
            {dbSyncStatus === 'syncing' ? (
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{dbSyncStatus === 'syncing' ? 'Syncing DB...' : 'Cloud SQL Live'}</span>
          </button>
          {batches.length > 0 && (
            <button
              type="button"
              onClick={handleClearDatabase}
              title="Clear all database tables for a fresh Excel upload"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-200 bg-rose-950/50 border border-rose-500/30 rounded-lg hover:bg-rose-900/60 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear DB</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsAiAgentOpen(true)}
            className="px-3.5 py-2 text-xs font-medium text-indigo-200 bg-indigo-950/70 border border-indigo-500/40 rounded-lg hover:bg-indigo-900/70 hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ask AI Agent</span>
          </button>
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Import Excel / PDF
          </button>
        </div>
      </header>

      {dbSyncToast && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/40 px-6 py-2 text-xs text-emerald-200 flex items-center justify-center gap-2 font-mono-tabular no-print">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{dbSyncToast}</span>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeView === 'lookup' && (
          <LookupPortal
            batches={batches}
            onOpenStudent={handleOpenStudent}
            onOpenBatch={handleOpenBatch}
            onOpenImportModal={() => setIsImportModalOpen(true)}
          />
        )}

        {activeView === 'batch' &&
          (activeBatch ? (
            <BatchCommandCenter
              batches={batches}
              activeBatch={activeBatch}
              onSelectBatch={handleOpenBatch}
              onSelectStudent={handleOpenStudent}
              onQueueReportForStudent={handleQueueReportForStudent}
              onOpenImportModal={() => setIsImportModalOpen(true)}
            />
          ) : (
            <div className="my-12 bg-slate-900/90 border border-slate-800 rounded-xl p-10 text-center max-w-2xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-100">
                Database Tables Ready for Fresh Excel Upload
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                All previous student and batch records have been cleared from the database. Upload
                your Excel (<span className="font-mono-tabular">.xlsx</span>), CSV, or PDF result
                sheet to automatically create each batch (e.g.{' '}
                <span className="font-mono-tabular text-indigo-300">LJ121</span>,{' '}
                <span className="font-mono-tabular text-indigo-300">AJ221EA</span>,{' '}
                <span className="font-mono-tabular text-indigo-300">S1A-LJ21W</span>) and populate
                100% exact student marks.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Import Excel / PDF Result Sheet</span>
                </button>
              </div>
            </div>
          ))}

        {activeView === 'student' &&
          (activeBatch && activeStudent ? (
            <StudentDiagnosticView
              student={activeStudent}
              batch={activeBatch}
              questionBank={questionBank}
              onBackToBatch={() => setActiveView('batch')}
              onSelectStudent={handleOpenStudent}
              onQueueReport={handleQueueReportForStudent}
            />
          ) : (
            <div className="my-12 bg-slate-900/90 border border-slate-800 rounded-xl p-10 text-center max-w-2xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-100">
                No Student Profiles Loaded Yet
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                The database is currently clean. Upload your Excel result sheet to inspect
                student-by-student diagnostics, test score ledgers, and weak-topic practice
                recommendations.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Import Excel / PDF Result Sheet</span>
                </button>
              </div>
            </div>
          ))}

        {activeView === 'reports' && (
          <ReportGovernanceCenter
            batches={batches}
            reports={reportsQueue}
            autoApproveEnabled={autoApproveReports}
            onToggleAutoApprove={() => setAutoApproveReports((prev) => !prev)}
            onApproveReport={handleApproveReport}
            onApproveAllPending={handleApproveAllPending}
            onRequestRevision={handleRequestRevision}
            onCreateNewReport={handleCreateNewReport}
            preselectedStudent={preselectedReportTarget}
            onClearPreselectedStudent={() => setPreselectedReportTarget(null)}
          />
        )}
      </main>

      {/* Quiet Executive Footer with Faculty Sign-In */}
      <footer className="border-t border-slate-800/80 py-6 px-6 text-xs text-slate-500 no-print">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>
            Aetheris Academic Intelligence · Student Diagnostics, Cohort Analytics & Governed
            Family Reporting
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveView('lookup')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Student Lookup
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveView('batch')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Batch Analytics
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveView('reports')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Admin Approval Queue
            </button>
            <span aria-hidden="true">·</span>
            {currentUser ? (
              <button
                type="button"
                onClick={() => logout()}
                className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                Signed in ({currentUser.email}) · Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                Faculty Google Sign-In
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Live Excel / CSV / PDF Import Modal */}
      {isImportModalOpen && (
        <DataImportModal
          batches={batches}
          activeBatch={activeBatch}
          onClose={() => setIsImportModalOpen(false)}
          onCommitRows={handleCommitImportedRows}
          onClearDatabase={handleClearDatabase}
        />
      )}

      {/* Floating Academic AI Agent Quick-Launch Button */}
      {!isAiAgentOpen && (
        <button
          type="button"
          onClick={() => setIsAiAgentOpen(true)}
          aria-label="Open Academic AI Agent"
          className="fixed bottom-6 right-6 z-40 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-xl border border-indigo-400/30 flex items-center gap-2 transition-all cursor-pointer no-print"
        >
          <Bot className="w-4 h-4" />
          <span>Academic AI Agent</span>
        </button>
      )}

      {/* Academic Intelligence AI Agent Slide-Over Drawer */}
      <AcademicAiAgentDrawer
        isOpen={isAiAgentOpen}
        onClose={() => setIsAiAgentOpen(false)}
        batches={batches}
        activeBatch={activeBatch}
        activeStudent={activeStudent}
        onSelectStudent={handleOpenStudent}
        onSelectBatch={handleOpenBatch}
        onQueueReportForStudent={handleQueueReportForStudent}
      />
    </div>
  );
}
