import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  BarChart3,
  FileSpreadsheet,
  Filter,
  Gauge,
  MapPin,
  Search,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BatchRecord, LongitudinalTestPoint, StudentRecord } from '../types/academic';
import {
  computeBatchAnalytics,
  enrichStudentSummaryFromAttempts,
  getStudentExactScoreSummary,
} from '../utils/analyticsEngine';

interface BatchCommandCenterProps {
  batches: BatchRecord[];
  activeBatch: BatchRecord;
  onSelectBatch: (batch: BatchRecord) => void;
  onSelectStudent: (student: StudentRecord, batch: BatchRecord) => void;
  onQueueReportForStudent: (student: StudentRecord, batch: BatchRecord) => void;
  onOpenImportModal: () => void;
}

type RosterSegment = 'top10' | 'bottom10' | 'intervention' | 'all' | 'excel_ledger';
type GrowthChartView = 'cohort' | 'subjects' | 'participation';

export const BatchCommandCenter: React.FC<BatchCommandCenterProps> = ({
  batches,
  activeBatch,
  onSelectBatch,
  onSelectStudent,
  onQueueReportForStudent,
  onOpenImportModal,
}) => {
  const [activeSegment, setActiveSegment] = useState<RosterSegment>('top10');
  const [rosterSearch, setRosterSearch] = useState('');
  const [selectedRosterTestId, setSelectedRosterTestId] = useState<string>('__all__');
  const [chartView, setChartView] = useState<GrowthChartView>('cohort');
  const [hideZeroAppearedTests, setHideZeroAppearedTests] = useState<boolean>(false);
  const [focusedTestId, setFocusedTestId] = useState<string | null>(null);

  const summary = computeBatchAnalytics(activeBatch);
  const sampleStudent = summary.topTenStudents[0] || activeBatch.students[0];
  const topLeaderScoreMeta = sampleStudent
    ? getStudentExactScoreSummary(sampleStudent)
    : null;
  const thirdSubjectLabel = activeBatch.subjects[2] || 'Mathematics';

  const getSegmentStudents = (): StudentRecord[] => {
    let base: StudentRecord[] = [];
    if (activeSegment === 'top10') {
      base = summary.topTenStudents;
    } else if (activeSegment === 'bottom10') {
      base = summary.bottomTenStudents;
    } else if (activeSegment === 'intervention') {
      base = summary.interventionStudents;
    } else {
      base = [...activeBatch.students]
        .map(enrichStudentSummaryFromAttempts)
        .sort((a, b) => a.rankInBatch - b.rankInBatch);
    }

    if (!rosterSearch.trim()) return base;
    const q = rosterSearch.trim().toLowerCase();
    return base.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.regNo.toLowerCase().includes(q) ||
        s.interventionStatus.toLowerCase().includes(q)
    );
  };

  const displayedStudents = getSegmentStudents();

  const allPoints = summary.longitudinalSeries;
  const appearedOnlyPoints = allPoints.filter(
    (pt) => (pt.appearedCount ?? 1) > 0 && pt.batchAvgPct > 0
  );
  const chartPoints: LongitudinalTestPoint[] =
    hideZeroAppearedTests && appearedOnlyPoints.length > 0 ? appearedOnlyPoints : allPoints;

  const defaultFocusedPoint =
    appearedOnlyPoints[appearedOnlyPoints.length - 1] || allPoints[0];
  const activeFocusedPoint =
    allPoints.find((pt) => pt.testId === focusedTestId) || defaultFocusedPoint;

  const getDifficultyBadgeStyle = (
    label?: LongitudinalTestPoint['difficultyLabel']
  ): { bg: string; text: string; bar: string; desc: string } => {
    if (label === 'High Difficulty') {
      return {
        bg: 'bg-rose-500/15 border-rose-500/40',
        text: 'text-rose-300',
        bar: 'bg-gradient-to-r from-amber-500 to-rose-500',
        desc: 'Tough Paper · High Discrimination',
      };
    }
    if (label === 'Moderate') {
      return {
        bg: 'bg-indigo-500/15 border-indigo-500/40',
        text: 'text-indigo-300',
        bar: 'bg-gradient-to-r from-indigo-500 to-cyan-400',
        desc: 'Balanced Exam Standard',
      };
    }
    if (label === 'Accessible') {
      return {
        bg: 'bg-emerald-500/15 border-emerald-500/40',
        text: 'text-emerald-300',
        bar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
        desc: 'High Scoring · Concept Reinforcement',
      };
    }
    return {
      bg: 'bg-slate-800/80 border-slate-700',
      text: 'text-slate-400',
      bar: 'bg-slate-600',
      desc: 'Scheduled · Awaiting OMR Sync',
    };
  };

  const handleSelectOutlierStudent = (studentId?: string) => {
    if (!studentId) return;
    const found = activeBatch.students.find((s) => s.id === studentId);
    if (found) {
      onSelectStudent(enrichStudentSummaryFromAttempts(found), activeBatch);
    }
  };

  const renderCustomTooltip = ({
    active,
    payload,
  }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const pt = payload[0].payload as LongitudinalTestPoint;
    const hasAppeared = (pt.appearedCount ?? 1) > 0 && pt.batchAvgPct > 0;
    const diffStyle = getDifficultyBadgeStyle(pt.difficultyLabel);

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={pt.testId}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          data-testid="framer-motion-chart-tooltip"
          className="bg-slate-950/95 backdrop-blur-md border border-indigo-500/40 rounded-xl p-4 shadow-2xl text-xs space-y-3 min-w-[300px] max-w-[340px]"
        >
          {/* Header & Difficulty Badge */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-800/90 pb-2.5">
            <div>
              <div className="font-semibold text-slate-100 text-[13px] leading-tight">
                {pt.testName}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                {pt.testDate} · Max {pt.maxMarks ?? 300} Marks
              </div>
            </div>
            <div
              className={`px-2 py-0.5 rounded border text-[10px] font-mono-tabular font-semibold uppercase tracking-wider shrink-0 ${diffStyle.bg} ${diffStyle.text}`}
            >
              {pt.difficultyLabel || 'Moderate'}
            </div>
          </div>

          {!hasAppeared ? (
            <div className="py-2 text-rose-400 font-mono-tabular font-medium">
              0 / {pt.totalStudents ?? activeBatch.students.length} Students Appeared (Scheduled)
            </div>
          ) : (
            <>
              {/* Animated Test Difficulty Meter & Spread */}
              <div className="bg-slate-900/90 border border-slate-800/90 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                    Difficulty Index:
                  </span>
                  <span className={`font-mono-tabular font-semibold ${diffStyle.text}`}>
                    {pt.difficultyIndex ?? 45}/100 · ±{pt.scoreSpreadStdDev ?? 0}% Spread
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-sm overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${ Math.min(100, pt.difficultyIndex ?? 45)}%` }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className={`h-full ${diffStyle.bar}`}
                  />
                </div>
                {pt.hardestSubject && (
                  <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400 pt-0.5">
                    <span>Toughest Section:</span>
                    <span className="text-amber-300 font-semibold">
                      {pt.hardestSubject.name} ({pt.hardestSubject.avgPct}% avg)
                    </span>
                  </div>
                )}
              </div>

              {/* Cohort Decile Metrics */}
              <div className="space-y-1 font-mono-tabular">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-indigo-300">Batch Appeared Mean:</span>
                  <span className="font-bold text-slate-50">
                    {pt.batchAvgPct}% ({pt.avgMarksObtained ?? 0}/{pt.maxMarks ?? 300})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-emerald-400">Top 10 Decile Avg:</span>
                  <span className="font-semibold text-emerald-300">{pt.topTenAvgPct}%</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-rose-400">Bottom 10 Decile Avg:</span>
                  <span className="font-semibold text-rose-300">{pt.bottomTenAvgPct}%</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>Phy / Chem / {thirdSubjectLabel.slice(0, 4)}:</span>
                  <span className="text-slate-200">
                    {pt.physicsAvgPct ?? 0}% / {pt.chemistryAvgPct ?? 0}% /{' '}
                    {pt.mathOrBioAvgPct ?? 0}%
                  </span>
                </div>
              </div>

              {/* Specific Student Outliers (Staggered Framer Motion) */}
              <div className="border-t border-slate-800/90 pt-2.5 space-y-1.5">
                <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Student Outliers on Assessment</span>
                  <span>
                    {pt.appearedCount ?? activeBatch.students.length}/
                    {pt.totalStudents ?? activeBatch.students.length} Present
                  </span>
                </div>

                {pt.topOutlier && (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 }}
                    className="flex items-center justify-between gap-2 bg-emerald-950/35 border border-emerald-500/25 rounded px-2 py-1"
                  >
                    <div className="truncate">
                      <span className="text-[10px] font-mono-tabular text-emerald-400 uppercase mr-1.5">
                        Top:
                      </span>
                      <span className="font-semibold text-slate-100">{pt.topOutlier.name}</span>
                      <span className="text-[10px] font-mono-tabular text-slate-400 ml-1">
                        ({pt.topOutlier.regNo})
                      </span>
                    </div>
                    <span className="font-mono-tabular font-bold text-emerald-300 shrink-0">
                      {pt.topOutlier.pct}% ({pt.topOutlier.marks}/{pt.topOutlier.maxMarks})
                    </span>
                  </motion.div>
                )}

                {pt.bottomOutlier && (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center justify-between gap-2 bg-rose-950/35 border border-rose-500/25 rounded px-2 py-1"
                  >
                    <div className="truncate">
                      <span className="text-[10px] font-mono-tabular text-rose-400 uppercase mr-1.5">
                        Low:
                      </span>
                      <span className="font-semibold text-slate-100">{pt.bottomOutlier.name}</span>
                      <span className="text-[10px] font-mono-tabular text-slate-400 ml-1">
                        ({pt.bottomOutlier.regNo})
                      </span>
                    </div>
                    <span className="font-mono-tabular font-bold text-rose-300 shrink-0">
                      {pt.bottomOutlier.pct}% ({pt.bottomOutlier.marks}/{pt.bottomOutlier.maxMarks})
                    </span>
                  </motion.div>
                )}

                {pt.momentumOutlier && pt.momentumOutlier.deltaFromPrevPct !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    className="flex items-center justify-between gap-2 bg-indigo-950/40 border border-indigo-500/25 rounded px-2 py-1"
                  >
                    <div className="truncate">
                      <span className="text-[10px] font-mono-tabular text-indigo-300 uppercase mr-1.5">
                        Shift:
                      </span>
                      <span className="font-semibold text-slate-100">
                        {pt.momentumOutlier.name}
                      </span>
                    </div>
                    <span
                      className={`font-mono-tabular font-bold shrink-0 ${
                        pt.momentumOutlier.deltaFromPrevPct >= 0
                          ? 'text-emerald-300'
                          : 'text-amber-300'
                      }`}
                    >
                      {pt.momentumOutlier.deltaFromPrevPct >= 0 ? '+' : ''}
                      {pt.momentumOutlier.deltaFromPrevPct}% vs prev ({pt.momentumOutlier.pct}%)
                    </span>
                  </motion.div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="space-y-8 pb-16 transition-all duration-300">
      {/* Top Batch Header & Batch Switcher Bar */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-indigo-950/30 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>Teacher Batch Command Center</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular text-indigo-300 font-semibold">
              {activeBatch.code}
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeBatch.stream}</span>
            <span aria-hidden="true">·</span>
            <span>AY {activeBatch.academicYear}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight font-display">
            {activeBatch.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            {(sampleStudent?.regionName ||
              sampleStudent?.combinedCenterName ||
              sampleStudent?.centerName) && (
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>
                  {sampleStudent.regionName ? `Region: ${sampleStudent.regionName}` : ''}
                  {sampleStudent.combinedCenterName
                    ? ` · Combined Center: ${sampleStudent.combinedCenterName}`
                    : ''}
                  {sampleStudent.centerName ? ` · Center: ${sampleStudent.centerName}` : ''}
                </span>
              </span>
            )}
            <span>
              Lead Faculty:{' '}
              <strong className="text-slate-200 font-medium">
                {activeBatch.leadFaculty}
              </strong>{' '}
              · Core Subjects: {activeBatch.subjects.join(', ')}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="command-batch-switcher" className="sr-only">
              Switch Academic Batch
            </label>
            <select
              id="command-batch-switcher"
              value={activeBatch.id}
              onChange={(e) => {
                const found = batches.find((b) => b.id === e.target.value);
                if (found) onSelectBatch(found);
              }}
              className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code}) — {b.students.length} Students
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onOpenImportModal}
            className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
            <span>Upload Batch Marks / Attendance</span>
          </button>
        </div>
      </section>

      {/* 4-Card Executive KPI Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Batch Cumulative Mean</span>
            <BarChart3 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-bold font-mono-tabular text-slate-50">
              {summary.overallBatchAvgPct}%
            </span>
            <span
              className={`text-xs font-mono-tabular font-semibold ${
                summary.overallGrowthDeltaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.overallGrowthDeltaPct >= 0 ? '+' : ''}
              {summary.overallGrowthDeltaPct}% net growth
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Across {activeBatch.tests.length} scheduled assessments ({summary.totalStudents} students)
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Top Decile Benchmark</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-bold font-mono-tabular text-emerald-400">
              {topLeaderScoreMeta?.hasAppeared
                ? `${topLeaderScoreMeta.bestMarks} / ${topLeaderScoreMeta.bestMax}`
                : `${summary.topTenStudents[0]?.overallAvgPct ?? 0}%`}
            </span>
            <span className="text-xs font-mono-tabular text-slate-400 truncate">
              Rank #1 ({summary.topTenStudents[0]?.name || 'N/A'})
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate">
            {topLeaderScoreMeta?.hasAppeared ? (
              <>
                Best ({topLeaderScoreMeta.bestTestName}):{' '}
                <span className="font-mono-tabular text-emerald-300 font-semibold">
                  {topLeaderScoreMeta.bestPct.toFixed(2)}%
                </span>{' '}
                · Latest:{' '}
                <span className="font-mono-tabular text-slate-200 font-semibold">
                  {topLeaderScoreMeta.latestMarks}/{topLeaderScoreMeta.latestMax}
                </span>
              </>
            ) : (
              <span>Mean Accuracy: {summary.topTenStudents[0]?.overallAvgPct ?? 0}%</span>
            )}
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Attendance Vitality</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-bold font-mono-tabular text-slate-50">
              {summary.avgAttendancePct}%
            </span>
            <span className="text-xs font-mono-tabular text-slate-400">
              Min threshold: 75.0%
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {activeBatch.students.filter((s) => s.attendancePct < 75).length} students below
            mandatory 75% attendance
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Intervention Required</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-bold font-mono-tabular text-rose-400">
              {
                summary.interventionStudents.filter(
                  (s) => s.interventionStatus === 'Urgent Intervention'
                ).length
              }
            </span>
            <span className="text-xs font-mono-tabular text-amber-400">
              Urgent ·{' '}
              {
                summary.interventionStudents.filter((s) => s.interventionStatus === 'Watch')
                  .length
              }{' '}
              Watch
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Flagged by score dip, sub-55% accuracy, or low test attendance
          </p>
        </div>
      </section>

      {/* Primary Split: Recharts Longitudinal Growth Chart + Subject Breakdown */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 8 Columns: Interactive Recharts Longitudinal Batch Growth Chart */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400 shrink-0" />
                <h2 className="text-base font-semibold text-slate-100">
                  Student Growth &amp; Score Trajectory Over Time
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Tracking average batch scores, top/bottom deciles, and subject velocity across{' '}
                {chartPoints.length} test dates
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="Growth chart analytical view"
                className="inline-flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={chartView === 'cohort'}
                  onClick={() => setChartView('cohort')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    chartView === 'cohort'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Cohort Trajectory
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={chartView === 'subjects'}
                  onClick={() => setChartView('subjects')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    chartView === 'subjects'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Subject Trends
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={chartView === 'participation'}
                  onClick={() => setChartView('participation')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    chartView === 'participation'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Marks &amp; Participation
                </button>
              </div>

              {appearedOnlyPoints.length < allPoints.length && appearedOnlyPoints.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHideZeroAppearedTests((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    hideZeroAppearedTests
                      ? 'bg-indigo-950/80 border-indigo-500/60 text-indigo-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {hideZeroAppearedTests
                    ? `Appeared Tests Only (${appearedOnlyPoints.length})`
                    : `All Scheduled (${allPoints.length})`}
                </button>
              )}
            </div>
          </div>

          {/* Interactive Legend Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
            {chartView === 'cohort' && (
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
                  Top 10 Decile Avg (%)
                </span>
                <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                  <span className="w-3 h-0.5 bg-indigo-400 inline-block" />
                  Batch Appeared Mean (%)
                </span>
                <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                  <span className="w-3 h-0.5 bg-rose-400 inline-block" />
                  Bottom 10 Decile Avg (%)
                </span>
              </div>
            )}
            {chartView === 'subjects' && (
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                  <span className="w-3 h-0.5 bg-indigo-400 inline-block" />
                  Physics Avg (%)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
                  Chemistry Avg (%)
                </span>
                <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                  <span className="w-3 h-0.5 bg-amber-400 inline-block" />
                  {thirdSubjectLabel} Avg (%)
                </span>
              </div>
            )}
            {chartView === 'participation' && (
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                  <span className="w-2.5 h-2.5 bg-indigo-500/70 rounded-xs inline-block" />
                  Avg Marks Obtained (Raw Score)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
                  Test Participation / Attendance (%)
                </span>
              </div>
            )}
            <span className="text-[11px] font-mono-tabular text-slate-400">
              Hover any test date node for full coaching breakdown
            </span>
          </div>

          {/* Recharts Responsive Container */}
          <div
            className="w-full h-[270px] pt-1"
            data-testid="batch-growth-recharts-container"
            role="region"
            aria-label={`Longitudinal growth chart for ${activeBatch.name}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'cohort' ? (
                <ComposedChart
                  data={chartPoints}
                  margin={{ top: 12, right: 18, left: -12, bottom: 6 }}
                  onMouseMove={(state: any) => {
                    const byPayload = state?.activePayload?.[0]?.payload?.testId;
                    const idx =
                      typeof state?.activeTooltipIndex === 'number'
                        ? state.activeTooltipIndex
                        : Number(state?.activeTooltipIndex);
                    const byIndex =
                      !Number.isNaN(idx) && chartPoints[idx] ? chartPoints[idx].testId : undefined;
                    const byLabel = state?.activeLabel
                      ? chartPoints.find((p) => p.dateLabel === state.activeLabel)?.testId
                      : undefined;
                    const hoveredId = byPayload || byIndex || byLabel;
                    if (hoveredId && hoveredId !== focusedTestId) {
                      setFocusedTestId(hoveredId);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="rechartsBatchMeanGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    interval={0}
                    padding={{ left: 16, right: 16 }}
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace' }}
                    tickLine={false}
                    axisLine={{ stroke: '#1e293b' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    stroke="#64748b"
                    tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={renderCustomTooltip}
                    cursor={{ stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  />
                  <ReferenceLine
                    y={60}
                    stroke="#334155"
                    strokeDasharray="4 4"
                    label={{
                      value: '60% Target',
                      position: 'insideTopRight',
                      fill: '#64748b',
                      fontSize: 10,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="batchAvgPct"
                    name="Batch Appeared Mean"
                    stroke="none"
                    fill="url(#rechartsBatchMeanGrad)"
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <Line
                    type="monotone"
                    dataKey="topTenAvgPct"
                    name="Top 10 Avg"
                    stroke="#34d399"
                    strokeWidth={2.25}
                    dot={{ r: 4, fill: '#34d399', strokeWidth: 0 }}
                    activeDot={{ r: 6.5, fill: '#34d399', stroke: '#090d16', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <Line
                    type="monotone"
                    dataKey="batchAvgPct"
                    name="Appeared Mean"
                    stroke="#818cf8"
                    strokeWidth={2.75}
                    dot={{ r: 4.5, fill: '#818cf8', strokeWidth: 0 }}
                    activeDot={{ r: 7, fill: '#818cf8', stroke: '#090d16', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <Line
                    type="monotone"
                    dataKey="bottomTenAvgPct"
                    name="Bottom 10 Avg"
                    stroke="#fb7185"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 3.5, fill: '#fb7185', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#fb7185', stroke: '#090d16', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                </ComposedChart>
              ) : chartView === 'subjects' ? (
                <ComposedChart
                  data={chartPoints}
                  margin={{ top: 12, right: 18, left: -12, bottom: 6 }}
                  onMouseMove={(state: any) => {
                    const byPayload = state?.activePayload?.[0]?.payload?.testId;
                    const idx =
                      typeof state?.activeTooltipIndex === 'number'
                        ? state.activeTooltipIndex
                        : Number(state?.activeTooltipIndex);
                    const byIndex =
                      !Number.isNaN(idx) && chartPoints[idx] ? chartPoints[idx].testId : undefined;
                    const byLabel = state?.activeLabel
                      ? chartPoints.find((p) => p.dateLabel === state.activeLabel)?.testId
                      : undefined;
                    const hoveredId = byPayload || byIndex || byLabel;
                    if (hoveredId && hoveredId !== focusedTestId) {
                      setFocusedTestId(hoveredId);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    interval={0}
                    padding={{ left: 16, right: 16 }}
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace' }}
                    tickLine={false}
                    axisLine={{ stroke: '#1e293b' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    stroke="#64748b"
                    tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={renderCustomTooltip}
                    cursor={{ stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="physicsAvgPct"
                    name="Physics Avg"
                    stroke="#818cf8"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#818cf8', strokeWidth: 0 }}
                    activeDot={{ r: 6.5, fill: '#818cf8', stroke: '#090d16', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <Line
                    type="monotone"
                    dataKey="chemistryAvgPct"
                    name="Chemistry Avg"
                    stroke="#34d399"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#34d399', strokeWidth: 0 }}
                    activeDot={{ r: 6.5, fill: '#34d399', stroke: '#090d16', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <Line
                    type="monotone"
                    dataKey="mathOrBioAvgPct"
                    name={`${thirdSubjectLabel} Avg`}
                    stroke="#fbbf24"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#fbbf24', strokeWidth: 0 }}
                    activeDot={{ r: 6.5, fill: '#fbbf24', stroke: '#090d16', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                </ComposedChart>
              ) : (
                <ComposedChart
                  data={chartPoints}
                  margin={{ top: 12, right: 18, left: -12, bottom: 6 }}
                  onMouseMove={(state: any) => {
                    const byPayload = state?.activePayload?.[0]?.payload?.testId;
                    const idx =
                      typeof state?.activeTooltipIndex === 'number'
                        ? state.activeTooltipIndex
                        : Number(state?.activeTooltipIndex);
                    const byIndex =
                      !Number.isNaN(idx) && chartPoints[idx] ? chartPoints[idx].testId : undefined;
                    const byLabel = state?.activeLabel
                      ? chartPoints.find((p) => p.dateLabel === state.activeLabel)?.testId
                      : undefined;
                    const hoveredId = byPayload || byIndex || byLabel;
                    if (hoveredId && hoveredId !== focusedTestId) {
                      setFocusedTestId(hoveredId);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    interval={0}
                    padding={{ left: 16, right: 16 }}
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace' }}
                    tickLine={false}
                    axisLine={{ stroke: '#1e293b' }}
                  />
                  <YAxis
                    yAxisId="marks"
                    stroke="#64748b"
                    tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="pct"
                    orientation="right"
                    domain={[0, 100]}
                    stroke="#64748b"
                    tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={renderCustomTooltip}
                    cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                  />
                  <Bar
                    yAxisId="marks"
                    dataKey="avgMarksObtained"
                    name="Avg Marks Obtained"
                    fill="#6366f1"
                    fillOpacity={0.65}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={42}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="attendanceAvgPct"
                    name="Participation %"
                    stroke="#34d399"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#34d399', strokeWidth: 0 }}
                    activeDot={{ r: 6.5, fill: '#34d399', stroke: '#090d16', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Framer Motion Synchronized Test Difficulty & Student Outlier Telemetry Strip */}
          {activeFocusedPoint && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFocusedPoint.testId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                data-testid="active-test-outlier-spotlight"
                className="bg-slate-950/90 border border-indigo-500/30 rounded-xl p-3.5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-100">
                      {activeFocusedPoint.testName}
                    </span>
                    <span className="text-[11px] font-mono-tabular text-slate-400">
                      ({activeFocusedPoint.testDate} · Max {activeFocusedPoint.maxMarks ?? 300})
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const dStyle = getDifficultyBadgeStyle(activeFocusedPoint.difficultyLabel);
                      return (
                        <div
                          className={`px-2 py-0.5 rounded border text-[10px] font-mono-tabular font-semibold uppercase tracking-wider ${dStyle.bg} ${dStyle.text}`}
                        >
                          {activeFocusedPoint.difficultyLabel || 'Moderate'} · Index{' '}
                          {activeFocusedPoint.difficultyIndex ?? 0}/100
                        </div>
                      );
                    })()}
                    {activeFocusedPoint.hardestSubject && (
                      <div className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] font-mono-tabular text-amber-300">
                        Hardest: {activeFocusedPoint.hardestSubject.name} (
                        {activeFocusedPoint.hardestSubject.avgPct}%)
                      </div>
                    )}
                    <div className="px-2 py-0.5 rounded border border-slate-700 bg-slate-900 text-[10px] font-mono-tabular text-slate-300">
                      Spread ±{activeFocusedPoint.scoreSpreadStdDev ?? 0}% StdDev
                    </div>
                  </div>
                </div>

                {(activeFocusedPoint.appearedCount ?? 1) > 0 &&
                activeFocusedPoint.batchAvgPct > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {activeFocusedPoint.topOutlier && (
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectOutlierStudent(activeFocusedPoint.topOutlier?.studentId)
                        }
                        className="text-left p-2.5 rounded-lg bg-emerald-950/25 hover:bg-emerald-950/45 border border-emerald-500/25 transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px] font-mono-tabular uppercase tracking-wider text-emerald-400">
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            <Award className="w-3 h-3 shrink-0" /> Top Outlier (#1)
                          </span>
                          <span className="font-bold text-emerald-300 whitespace-nowrap">
                            {activeFocusedPoint.topOutlier.pct}% (
                            {activeFocusedPoint.topOutlier.marks}/
                            {activeFocusedPoint.topOutlier.maxMarks})
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-100 group-hover:text-emerald-200 truncate mt-1">
                          {activeFocusedPoint.topOutlier.name}
                        </div>
                        <div className="text-[10px] font-mono-tabular text-slate-400">
                          Reg: {activeFocusedPoint.topOutlier.regNo} · Click to inspect 360°
                        </div>
                      </button>
                    )}

                    {activeFocusedPoint.bottomOutlier && (
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectOutlierStudent(activeFocusedPoint.bottomOutlier?.studentId)
                        }
                        className="text-left p-2.5 rounded-lg bg-rose-950/25 hover:bg-rose-950/45 border border-rose-500/25 transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px] font-mono-tabular uppercase tracking-wider text-rose-400">
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            <TrendingDown className="w-3 h-3 shrink-0" /> Lowest Outlier
                          </span>
                          <span className="font-bold text-rose-300 whitespace-nowrap">
                            {activeFocusedPoint.bottomOutlier.pct}% (
                            {activeFocusedPoint.bottomOutlier.marks}/
                            {activeFocusedPoint.bottomOutlier.maxMarks})
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-100 group-hover:text-rose-200 truncate mt-1">
                          {activeFocusedPoint.bottomOutlier.name}
                        </div>
                        <div className="text-[10px] font-mono-tabular text-slate-400">
                          Reg: {activeFocusedPoint.bottomOutlier.regNo} · Click to remediate
                        </div>
                      </button>
                    )}

                    {activeFocusedPoint.momentumOutlier ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectOutlierStudent(activeFocusedPoint.momentumOutlier?.studentId)
                        }
                        className="text-left p-2.5 rounded-lg bg-indigo-950/30 hover:bg-indigo-950/50 border border-indigo-500/25 transition-colors group"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono-tabular uppercase tracking-wider text-indigo-300">
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" /> Velocity Outlier
                          </span>
                          <span
                            className={`font-bold ${
                              (activeFocusedPoint.momentumOutlier.deltaFromPrevPct ?? 0) >= 0
                                ? 'text-emerald-300'
                                : 'text-amber-300'
                            }`}
                          >
                            {(activeFocusedPoint.momentumOutlier.deltaFromPrevPct ?? 0) >= 0
                              ? '+'
                              : ''}
                            {activeFocusedPoint.momentumOutlier.deltaFromPrevPct ?? 0}% vs Prev
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-100 group-hover:text-indigo-200 truncate mt-1">
                          {activeFocusedPoint.momentumOutlier.name}
                        </div>
                        <div className="text-[10px] font-mono-tabular text-slate-400">
                          Scored {activeFocusedPoint.momentumOutlier.pct}% (
                          {activeFocusedPoint.momentumOutlier.marks}/
                          {activeFocusedPoint.momentumOutlier.maxMarks})
                        </div>
                      </button>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                        <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                          Baseline Assessment Node
                        </div>
                        <div className="text-xs font-semibold text-slate-200 mt-1">
                          Initial Cohort Benchmark
                        </div>
                        <div className="text-[10px] font-mono-tabular text-slate-400">
                          Top-to-Bottom Spread:{' '}
                          {(
                            activeFocusedPoint.highestPct - activeFocusedPoint.lowestPct
                          ).toFixed(1)}
                          %
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs font-mono-tabular text-rose-300 py-1">
                    Scheduled Assessment · 0 of {activeFocusedPoint.totalStudents} students have
                    recorded OMR marks for this test node.
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Interactive Test-by-Test Schedule & Participation Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-800/80">
            {allPoints.map((pt) => {
              const isFocused = activeFocusedPoint?.testId === pt.testId;
              return (
                <button
                  key={pt.testId}
                  type="button"
                  onMouseEnter={() => setFocusedTestId(pt.testId)}
                  onClick={() => setFocusedTestId(pt.testId)}
                  className={`relative text-left p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                    isFocused
                      ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md'
                      : 'bg-slate-950/70 border-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="text-slate-200 font-semibold truncate">{pt.testName}</div>
                    {pt.difficultyLabel && pt.difficultyLabel !== 'Scheduled' && (
                      <span
                        className={`text-[9px] font-mono-tabular px-1 rounded ${
                          pt.difficultyLabel === 'High Difficulty'
                            ? 'bg-rose-500/20 text-rose-300'
                            : pt.difficultyLabel === 'Moderate'
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        D:{pt.difficultyIndex}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono-tabular truncate">
                    {pt.testDate} · Out of {pt.maxMarks ?? 300}
                  </div>
                  <div className="font-mono-tabular font-semibold text-indigo-400 mt-1">
                    {(pt.appearedCount ?? 1) > 0 && pt.batchAvgPct > 0
                      ? `${pt.batchAvgPct}% (${pt.avgMarksObtained ?? 0}/${pt.maxMarks ?? 300})`
                      : '0 Appeared'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono-tabular truncate">
                    {pt.topOutlier
                      ? `Top: ${pt.topOutlier.name.split(' ')[0]} (${pt.topOutlier.pct}%)`
                      : pt.appearedCount !== undefined
                      ? `${pt.appearedCount}/${pt.totalStudents} Appeared`
                      : `Att ${pt.attendanceAvgPct}%`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 4 Columns: Subject-Wise Performance & Remediation Focus */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Subject-Level Accuracy &amp; Weak Counts
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Latest appeared assessment breakdown across core batch subjects
              </p>
            </div>

            <div className="space-y-4 pt-1">
              {summary.subjectSummaries.map((sub) => (
                <div
                  key={sub.subject}
                  className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-lg space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-100">
                      {sub.subject}
                    </span>
                    <span className="text-sm font-mono-tabular font-bold text-indigo-400">
                      {sub.avgPct}% Avg
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, sub.avgPct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono-tabular">
                    <span>Highest: {sub.topScorePct}%</span>
                    <span className="text-amber-400">
                      {sub.weakStudentCount} students &lt;60%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-indigo-950/30 border border-indigo-800/50 rounded-lg space-y-1.5">
            <div className="text-xs font-semibold text-indigo-300">
              Faculty Action Recommendation
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Click any student row below to open their complete test-by-test coaching ledger,
              exact subject marks obtained, and weak-topic practice questions.
            </p>
          </div>
        </div>
      </section>

      {/* Segmented Cohort Roster: Top 10, Bottom 10, Intervention Required, Full Roster, Excel Sheet Ledger */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Batch student segment filter"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeSegment === 'top10'}
              onClick={() => setActiveSegment('top10')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeSegment === 'top10'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Top 10 Performers ({summary.topTenStudents.length})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSegment === 'bottom10'}
              onClick={() => setActiveSegment('bottom10')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeSegment === 'bottom10'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bottom 10 Performers ({summary.bottomTenStudents.length})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSegment === 'intervention'}
              onClick={() => setActiveSegment('intervention')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeSegment === 'intervention'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Intervention Required ({summary.interventionStudents.length})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSegment === 'all'}
              onClick={() => setActiveSegment('all')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeSegment === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Complete Batch Roster ({activeBatch.students.length})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSegment === 'excel_ledger'}
              onClick={() => setActiveSegment('excel_ledger')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSegment === 'excel_ledger'
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-400 hover:text-emerald-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel Sheet Ledger (Exact Rows)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Test Selector Filter */}
            <div>
              <label htmlFor="roster-test-selector" className="sr-only">
                Inspect Specific Test Marks
              </label>
              <select
                id="roster-test-selector"
                value={selectedRosterTestId}
                onChange={(e) => setSelectedRosterTestId(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono-tabular"
              >
                <option value="__all__">All Assessments (Latest &amp; Best Per-Test Marks)</option>
                {activeBatch.tests.map((t) => (
                  <option key={t.testId} value={t.testId}>
                    {t.testName} ({t.testDate}) — Out of {t.maxMarks}
                  </option>
                ))}
              </select>
            </div>

            {/* Search within Segment */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="Filter students in current table"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Filter by student name or Reg No..."
                className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Segment Context Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {activeSegment === 'top10' &&
                'Showing highest-scoring students in this batch with exact per-test marks (Score / Out of) as recorded in the Excel sheet.'}
              {activeSegment === 'bottom10' &&
                'Showing lowest-scoring students in ascending order for immediate faculty remediation.'}
              {activeSegment === 'intervention' &&
                'Showing students flagged for Urgent Intervention or Watch due to score drop, sub-55% score, or low test attendance.'}
              {activeSegment === 'all' &&
                `Showing all ${activeBatch.students.length} students enrolled in ${activeBatch.name} with exact per-test marks.`}
              {activeSegment === 'excel_ledger' &&
                'Exact 19-column coaching Excel sheet ledger showing every scheduled test row cell-for-cell (Out of, Score, Avg. Score, Subject %, and Offline/Regional/Center Ranks).'}
            </span>
          </div>
          <span className="font-mono-tabular">
            {activeSegment === 'excel_ledger'
              ? `${displayedStudents.reduce((acc, s) => acc + s.testAttempts.length, 0)} test rows`
              : `${displayedStudents.length} students`}
          </span>
        </div>

        {activeSegment === 'excel_ledger' ? (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/90 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-2.5">Region / Center</th>
                  <th className="py-3 px-2.5">Reg No</th>
                  <th className="py-3 px-2.5 min-w-[150px]">Student Name</th>
                  <th className="py-3 px-2.5">Batch</th>
                  <th className="py-3 px-2.5">Stream</th>
                  <th className="py-3 px-2.5">Test Date</th>
                  <th className="py-3 px-2.5">Test Name</th>
                  <th className="py-3 px-2.5">Type</th>
                  <th className="py-3 px-2.5 text-right">Out of</th>
                  <th className="py-3 px-2.5 text-right">Score</th>
                  <th className="py-3 px-2.5 text-right">Avg. Score</th>
                  <th className="py-3 px-2.5 text-right">Avg. Physics</th>
                  <th className="py-3 px-2.5 text-right">Avg. Chemistry</th>
                  <th className="py-3 px-2.5 text-right">Avg. {thirdSubjectLabel}</th>
                  <th className="py-3 px-2.5 text-right">Offline Rank</th>
                  <th className="py-3 px-2.5 text-right">Regional Rank</th>
                  <th className="py-3 px-2.5 text-right">Center Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {displayedStudents.flatMap((rawStu) => {
                  const student = enrichStudentSummaryFromAttempts(rawStu);
                  const attemptsToShow =
                    selectedRosterTestId === '__all__'
                      ? student.testAttempts
                      : student.testAttempts.filter((t) => t.testId === selectedRosterTestId);

                  return attemptsToShow.map((att, attIdx) => {
                    const isAppeared = att.appeared !== false;
                    const phy = att.subjectScores[0];
                    const chem = att.subjectScores[1];
                    const mathBio = att.subjectScores[2];

                    return (
                      <tr
                        key={`${student.id}-${att.testId}-${attIdx}`}
                        onClick={() => onSelectStudent(student, activeBatch)}
                        className={`transition-colors cursor-pointer ${
                          isAppeared
                            ? 'hover:bg-slate-800/60'
                            : 'bg-slate-950/40 text-slate-500 hover:bg-slate-900/60'
                        }`}
                      >
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          <div className="font-medium text-slate-300">
                            {att.regionName || student.regionName || 'UP'} ·{' '}
                            {att.combinedCenterName ||
                              student.combinedCenterName ||
                              'Varanasi Vidyapeeth'}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                            {att.centerName || student.centerName || 'GD Global School (S-SIP)'}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 font-mono-tabular font-semibold text-indigo-300 whitespace-nowrap">
                          {student.regNo}
                        </td>
                        <td className="py-2.5 px-2.5 font-semibold text-slate-100 whitespace-nowrap">
                          {student.name}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono-tabular text-slate-300 whitespace-nowrap">
                          {att.batchCodeForTest || student.batchName}
                        </td>
                        <td className="py-2.5 px-2.5 text-slate-300 whitespace-nowrap">
                          {att.classStream || student.stream}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono-tabular text-slate-300 whitespace-nowrap">
                          {att.testDate}
                        </td>
                        <td className="py-2.5 px-2.5 font-semibold text-slate-200 whitespace-nowrap">
                          {att.testName}
                        </td>
                        <td className="py-2.5 px-2.5 text-slate-400 whitespace-nowrap">
                          {att.testType || 'Main'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono-tabular text-slate-300 whitespace-nowrap">
                          {att.maxMarks}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono-tabular font-bold whitespace-nowrap">
                          {isAppeared ? (
                            <span className="text-emerald-300">
                              {att.totalMarks} / {att.maxMarks}
                            </span>
                          ) : (
                            <span className="text-rose-400/80 font-normal">Absent</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono-tabular font-semibold whitespace-nowrap">
                          {isAppeared ? (
                            <span className="text-indigo-300">
                              {att.percentage.toFixed(2)}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono-tabular whitespace-nowrap">
                          {isAppeared && phy ? (
                            <span>
                              {phy.percentage.toFixed(2)}%{' '}
                              <span className="text-[10px] text-slate-500">
                                ({phy.marksObtained}/{phy.maxMarks})
                              </span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono-tabular whitespace-nowrap">
                          {isAppeared && chem ? (
                            <span>
                              {chem.percentage.toFixed(2)}%{' '}
                              <span className="text-[10px] text-slate-500">
                                ({chem.marksObtained}/{chem.maxMarks})
                              </span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono-tabular whitespace-nowrap">
                          {isAppeared && mathBio ? (
                            <span>
                              {mathBio.percentage.toFixed(2)}%{' '}
                              <span className="text-[10px] text-slate-500">
                                ({mathBio.marksObtained}/{mathBio.maxMarks})
                              </span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono-tabular text-slate-200 whitespace-nowrap">
                          {isAppeared ? att.offlineRank ?? att.rankInTest ?? '—' : '—'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono-tabular text-emerald-400 whitespace-nowrap">
                          {isAppeared ? att.regionalRank ?? '—' : '—'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono-tabular text-indigo-300 whitespace-nowrap">
                          {isAppeared ? att.centerRank ?? '—' : '—'}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Standard Roster Table with Exact Per-Test Marks (Never Summed Multi-Test Denominators) */
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/90 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-2.5">Rank</th>
                  <th className="py-3 px-2.5 min-w-[160px]">Student &amp; Reg No</th>
                  <th className="py-3 px-2 text-right">Appeared</th>
                  <th className="py-3 px-2.5 text-right">
                    {selectedRosterTestId === '__all__'
                      ? 'Latest Test (Score / Out of)'
                      : 'Selected Test (Score / Out of)'}
                  </th>
                  <th className="py-3 px-2.5 text-right">Best Test Marks</th>
                  <th className="py-3 px-2.5 min-w-[205px] max-w-[225px]">Per-Test Score Ledger</th>
                  <th className="py-3 px-2.5 text-right">Mean %</th>
                  <th className="py-3 px-2.5 text-right">Ranks (Off/Reg/Cen)</th>
                  <th className="py-3 px-2 text-right">Att %</th>
                  <th className="py-3 px-2.5">Diagnostic Status</th>
                  <th className="py-3 px-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {displayedStudents.map((rawStu) => {
                  const student = enrichStudentSummaryFromAttempts(rawStu);
                  const scoreMeta = getStudentExactScoreSummary(student);
                  const specificAttempt =
                    selectedRosterTestId !== '__all__'
                      ? student.testAttempts.find((t) => t.testId === selectedRosterTestId)
                      : undefined;
                  const appearedAttempts = student.testAttempts.filter(
                    (t) => t.appeared !== false
                  );

                  const formatShortChipTestName = (name: string) =>
                    name
                      .replace(/^Milestone[-:\s]*/i, 'M-')
                      .replace(/^VP AIR Part Test[-:\s]*/i, 'VP-PT')
                      .replace(/\s*\(Advance\s*:\s*Paper\s*-\s*1\)\s*\(Advanced\)/i, ' (P1)')
                      .replace(/\s*\(Advance\s*:\s*Paper\s*-\s*2\)\s*\(Advanced\)/i, ' (P2)')
                      .replace(/\s*Advanced\s*\(Paper\s*1\)/i, ' (Adv)')
                      .replace(/\s*\(Main\)/i, '');

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="py-3 px-2.5 font-mono-tabular font-semibold text-slate-200 whitespace-nowrap">
                        #{student.rankInBatch}
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          ({student.batchPercentile}%ile)
                        </span>
                      </td>

                      <td className="py-3 px-2.5">
                        <button
                          type="button"
                          onClick={() => onSelectStudent(student, activeBatch)}
                          className="text-left group-hover:text-indigo-300 transition-colors cursor-pointer"
                        >
                          <div className="font-semibold text-slate-100 group-hover:text-indigo-300 whitespace-nowrap">
                            {student.name}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-slate-400 truncate max-w-[175px]">
                            {student.regNo}
                            {student.centerName ? ` · ${student.centerName}` : ''}
                          </div>
                        </button>
                      </td>

                      <td className="py-3 px-2 text-right font-mono-tabular text-slate-300 whitespace-nowrap">
                        {student.testsAppearedCount ?? student.testAttempts.length} /{' '}
                        {student.testsScheduledCount ?? student.testAttempts.length}
                      </td>

                      <td className="py-3 px-2.5 text-right font-mono-tabular whitespace-nowrap">
                        {specificAttempt ? (
                          specificAttempt.appeared !== false ? (
                            <div>
                              <div className="font-bold text-indigo-300">
                                {specificAttempt.totalMarks} / {specificAttempt.maxMarks}{' '}
                                <span className="text-slate-300 font-semibold">
                                  ({specificAttempt.percentage.toFixed(2)}%)
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {specificAttempt.testName}
                                {specificAttempt.testDate ? ` · ${specificAttempt.testDate}` : ''}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="text-rose-400 font-semibold">
                                Absent (0 / {specificAttempt.maxMarks})
                              </span>
                              <div className="text-[10px] text-slate-500">
                                {specificAttempt.testName}
                              </div>
                            </div>
                          )
                        ) : scoreMeta.hasAppeared ? (
                          <div>
                            <div className="font-bold text-indigo-300">
                              {scoreMeta.latestMarks} / {scoreMeta.latestMax}{' '}
                              <span className="text-slate-300 font-semibold">
                                ({scoreMeta.latestPct.toFixed(2)}%)
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {scoreMeta.latestTestName}
                              {scoreMeta.latestTestDate ? ` · ${scoreMeta.latestTestDate}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-rose-400 font-semibold">
                            Absent (0 Appeared)
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 text-right font-mono-tabular whitespace-nowrap">
                        {scoreMeta.hasAppeared ? (
                          <div>
                            <div className="font-bold text-emerald-300">
                              {scoreMeta.bestMarks} / {scoreMeta.bestMax}{' '}
                              <span className="text-slate-300 font-semibold">
                                ({scoreMeta.bestPct.toFixed(2)}%)
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {scoreMeta.bestTestName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 max-w-[225px]">
                        {appearedAttempts.length > 0 ? (
                          <div className="space-y-1 max-w-[220px] overflow-hidden">
                            <div className="flex flex-wrap gap-1">
                              {appearedAttempts.slice(-4).map((att) => (
                                <span
                                  key={att.testId}
                                  className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono-tabular text-slate-300 whitespace-nowrap"
                                  title={`${att.testName} (${att.testDate}): ${att.totalMarks}/${att.maxMarks} (${att.percentage}%)`}
                                >
                                  {formatShortChipTestName(att.testName)}:{' '}
                                  <strong className="text-indigo-300">
                                    {att.totalMarks}/{att.maxMarks}
                                  </strong>
                                </span>
                              ))}
                            </div>
                            <div className="text-[10px] font-mono-tabular text-slate-400 whitespace-nowrap">
                              Sum ({appearedAttempts.length} tests):{' '}
                              <span className="text-slate-300 font-semibold">
                                {student.totalMarksObtained} / {student.totalMaxMarksAppeared}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono-tabular text-rose-400/80">
                            No appeared tests
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 text-right font-mono-tabular font-bold text-slate-100 whitespace-nowrap">
                        {student.overallAvgPct.toFixed(2)}%
                      </td>

                      <td className="py-3 px-2.5 text-right font-mono-tabular text-slate-300 whitespace-nowrap">
                        {student.bestOfflineRank ||
                        student.bestRegionalRank ||
                        student.bestCenterRank ? (
                          <span>
                            {student.bestOfflineRank ? `#${student.bestOfflineRank}` : '—'} /{' '}
                            <span className="text-emerald-400">
                              {student.bestRegionalRank ? `#${student.bestRegionalRank}` : '—'}
                            </span>{' '}
                            /{' '}
                            <span className="text-indigo-300">
                              {student.bestCenterRank ? `#${student.bestCenterRank}` : '—'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-500">#{student.rankInBatch}</span>
                        )}
                      </td>

                      <td className="py-3 px-2 text-right font-mono-tabular whitespace-nowrap">
                        <span
                          className={
                            student.attendancePct < 75
                              ? 'text-rose-400 font-semibold'
                              : student.attendancePct < 82
                              ? 'text-amber-400'
                              : 'text-slate-200'
                          }
                        >
                          {student.attendancePct}%
                        </span>
                      </td>

                      <td className="py-3 px-2.5">
                        <div className="space-y-0.5">
                          <span
                            className={`inline-block text-[11px] font-semibold whitespace-nowrap ${
                              student.interventionStatus === 'Urgent Intervention'
                                ? 'text-rose-400'
                                : student.interventionStatus === 'Watch'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {student.interventionStatus}
                          </span>
                          <div className="text-[10px] text-slate-400 max-w-[165px] truncate">
                            {student.interventionReasons[0]}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectStudent(student, activeBatch)}
                            className="px-2 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
                          >
                            Profile →
                          </button>
                          <button
                            type="button"
                            onClick={() => onQueueReportForStudent(student, activeBatch)}
                            title="Queue Progress Report for Parent / Teacher"
                            className="px-2 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3 h-3 text-indigo-400" />
                            <span>Report</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
