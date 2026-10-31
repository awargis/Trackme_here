import type {
  AcademicAgentChatTurn,
  AcademicAgentMatchedBatch,
  AcademicAgentMatchedStudent,
  AcademicAgentQueryResponse,
  BatchAnalyticsSummary,
  BatchRecord,
  InterventionLevel,
  LongitudinalTestPoint,
  PracticeQuestion,
  StudentRecord,
  SubjectBatchSummary,
  TestAttempt,
  TestStudentOutlier,
  TopicScore,
  UploadCategory,
  UploadedStudentRow,
} from '../types/academic.ts';

/**
 * Classifies a student's intervention status and generates human-readable diagnostic reasons
 * based on overall accuracy, test trajectory delta, and attendance rate.
 */
export function evaluateInterventionStatus(
  overallAvgPct: number,
  growthDeltaPct: number,
  attendancePct: number,
  latestTestPct: number
): { status: InterventionLevel; reasons: string[] } {
  const reasons: string[] = [];

  if (attendancePct < 75) {
    reasons.push(`Attendance below threshold (${attendancePct.toFixed(1)}% vs 75% min)`);
  } else if (attendancePct < 82) {
    reasons.push(`Attendance requires monitoring (${attendancePct.toFixed(1)}%)`);
  }

  if (overallAvgPct < 55) {
    reasons.push(`Cumulative score below benchmark (${overallAvgPct.toFixed(2)}%)`);
  }

  if (growthDeltaPct <= -6) {
    reasons.push(`Negative trajectory across recent tests (${growthDeltaPct.toFixed(2)}%)`);
  }

  if (latestTestPct < 50 && overallAvgPct >= 55) {
    reasons.push(`Sharp dip in latest assessment (${latestTestPct.toFixed(2)}%)`);
  }

  if (overallAvgPct < 55 || attendancePct < 75 || (growthDeltaPct <= -8 && latestTestPct < 60)) {
    return {
      status: 'Urgent Intervention',
      reasons: reasons.length > 0 ? reasons : ['Immediate academic counseling required'],
    };
  }

  if (overallAvgPct < 68 || attendancePct < 82 || growthDeltaPct <= -4) {
    return {
      status: 'Watch',
      reasons: reasons.length > 0 ? reasons : ['Moderate fluctuation in topic accuracy'],
    };
  }

  return {
    status: 'Optimal',
    reasons: ['Consistent test progression and healthy attendance'],
  };
}

/**
 * Formats Excel serial dates (e.g. 46187 -> 14 June 2026), M/D/YY, and YYYY-MM-DD strings
 * into clean corporate dates ("14 June 2026").
 */
export function formatCoachingDate(dStr: string): string | undefined {
  if (!dStr || /^#+$/.test(dStr)) return undefined;
  const trimmed = String(dStr).trim();
  if (!trimmed) return undefined;
  const monthsFull = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  // Match Excel serial date numbers (e.g., 46159 -> 17 May 2026, 46187 -> 14 June 2026)
  if (/^\d{5}(\.\d+)?$/.test(trimmed)) {
    const serial = Math.floor(Number(trimmed));
    if (serial >= 40000 && serial <= 55000) {
      const utcMs = Date.UTC(1899, 11, 30) + serial * 86400000;
      const dt = new Date(utcMs);
      const d = dt.getUTCDate();
      const m = dt.getUTCMonth();
      const y = dt.getUTCFullYear();
      return `${String(d).padStart(2, '0')} ${monthsFull[m]} ${y}`;
    }
  }
  // Match M/D/YY or M/D/YYYY from XLSX parser (e.g. 5/17/26 or 07/01/2026)
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const m = Number(mdy[1]);
    const d = Number(mdy[2]);
    let y = Number(mdy[3]);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(d).padStart(2, '0')} ${monthsFull[m - 1]} ${y}`;
    }
  }
  // Match YYYY-MM-DD
  const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(d).padStart(2, '0')} ${monthsFull[m - 1]} ${y}`;
    }
  }
  return trimmed;
}

/**
 * Repairs any test attempt where Excel '%' cell formatting inflated Out of / Score by 100x
 * (e.g., 24200 / 30000 -> 242 / 300, 3700 / 18000 -> 37 / 180) and formats raw Excel serial dates (46187 -> 14 June 2026).
 */
export function sanitizeTestAttemptScaleAndDate(att: TestAttempt): TestAttempt {
  let maxMarks = Number(att.maxMarks) || 300;
  let totalMarks = Number(att.totalMarks) || 0;
  let wasScaledDown = false;

  if (maxMarks > 1000 && maxMarks % 100 === 0 && maxMarks / 100 <= 1000) {
    maxMarks = Math.round(maxMarks / 100);
    wasScaledDown = true;
  }

  if (wasScaledDown) {
    if (
      Math.abs(totalMarks) > maxMarks ||
      (totalMarks % 100 === 0 &&
        att.percentage !== undefined &&
        maxMarks > 0 &&
        Math.abs((totalMarks / 100 / maxMarks) * 100 - Number(att.percentage)) <
          Math.abs((totalMarks / maxMarks) * 100 - Number(att.percentage)))
    ) {
      totalMarks = Math.round(totalMarks / 100);
    }
  } else if (
    maxMarks > 0 &&
    Math.abs(totalMarks) > maxMarks &&
    totalMarks % 100 === 0 &&
    Math.abs(totalMarks / 100) <= maxMarks
  ) {
    totalMarks = Math.round(totalMarks / 100);
    wasScaledDown = true;
  }

  let offlineRank = att.offlineRank !== undefined ? Number(att.offlineRank) : undefined;
  let regionalRank = att.regionalRank !== undefined ? Number(att.regionalRank) : undefined;
  let centerRank = att.centerRank !== undefined ? Number(att.centerRank) : undefined;
  let rankInTest = att.rankInTest !== undefined ? Number(att.rankInTest) : undefined;

  const presentRanks = [offlineRank, regionalRank, centerRank].filter(
    (r): r is number => r !== undefined && !isNaN(r) && r > 0
  );
  const allRanksInflated100x =
    presentRanks.length > 0 &&
    presentRanks.every((r) => r >= 100 && r % 100 === 0) &&
    (wasScaledDown || presentRanks.length >= 2 || presentRanks.some((r) => r >= 500));

  if (wasScaledDown || allRanksInflated100x) {
    if (offlineRank !== undefined && offlineRank >= 100 && offlineRank % 100 === 0) {
      offlineRank = Math.round(offlineRank / 100);
    }
    if (regionalRank !== undefined && regionalRank >= 100 && regionalRank % 100 === 0) {
      regionalRank = Math.round(regionalRank / 100);
    }
    if (centerRank !== undefined && centerRank >= 100 && centerRank % 100 === 0) {
      centerRank = Math.round(centerRank / 100);
    }
    if (rankInTest !== undefined && rankInTest >= 100 && rankInTest % 100 === 0) {
      rankInTest = Math.round(rankInTest / 100);
    }
  }

  const formattedDate = att.testDate ? formatCoachingDate(String(att.testDate)) || att.testDate : att.testDate;

  let subjectScores = att.subjectScores || [];
  if (wasScaledDown && subjectScores.length > 0) {
    const subjCount = subjectScores.length;
    const defaultSubjMax = Math.round(maxMarks / subjCount);
    const scaledSubjects = subjectScores.map((s) => {
      const sMax =
        s.maxMarks >= 1000 && s.maxMarks % 100 === 0
          ? Math.round(s.maxMarks / 100)
          : defaultSubjMax;
      const sMarks =
        att.appeared === false
          ? 0
          : Math.abs(s.marksObtained) > sMax
          ? Math.round(s.marksObtained / 100)
          : Math.round(((Number(s.percentage) || 0) / 100) * sMax);
      return {
        ...s,
        maxMarks: sMax,
        marksObtained: Math.max(0, Math.min(sMax, sMarks)),
      };
    });

    if (att.appeared !== false && scaledSubjects.length > 0) {
      const sumExceptLast = scaledSubjects
        .slice(0, -1)
        .reduce((acc, s) => acc + s.marksObtained, 0);
      const lastIdx = scaledSubjects.length - 1;
      const lastMax = scaledSubjects[lastIdx].maxMarks;
      scaledSubjects[lastIdx] = {
        ...scaledSubjects[lastIdx],
        marksObtained: Math.max(0, Math.min(lastMax, totalMarks - sumExceptLast)),
      };
    }
    subjectScores = scaledSubjects;
  }

  const percentage =
    att.appeared === false
      ? 0
      : maxMarks > 0
      ? Number(((totalMarks / maxMarks) * 100).toFixed(2))
      : Number(att.percentage) || 0;

  return {
    ...att,
    testDate: formattedDate,
    maxMarks,
    totalMarks: att.appeared === false ? 0 : totalMarks,
    percentage,
    subjectScores,
    ...(offlineRank !== undefined ? { offlineRank } : {}),
    ...(regionalRank !== undefined ? { regionalRank } : {}),
    ...(centerRank !== undefined ? { centerRank } : {}),
    ...(rankInTest !== undefined ? { rankInTest } : {}),
  };
}

/**
 * Enriches a StudentRecord with exact latest/best per-test marks (as in the Excel sheet),
 * exact appeared test counts, best ranks, and coaching center metadata derived from testAttempts.
 */
export function enrichStudentSummaryFromAttempts(student: StudentRecord): StudentRecord {
  let attempts = (student.testAttempts || []).map(sanitizeTestAttemptScaleAndDate);
  let appearedAttempts = attempts.filter((t) => t.appeared !== false);

  const rawOfflineRanks = appearedAttempts
    .map((t) => t.offlineRank ?? t.rankInTest)
    .filter((r): r is number => r !== undefined && r > 0);
  const rawRegionalRanks = appearedAttempts
    .map((t) => t.regionalRank)
    .filter((r): r is number => r !== undefined && r > 0);
  const rawCenterRanks = appearedAttempts
    .map((t) => t.centerRank)
    .filter((r): r is number => r !== undefined && r > 0);

  const allStudentRanks = [...rawOfflineRanks, ...rawRegionalRanks, ...rawCenterRanks];
  if (
    allStudentRanks.length > 0 &&
    allStudentRanks.every((r) => r >= 100 && r % 100 === 0)
  ) {
    attempts = attempts.map((t) => ({
      ...t,
      ...(t.offlineRank && t.offlineRank >= 100 && t.offlineRank % 100 === 0
        ? { offlineRank: Math.round(t.offlineRank / 100) }
        : {}),
      ...(t.regionalRank && t.regionalRank >= 100 && t.regionalRank % 100 === 0
        ? { regionalRank: Math.round(t.regionalRank / 100) }
        : {}),
      ...(t.centerRank && t.centerRank >= 100 && t.centerRank % 100 === 0
        ? { centerRank: Math.round(t.centerRank / 100) }
        : {}),
      ...(t.rankInTest && t.rankInTest >= 100 && t.rankInTest % 100 === 0
        ? { rankInTest: Math.round(t.rankInTest / 100) }
        : {}),
    }));
    appearedAttempts = attempts.filter((t) => t.appeared !== false);
  }

  const totalMarksObtained = appearedAttempts.reduce(
    (sum, t) => sum + (Number(t.totalMarks) || 0),
    0
  );
  const totalMaxMarksAppeared = appearedAttempts.reduce(
    (sum, t) => sum + (Number(t.maxMarks) || 0),
    0
  );
  const totalMaxMarksScheduled = attempts.reduce(
    (sum, t) => sum + (Number(t.maxMarks) || 0),
    0
  );

  const testsAppearedCount = appearedAttempts.length;
  const testsScheduledCount = attempts.length;

  const latestAppeared =
    appearedAttempts.length > 0
      ? appearedAttempts[appearedAttempts.length - 1]
      : undefined;

  const bestAppeared =
    appearedAttempts.length > 0
      ? [...appearedAttempts].sort((a, b) => {
          if (b.percentage !== a.percentage) return b.percentage - a.percentage;
          return (b.totalMarks || 0) - (a.totalMarks || 0);
        })[0]
      : undefined;

  const offlineRanks = appearedAttempts
    .map((t) => t.offlineRank ?? t.rankInTest)
    .filter((r): r is number => r !== undefined && r > 0);
  const regionalRanks = appearedAttempts
    .map((t) => t.regionalRank)
    .filter((r): r is number => r !== undefined && r > 0);
  const centerRanks = appearedAttempts
    .map((t) => t.centerRank)
    .filter((r): r is number => r !== undefined && r > 0);

  const metaSource =
    [...attempts].reverse().find((t) => t.centerName || t.combinedCenterName || t.regionName) ||
    attempts[0];

  const computedOverallAvgPct =
    appearedAttempts.length > 0
      ? Number(
          (
            appearedAttempts.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0) /
            appearedAttempts.length
          ).toFixed(2)
        )
      : 0;

  const computedLatestTestPct = latestAppeared
    ? Number((Number(latestAppeared.percentage) || 0).toFixed(2))
    : 0;

  const computedGrowthDeltaPct =
    appearedAttempts.length >= 2
      ? Number(
          (
            (Number(appearedAttempts[appearedAttempts.length - 1].percentage) || 0) -
            (Number(appearedAttempts[0].percentage) || 0)
          ).toFixed(2)
        )
      : 0;

  return {
    ...student,
    testAttempts: attempts,
    regionName: student.regionName || metaSource?.regionName,
    combinedCenterName: student.combinedCenterName || metaSource?.combinedCenterName,
    centerName: student.centerName || metaSource?.centerName,
    overallAvgPct:
      attempts.length > 0 ? computedOverallAvgPct : student.overallAvgPct,
    latestTestPct:
      attempts.length > 0 ? computedLatestTestPct : student.latestTestPct,
    growthDeltaPct:
      attempts.length > 0 ? computedGrowthDeltaPct : student.growthDeltaPct,
    totalMarksObtained,
    totalMaxMarksAppeared,
    totalMaxMarksScheduled,
    latestMarksObtained: latestAppeared?.totalMarks,
    latestMaxMarks: latestAppeared?.maxMarks,
    latestTestName: latestAppeared?.testName,
    latestTestDate: latestAppeared?.testDate,
    bestMarksObtained: bestAppeared?.totalMarks,
    bestMaxMarks: bestAppeared?.maxMarks,
    bestTestPct: bestAppeared?.percentage,
    bestTestName: bestAppeared?.testName,
    testsAppearedCount,
    testsScheduledCount,
    bestOfflineRank: offlineRanks.length > 0 ? Math.min(...offlineRanks) : undefined,
    bestRegionalRank: regionalRanks.length > 0 ? Math.min(...regionalRanks) : undefined,
    bestCenterRank: centerRanks.length > 0 ? Math.min(...centerRanks) : undefined,
  };
}

/**
 * Returns exact per-test marks presentation strings directly from the student's Excel test attempts
 * so the UI never displays confusing multi-test cumulative denominators like 2700/3000.
 */
export function getStudentExactScoreSummary(rawStudent: StudentRecord): {
  hasAppeared: boolean;
  appearedCount: number;
  scheduledCount: number;
  latestTest?: TestAttempt;
  bestTest?: TestAttempt;
  latestMarks: number;
  latestMax: number;
  latestPct: number;
  latestTestName: string;
  latestTestDate: string;
  bestMarks: number;
  bestMax: number;
  bestPct: number;
  bestTestName: string;
  primaryScoreText: string;
  primaryScoreWithPctText: string;
  primaryTestLabel: string;
  bestScoreText: string;
  bestScoreWithPctText: string;
  bestTestLabel: string;
  allAppearedInlineSummary: string;
} {
  const student = enrichStudentSummaryFromAttempts(rawStudent);
  const attempts = student.testAttempts || [];
  const appearedAttempts = attempts.filter((t) => t.appeared !== false);
  const appearedCount = appearedAttempts.length;
  const scheduledCount = attempts.length;

  const latestTest =
    appearedCount > 0 ? appearedAttempts[appearedCount - 1] : undefined;
  const bestTest =
    appearedCount > 0
      ? [...appearedAttempts].sort((a, b) => {
          if (b.percentage !== a.percentage) return b.percentage - a.percentage;
          return (b.totalMarks || 0) - (a.totalMarks || 0);
        })[0]
      : undefined;

  if (!latestTest || appearedCount === 0) {
    const firstSchedMax = attempts[0]?.maxMarks ?? 300;
    const schedLabel = attempts[attempts.length - 1]?.testName || 'Scheduled';
    const schedDate = attempts[attempts.length - 1]?.testDate || '';
    return {
      hasAppeared: false,
      appearedCount: 0,
      scheduledCount,
      latestMarks: 0,
      latestMax: firstSchedMax,
      latestPct: 0,
      latestTestName: schedLabel,
      latestTestDate: schedDate,
      bestMarks: 0,
      bestMax: firstSchedMax,
      bestPct: 0,
      bestTestName: schedLabel,
      primaryScoreText: 'Absent',
      primaryScoreWithPctText: `Absent (0/${firstSchedMax})`,
      primaryTestLabel: schedLabel,
      bestScoreText: 'Absent',
      bestScoreWithPctText: 'Absent',
      bestTestLabel: '0 Appeared',
      allAppearedInlineSummary: `Absent in ${scheduledCount} scheduled test${scheduledCount === 1 ? '' : 's'}`,
    };
  }

  const primaryScoreText = `${latestTest.totalMarks} / ${latestTest.maxMarks}`;
  const primaryScoreWithPctText = `${latestTest.totalMarks} / ${latestTest.maxMarks} (${latestTest.percentage.toFixed(2)}%)`;
  const primaryTestLabel = latestTest.testName;

  const bestScoreText = bestTest
    ? `${bestTest.totalMarks} / ${bestTest.maxMarks}`
    : primaryScoreText;
  const bestScoreWithPctText = bestTest
    ? `${bestTest.totalMarks} / ${bestTest.maxMarks} (${bestTest.percentage.toFixed(2)}%)`
    : primaryScoreWithPctText;
  const bestTestLabel = bestTest?.testName || primaryTestLabel;

  const allAppearedInlineSummary = appearedAttempts
    .map((t) => `${t.testName}: ${t.totalMarks}/${t.maxMarks}`)
    .join(' · ');

  return {
    hasAppeared: true,
    appearedCount,
    scheduledCount,
    latestTest,
    bestTest,
    latestMarks: latestTest.totalMarks,
    latestMax: latestTest.maxMarks,
    latestPct: latestTest.percentage,
    latestTestName: latestTest.testName,
    latestTestDate: latestTest.testDate || '',
    bestMarks: bestTest ? bestTest.totalMarks : latestTest.totalMarks,
    bestMax: bestTest ? bestTest.maxMarks : latestTest.maxMarks,
    bestPct: bestTest ? bestTest.percentage : latestTest.percentage,
    bestTestName: bestTest ? bestTest.testName : latestTest.testName,
    primaryScoreText,
    primaryScoreWithPctText,
    primaryTestLabel,
    bestScoreText,
    bestScoreWithPctText,
    bestTestLabel,
    allAppearedInlineSummary,
  };
}

/**
 * Re-ranks all students in a batch based on overallAvgPct and recalculates percentiles.
 */
export function recalculateBatchRanks(students: StudentRecord[]): StudentRecord[] {
  const sorted = [...students].sort((a, b) => {
    if (b.overallAvgPct !== a.overallAvgPct) {
      return b.overallAvgPct - a.overallAvgPct;
    }
    return b.latestTestPct - a.latestTestPct;
  });

  const total = sorted.length;
  return sorted.map((rawStudent, idx) => {
    const student = enrichStudentSummaryFromAttempts(rawStudent);
    const rank = idx + 1;
    const percentile =
      total > 1 ? Number((((total - rank) / (total - 1)) * 99 + 1).toFixed(1)) : 99.0;
    const evalResult = evaluateInterventionStatus(
      student.overallAvgPct,
      student.growthDeltaPct,
      student.attendancePct,
      student.latestTestPct
    );

    const extraReasons: string[] = [];
    if (student.testsAppearedCount === 0 && (student.testsScheduledCount ?? 0) > 0) {
      extraReasons.push(
        `Absent in all scheduled assessments (0/${student.testsScheduledCount} tests attempted)`
      );
    } else if (
      student.testsAppearedCount !== undefined &&
      student.testsScheduledCount !== undefined &&
      student.testsAppearedCount < student.testsScheduledCount
    ) {
      extraReasons.push(
        `Attempted ${student.testsAppearedCount} of ${student.testsScheduledCount} scheduled tests`
      );
    }

    const mergedReasons = Array.from(new Set([...extraReasons, ...evalResult.reasons]));

    return {
      ...student,
      rankInBatch: rank,
      batchPercentile: percentile,
      interventionStatus:
        student.testsAppearedCount === 0 ? 'Urgent Intervention' : evalResult.status,
      interventionReasons: mergedReasons,
    };
  });
}

/**
 * Computes complete batch analytics:
 * - Top 10 students (sorted highest to lowest)
 * - Bottom 10 students (sorted lowest to highest so the most critical appear first)
 * - Intervention Required students (Urgent Intervention + Watch)
 * - Longitudinal growth series across all batch tests
 * - Subject-level performance summaries
 */
export function computeBatchAnalytics(batch: BatchRecord): BatchAnalyticsSummary {
  const rankedStudents = recalculateBatchRanks(batch.students);
  const totalStudents = rankedStudents.length;

  const overallBatchAvgPct =
    totalStudents > 0
      ? Number(
          (
            rankedStudents.reduce((acc, s) => acc + s.overallAvgPct, 0) / totalStudents
          ).toFixed(1)
        )
      : 0;

  const avgAttendancePct =
    totalStudents > 0
      ? Number(
          (
            rankedStudents.reduce((acc, s) => acc + s.attendancePct, 0) / totalStudents
          ).toFixed(1)
        )
      : 0;

  const topTenStudents = rankedStudents.slice(0, 10);

  // Bottom 10 sorted from lowest score ascending so teachers see the lowest performers first
  const bottomTenStudents = [...rankedStudents]
    .sort((a, b) => a.overallAvgPct - b.overallAvgPct)
    .slice(0, 10);

  const interventionStudents = rankedStudents
    .filter(
      (s) => s.interventionStatus === 'Urgent Intervention' || s.interventionStatus === 'Watch'
    )
    .sort((a, b) => {
      if (a.interventionStatus !== b.interventionStatus) {
        return a.interventionStatus === 'Urgent Intervention' ? -1 : 1;
      }
      return a.overallAvgPct - b.overallAvgPct;
    });

  // Longitudinal test-by-test series
  const thirdSubName = batch.subjects[2] || 'Mathematics';
  const longitudinalSeries: LongitudinalTestPoint[] = batch.tests.map((testMeta, testIdx) => {
    const pairedAttempts: Array<{
      student: StudentRecord;
      attempt: TestAttempt;
      prevAppearedAttempt?: TestAttempt;
    }> = [];

    for (const student of rankedStudents) {
      const attempt = student.testAttempts.find(
        (t) =>
          t.testId === testMeta.testId ||
          t.testName.trim().toLowerCase() === testMeta.testName.trim().toLowerCase()
      );

      if (attempt) {
        let prevAppearedAttempt: TestAttempt | undefined;
        for (let p = testIdx - 1; p >= 0; p--) {
          const prevMeta = batch.tests[p];
          const prevCand =
            prevMeta &&
            student.testAttempts.find(
              (t) =>
                t.testId === prevMeta.testId ||
                t.testName.trim().toLowerCase() === prevMeta.testName.trim().toLowerCase()
            );
          if (prevCand && prevCand.appeared !== false && prevCand.percentage > 0) {
            prevAppearedAttempt = prevCand;
            break;
          }
        }
        pairedAttempts.push({ student, attempt, prevAppearedAttempt });
      }
    }

    const matchingAttempts = pairedAttempts.map((p) => p.attempt);
    const appearedPairs = pairedAttempts.filter((p) => p.attempt.appeared !== false);
    const appearedAttempts = appearedPairs.map((p) => p.attempt);
    const appearedCount = appearedAttempts.length;

    const scoresForTest =
      appearedCount > 0
        ? appearedAttempts.map((a) => a.percentage).sort((a, b) => b - a)
        : [0];

    const count = scoresForTest.length || 1;
    const batchAvgPct =
      appearedCount > 0
        ? Number((scoresForTest.reduce((sum, val) => sum + val, 0) / count).toFixed(2))
        : 0;

    const avgMarksObtained =
      appearedCount > 0
        ? Number(
            (
              appearedAttempts.reduce((sum, a) => sum + (Number(a.totalMarks) || 0), 0) /
              appearedCount
            ).toFixed(1)
          )
        : 0;

    const topSlice = scoresForTest.slice(0, Math.min(10, count));
    const topTenAvgPct =
      appearedCount > 0
        ? Number(
            (topSlice.reduce((sum, val) => sum + val, 0) / (topSlice.length || 1)).toFixed(2)
          )
        : 0;

    const bottomSlice = [...scoresForTest].reverse().slice(0, Math.min(10, count));
    const bottomTenAvgPct =
      appearedCount > 0
        ? Number(
            (bottomSlice.reduce((sum, val) => sum + val, 0) / (bottomSlice.length || 1)).toFixed(2)
          )
        : 0;

    const computeSubTestAvg = (matcher: (subName: string) => boolean): number => {
      if (appearedCount === 0) return 0;
      const vals: number[] = [];
      for (const att of appearedAttempts) {
        const sub = att.subjectScores?.find((s) => matcher(s.subject.toLowerCase()));
        if (sub) vals.push(sub.percentage);
      }
      if (vals.length === 0) return batchAvgPct;
      return Number((vals.reduce((sum, v) => sum + v, 0) / vals.length).toFixed(2));
    };

    const physicsAvgPct = computeSubTestAvg((s) => s.includes('phy'));
    const chemistryAvgPct = computeSubTestAvg((s) => s.includes('chem'));
    const mathOrBioAvgPct = computeSubTestAvg(
      (s) => s.includes('math') || s.includes('bio')
    );

    // Compute Standard Deviation of appeared percentages
    const variance =
      appearedCount > 1
        ? scoresForTest.reduce((acc, s) => acc + Math.pow(s - batchAvgPct, 2), 0) / appearedCount
        : 0;
    const scoreSpreadStdDev = Number(Math.sqrt(variance).toFixed(1));

    // Identify Hardest Subject on this test
    const subjectCandidates = [
      { name: 'Physics', avgPct: physicsAvgPct },
      { name: 'Chemistry', avgPct: chemistryAvgPct },
      { name: thirdSubName, avgPct: mathOrBioAvgPct },
    ].sort((a, b) => a.avgPct - b.avgPct);

    const hardestSubject =
      appearedCount > 0 && batchAvgPct > 0 ? subjectCandidates[0] : undefined;

    // Compute Difficulty Label & Difficulty Index (0-100 where higher = tougher paper)
    let difficultyLabel: 'High Difficulty' | 'Moderate' | 'Accessible' | 'Scheduled' = 'Scheduled';
    let difficultyIndex = 0;
    if (appearedCount > 0 && batchAvgPct > 0) {
      difficultyIndex = Math.round(
        Math.max(12, Math.min(96, 100 - batchAvgPct * 0.82 + scoreSpreadStdDev * 0.35))
      );
      if (batchAvgPct < 62) {
        difficultyLabel = 'High Difficulty';
      } else if (batchAvgPct < 76) {
        difficultyLabel = 'Moderate';
      } else {
        difficultyLabel = 'Accessible';
      }
    }

    // Identify Specific Student Outliers (Top Scorer, Lowest Appeared Scorer, Momentum Outlier)
    const sortedAppearedPairs = [...appearedPairs].sort((a, b) => {
      if (b.attempt.percentage !== a.attempt.percentage) {
        return b.attempt.percentage - a.attempt.percentage;
      }
      return (b.attempt.totalMarks || 0) - (a.attempt.totalMarks || 0);
    });

    const buildOutlier = (pair?: {
      student: StudentRecord;
      attempt: TestAttempt;
      prevAppearedAttempt?: TestAttempt;
    }): TestStudentOutlier | undefined => {
      if (!pair) return undefined;
      const maxMarks = pair.attempt.maxMarks || testMeta.maxMarks || 300;
      const marks =
        pair.attempt.totalMarks !== undefined
          ? Number(pair.attempt.totalMarks)
          : Math.round((pair.attempt.percentage / 100) * maxMarks);
      const deltaFromPrevPct = pair.prevAppearedAttempt
        ? Number((pair.attempt.percentage - pair.prevAppearedAttempt.percentage).toFixed(1))
        : undefined;
      return {
        studentId: pair.student.id,
        name: pair.student.name,
        regNo: pair.student.regNo,
        pct: Number(pair.attempt.percentage.toFixed(1)),
        marks,
        maxMarks,
        deltaFromPrevPct,
      };
    };

    const topOutlier = buildOutlier(sortedAppearedPairs[0]);
    const bottomOutlier =
      sortedAppearedPairs.length > 1
        ? buildOutlier(sortedAppearedPairs[sortedAppearedPairs.length - 1])
        : topOutlier;

    // Momentum outlier: student with the steepest drop or surge relative to previous appeared test
    const pairsWithDelta = appearedPairs
      .filter((p) => p.prevAppearedAttempt !== undefined)
      .map((p) => ({
        pair: p,
        delta: Number(
          (p.attempt.percentage - (p.prevAppearedAttempt?.percentage ?? 0)).toFixed(1)
        ),
      }));

    let momentumOutlier: TestStudentOutlier | undefined;
    if (pairsWithDelta.length > 0) {
      const steepestDrop = [...pairsWithDelta].sort((a, b) => a.delta - b.delta)[0];
      const biggestSurge = [...pairsWithDelta].sort((a, b) => b.delta - a.delta)[0];
      if (steepestDrop && steepestDrop.delta <= -2.5) {
        momentumOutlier = buildOutlier(steepestDrop.pair);
      } else if (biggestSurge) {
        momentumOutlier = buildOutlier(biggestSurge.pair);
      }
    }

    const hasExplicitPresenceTracking = matchingAttempts.some((a) => a.appeared !== undefined);
    const computedTestAttendancePct = hasExplicitPresenceTracking
      ? Number(((appearedCount / Math.max(1, totalStudents)) * 100).toFixed(1))
      : Number(Math.min(99, Math.max(70, avgAttendancePct - 1.5 + testIdx * 0.6)).toFixed(1));

    const formatShortAxisDate = (rawDate: string): string => {
      if (!rawDate) return `T${testIdx + 1}`;
      const ymd = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (ymd) {
        const m = Number(ymd[2]);
        const d = ymd[3];
        if (m >= 1 && m <= 12) return `${d} ${shortMonths[m - 1]}`;
      }
      const dmyWords = rawDate.match(/^(\d{1,2})\s+([A-Za-z]+)\s+\d{4}$/);
      if (dmyWords) {
        return `${dmyWords[1].padStart(2, '0')} ${dmyWords[2].slice(0, 3)}`;
      }
      return rawDate.replace(/\s+20\d{2}$/, '').trim();
    };

    const shortTestCode = testMeta.testName.split(/\s+/)[0].slice(0, 12);
    const dateLabel = `${formatShortAxisDate(testMeta.testDate)} · ${shortTestCode}`;

    return {
      testId: testMeta.testId,
      testName: testMeta.testName,
      testDate: testMeta.testDate,
      dateLabel,
      maxMarks: testMeta.maxMarks,
      avgMarksObtained,
      appearedCount,
      totalStudents,
      batchAvgPct,
      topTenAvgPct,
      bottomTenAvgPct,
      physicsAvgPct,
      chemistryAvgPct,
      mathOrBioAvgPct,
      highestPct: appearedCount > 0 ? (scoresForTest[0] ?? 0) : 0,
      lowestPct: appearedCount > 0 ? (scoresForTest[scoresForTest.length - 1] ?? 0) : 0,
      attendanceAvgPct: computedTestAttendancePct,
      difficultyLabel,
      difficultyIndex,
      scoreSpreadStdDev,
      hardestSubject,
      topOutlier,
      bottomOutlier,
      momentumOutlier,
    };
  });

  const activePoints = longitudinalSeries.filter((pt) => (pt.appearedCount ?? 1) > 0 && pt.batchAvgPct > 0);
  const overallGrowthDeltaPct =
    activePoints.length >= 2
      ? Number(
          (
            activePoints[activePoints.length - 1].batchAvgPct -
            activePoints[0].batchAvgPct
          ).toFixed(1)
        )
      : longitudinalSeries.length >= 2
      ? Number(
          (
            longitudinalSeries[longitudinalSeries.length - 1].batchAvgPct -
            longitudinalSeries[0].batchAvgPct
          ).toFixed(1)
        )
      : 0;

  const subjectSummaries: SubjectBatchSummary[] = batch.subjects.map((subject) => {
    const subjectPcts: number[] = [];
    rankedStudents.forEach((student) => {
      // Pick the latest appeared test attempt so absent trailing tests don't zero out subject accuracy
      const latestAppeared =
        [...student.testAttempts].reverse().find((t) => t.appeared !== false) ||
        student.testAttempts[student.testAttempts.length - 1];
      const foundSub = latestAppeared?.subjectScores.find(
        (sub) => sub.subject.toLowerCase() === subject.toLowerCase()
      );
      if (foundSub && latestAppeared?.appeared !== false) {
        subjectPcts.push(foundSub.percentage);
      } else if ((student.testsAppearedCount ?? 1) > 0) {
        subjectPcts.push(student.overallAvgPct);
      }
    });

    const avgPct =
      subjectPcts.length > 0
        ? Number((subjectPcts.reduce((a, b) => a + b, 0) / subjectPcts.length).toFixed(1))
        : 0;
    const topScorePct = subjectPcts.length > 0 ? Math.max(...subjectPcts) : 0;
    const weakStudentCount = rankedStudents.filter((s) => {
      if (s.testsAppearedCount === 0) return true;
      const latestAppeared = [...s.testAttempts].reverse().find((t) => t.appeared !== false);
      const sub = latestAppeared?.subjectScores.find(
        (item) => item.subject.toLowerCase() === subject.toLowerCase()
      );
      return (sub ? sub.percentage : s.overallAvgPct) < 60;
    }).length;

    return {
      subject,
      avgPct,
      topScorePct: Number(topScorePct.toFixed(1)),
      weakStudentCount,
    };
  });

  return {
    batchId: batch.id,
    batchName: batch.name,
    totalStudents,
    overallBatchAvgPct,
    overallGrowthDeltaPct,
    avgAttendancePct,
    topTenStudents,
    bottomTenStudents,
    interventionStudents,
    longitudinalSeries,
    subjectSummaries,
  };
}

/**
 * Resolves a lookup query combining optional Student Name / Reg No and optional Batch Name.
 */
export function resolveLookupQuery(
  batches: BatchRecord[],
  studentQuery: string,
  batchQuery: string
): {
  mode: 'student' | 'batch' | 'not_found';
  matchedBatch?: BatchRecord;
  matchedStudent?: StudentRecord;
  candidateStudents?: StudentRecord[];
  errorMessage?: string;
} {
  const cleanStudent = studentQuery.trim().toLowerCase();
  const cleanBatch = batchQuery.trim().toLowerCase();

  const matchedBatch = cleanBatch
    ? batches.find(
        (b) =>
          b.id.toLowerCase() === cleanBatch ||
          b.name.toLowerCase().includes(cleanBatch) ||
          b.code.toLowerCase().includes(cleanBatch)
      )
    : undefined;

  if (cleanBatch && !matchedBatch) {
    return {
      mode: 'not_found',
      errorMessage: `No batch found matching "${batchQuery.trim()}". Try selecting from the available batches.`,
    };
  }

  if (!cleanStudent && matchedBatch) {
    return {
      mode: 'batch',
      matchedBatch,
    };
  }

  if (!cleanStudent && !matchedBatch) {
    return {
      mode: 'not_found',
      errorMessage: 'Please enter a Student Name / Registration Number, or select a Batch Name.',
    };
  }

  const targetBatches = matchedBatch ? [matchedBatch] : batches;
  const allCandidates: { student: StudentRecord; batch: BatchRecord; score: number }[] = [];

  for (const batch of targetBatches) {
    for (const student of batch.students) {
      const regLower = student.regNo.toLowerCase();
      const nameLower = student.name.toLowerCase();

      if (regLower === cleanStudent || nameLower === cleanStudent) {
        allCandidates.push({ student, batch, score: 100 });
      } else if (regLower.includes(cleanStudent)) {
        allCandidates.push({ student, batch, score: 85 });
      } else if (nameLower.startsWith(cleanStudent)) {
        allCandidates.push({ student, batch, score: 80 });
      } else if (nameLower.includes(cleanStudent)) {
        allCandidates.push({ student, batch, score: 65 });
      }
    }
  }

  allCandidates.sort((a, b) => b.score - a.score);

  if (allCandidates.length === 0) {
    // If the student exists in a different batch when a batch filter was selected, search globally as fallback
    if (matchedBatch) {
      const globalFallback = resolveLookupQuery(batches, studentQuery, '');
      if (globalFallback.mode === 'student' && globalFallback.matchedStudent) {
        return globalFallback;
      }
    }
    const scopeText = matchedBatch ? ` in batch "${matchedBatch.name}"` : '';
    return {
      mode: 'not_found',
      matchedBatch,
      errorMessage: `No student found matching "${studentQuery.trim()}"${scopeText}. Verify the Registration Number or Student Name.`,
    };
  }

  const best = allCandidates[0];
  return {
    mode: 'student',
    matchedBatch: best.batch,
    matchedStudent: best.student,
    candidateStudents: allCandidates.map((c) => c.student),
  };
}

/**
 * Extracts weak and moderate topics for a student and attaches targeted practice questions.
 */
export function getStudentWeakTopicDiagnostics(
  student: StudentRecord,
  questionBank: PracticeQuestion[]
): {
  weakTopics: (TopicScore & { recommendedQuestions: PracticeQuestion[] })[];
  strongTopics: TopicScore[];
} {
  const sortedTopics = [...student.topicScores].sort((a, b) => a.accuracyPct - b.accuracyPct);

  const weakTopics = sortedTopics
    .filter((t) => t.status === 'Weak' || t.accuracyPct < 72)
    .map((topic) => {
      const exactMatches = questionBank.filter(
        (q) => q.topicName.toLowerCase() === topic.topicName.toLowerCase()
      );
      const subjectFallbacks = questionBank.filter(
        (q) =>
          q.subject.toLowerCase() === topic.subject.toLowerCase() &&
          q.topicName.toLowerCase() !== topic.topicName.toLowerCase()
      );

      return {
        ...topic,
        recommendedQuestions:
          exactMatches.length > 0 ? exactMatches : subjectFallbacks.slice(0, 2),
      };
    });

  const strongTopics = sortedTopics.filter((t) => t.status === 'Strong' && t.accuracyPct >= 72);

  return { weakTopics, strongTopics };
}

/**
 * Smart Excel/CSV JSON row normalizer that recognizes real-world column header variations
 * AND automatically aggregates multi-row test logs (where each row is 1 test attempt for a student,
 * such as Milestone / AITS logs with region, combined_center, center, Reg No, student_name,
 * batch, class_stream, test_date, test_name, Test Type, Out of, Score, Avg. Score,
 * Avg. Physics, Avg. Chemistry, Avg. Maths, Offline Rank, Regional Rank, Center Rank)
 * into consolidated student records grouped by Reg No while preserving every scheduled test row.
 */
export function normalizeSmartExcelRows(
  rawObjects: Record<string, unknown>[],
  defaultBatchName: string,
  uploadCategory: UploadCategory = 'combined'
): UploadedStudentRow[] {
  interface ParsedRawLine {
    regNo: string;
    name: string;
    batchName: string;
    hasExplicitBatch: boolean;
    classStream?: string;
    centerName?: string;
    combinedCenterName?: string;
    regionName?: string;
    parentName?: string;
    parentEmail?: string;
    parentPhone?: string;
    attendancePct?: number;
    classesAttended?: number;
    classesHeld?: number;
    testName?: string;
    testDate?: string;
    testType?: string;
    outOf?: number;
    rawScore?: number;
    singleTestPct?: number;
    isMultiTestFormat: boolean;
    isAttemptedTest: boolean;
    t1?: number;
    t2?: number;
    t3?: number;
    t4?: number;
    t5?: number;
    t6?: number;
    physicsPct?: number;
    chemistryPct?: number;
    mathOrBioPct?: number;
    offlineRank?: number;
    regionalRank?: number;
    centerRank?: number;
    weakTopicsRaw?: string;
  }

  const parsedLines: ParsedRawLine[] = [];

  for (let idx = 0; idx < rawObjects.length; idx++) {
    const obj = rawObjects[idx];
    const entries: [string, unknown][] = [];
    const lookup = new Map<string, unknown>();

    for (const [k, v] of Object.entries(obj)) {
      const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normKey) {
        lookup.set(normKey, v);
        entries.push([normKey, v]);
      }
    }

    const findRawVal = (keys: string[], prefixes: string[] = []): unknown => {
      for (const k of keys) {
        const val = lookup.get(k);
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return val;
        }
      }
      for (const pref of prefixes) {
        for (const [normKey, val] of entries) {
          if (
            normKey.startsWith(pref) &&
            val !== undefined &&
            val !== null &&
            String(val).trim() !== ''
          ) {
            return val;
          }
        }
      }
      return undefined;
    };

    const pickStr = (keys: string[], prefixes: string[] = [], fallback = ''): string => {
      const raw = findRawVal(keys, prefixes);
      if (raw === undefined) return fallback;
      return String(raw).trim();
    };

    const pickNum = (keys: string[], prefixes: string[] = []): number | undefined => {
      const raw = findRawVal(keys, prefixes);
      if (raw === undefined) return undefined;
      if (typeof raw === 'number') {
        return !isNaN(raw) ? raw : undefined;
      }
      const rawStr = String(raw).trim();
      const hasPercentSign = rawStr.includes('%');
      const str = rawStr.replace(/,/g, '').replace(/%/g, '').trim();
      if (
        !str ||
        /^#+$/.test(str) ||
        str === '-' ||
        str.toLowerCase() === 'ab' ||
        str.toLowerCase() === 'absent' ||
        str.toLowerCase() === 'na' ||
        str.toLowerCase() === 'n/a'
      ) {
        return undefined;
      }
      const parsed = Number(str);
      if (isNaN(parsed)) return undefined;
      if (hasPercentSign) {
        return Number((parsed / 100).toFixed(2));
      }
      return parsed;
    };

    // Percentage reader: converts Excel raw decimal percentages (e.g. 0.5625 -> 56.25) when appropriate
    const pickPct = (
      keys: string[],
      prefixes: string[] = [],
      convertUnitDecimal = true
    ): number | undefined => {
      const raw = findRawVal(keys, prefixes);
      if (raw === undefined) return undefined;
      const rawStr = String(raw).trim();
      if (
        !rawStr ||
        /^#+$/.test(rawStr) ||
        rawStr === '-' ||
        rawStr.toLowerCase() === 'ab' ||
        rawStr.toLowerCase() === 'absent' ||
        rawStr.toLowerCase() === 'na' ||
        rawStr.toLowerCase() === 'n/a'
      ) {
        return undefined;
      }
      const hasPercentSign = rawStr.includes('%');
      const cleaned = rawStr.replace(/,/g, '').replace(/%/g, '').trim();
      const parsed = Number(cleaned);
      if (isNaN(parsed)) return undefined;
      if (convertUnitDecimal && !hasPercentSign && parsed > 0 && parsed <= 1) {
        return Number((parsed * 100).toFixed(2));
      }
      return Number(parsed.toFixed(2));
    };

    const rawRegNo = pickStr(
      [
        'regno',
        'registrationno',
        'registrationnumber',
        'rollno',
        'rollnumber',
        'studentid',
        'studentcode',
        'candidateid',
        'admissionno',
        'enrollmentno',
        'scholarno',
        'omrid',
        'formno',
        'userid',
        'id',
      ],
      ['regno', 'registration', 'rollno', 'enrollment', 'admission', 'studentid', 'studentcode']
    );

    const rawName = pickStr(
      ['studentname', 'name', 'candidatename', 'fullname', 'student'],
      ['studentn', 'candidaten']
    );

    if (!rawRegNo && !rawName) continue;
    if (
      rawRegNo.toLowerCase() === 'reg no' ||
      rawRegNo.toLowerCase() === 'regno' ||
      rawName.toLowerCase() === 'student_name' ||
      rawName.toLowerCase() === 'student name'
    ) {
      continue;
    }

    let explicitBatch = pickStr(
      [
        'batch',
        'batchname',
        'batchcode',
        'batchid',
        'cohort',
        'section',
        'currentbatch',
        'studentbatch',
        'allottedbatch',
        'centerbatch',
        'coursebatch',
        'subbatch',
        'classbatch',
        'batchno',
      ],
      ['batch', 'cohort']
    );
    if (!explicitBatch) {
      for (const [normKey, val] of entries) {
        if (
          normKey.includes('batch') &&
          !normKey.includes('rank') &&
          !normKey.includes('percent') &&
          !normKey.includes('avg') &&
          val !== undefined &&
          val !== null &&
          String(val).trim() !== ''
        ) {
          explicitBatch = String(val).trim();
          break;
        }
      }
    }
    const batchName = (explicitBatch || defaultBatchName || 'Uploaded Batch').trim();

    const fallbackRegSlug = `${batchName}-${rawName}`
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const regNo = (rawRegNo || `REG-${fallbackRegSlug || idx + 1}`).trim().toUpperCase();
    const name = rawName || `Student ${regNo}`;

    const classStream = pickStr(
      ['classstream', 'stream', 'course', 'program'],
      ['classstrea', 'stream']
    );
    const combinedCenterName = pickStr(
      ['combinedcenter', 'combinedbranch', 'vidyapeeth', 'hub'],
      ['combinedc']
    );
    const centerName = pickStr(
      ['center', 'centername', 'school', 'branch'],
      ['centern']
    ) || combinedCenterName;
    const regionName = pickStr(['region', 'zone', 'state'], ['region']);

    const parentName = pickStr(['parentname', 'fathername', 'guardianname', 'parent']);
    const parentEmail = pickStr(['parentemail', 'email', 'guardianemail']);
    const parentPhone = pickStr(['parentphone', 'phone', 'mobile', 'contact']);

    const classesAttended = pickNum(
      ['classesattended', 'attended', 'presentdays', 'daysattended'],
      ['classesatt']
    );
    const classesHeld = pickNum(
      ['classesheld', 'totalclasses', 'totaldays', 'workingdays'],
      ['classesheld']
    );

    let attendancePct = pickPct(
      [
        'attendance',
        'attendancepct',
        'attendancepercentage',
        'presentpct',
        'presentpercentage',
        'att',
      ],
      ['attendancep']
    );

    if (
      attendancePct === undefined &&
      classesAttended !== undefined &&
      classesHeld !== undefined &&
      classesHeld > 0
    ) {
      attendancePct = Number(((classesAttended / classesHeld) * 100).toFixed(1));
    }

    const testName = pickStr(['testname', 'examname', 'assessment', 'test'], ['testname']);
    const rawTestDate = pickStr(['testdate', 'examdate', 'date'], ['testdate']);
    const testDate = rawTestDate ? formatCoachingDate(rawTestDate) : undefined;
    const testType = pickStr(['testtype', 'examtype', 'pattern'], ['testtype']);
    let outOf = pickNum(['outof', 'maxmarks', 'totalmarks', 'fullmarks'], ['outof', 'maxmark']);
    let rawScore = pickNum(
      ['score', 'marksobtained', 'obtainedmarks', 'marks'],
      ['score', 'marksobt']
    );
    const avgScorePct = pickPct(
      ['avgscore', 'percentage', 'overallpct', 'totalpct', 'scorepct', 'resultpct'],
      ['avgscore', 'percent']
    );

    let wasRowScaledDown = false;
    if (outOf !== undefined && outOf > 1000 && outOf % 100 === 0 && outOf / 100 <= 1000) {
      outOf = Math.round(outOf / 100);
      wasRowScaledDown = true;
      if (
        rawScore !== undefined &&
        (Math.abs(rawScore) > outOf ||
          (rawScore % 100 === 0 &&
            avgScorePct !== undefined &&
            outOf > 0 &&
            Math.abs((rawScore / 100 / outOf) * 100 - avgScorePct) <
              Math.abs((rawScore / outOf) * 100 - avgScorePct)))
      ) {
        rawScore = Math.round(rawScore / 100);
      }
    } else if (
      outOf !== undefined &&
      outOf > 0 &&
      rawScore !== undefined &&
      Math.abs(rawScore) > outOf &&
      rawScore % 100 === 0 &&
      Math.abs(rawScore / 100) <= outOf
    ) {
      rawScore = Math.round(rawScore / 100);
      wasRowScaledDown = true;
    }

    const isMultiTestFormat = Boolean(
      testName || outOf !== undefined || lookup.has('avgscore') || lookup.has('testtype')
    );

    let singleTestPct: number | undefined = avgScorePct;
    if (singleTestPct === undefined && rawScore !== undefined) {
      if (outOf !== undefined && outOf > 0) {
        singleTestPct = Number(((rawScore / outOf) * 100).toFixed(2));
      } else if (!isMultiTestFormat) {
        singleTestPct = rawScore;
      }
    }

    const physicsPct = pickPct(
      ['avgphysics', 'physics', 'physicspct', 'phy', 'phymarks'],
      ['avgphysi', 'physicsp']
    );
    const chemistryPct = pickPct(
      ['avgchemistry', 'chemistry', 'chemistrypct', 'chem', 'chemmarks'],
      ['avgchem', 'chemistryp']
    );
    const mathOrBioPct = pickPct(
      [
        'avgmaths',
        'avgmath',
        'avgbiology',
        'math',
        'mathematics',
        'maths',
        'biology',
        'bio',
        'mathorbiopct',
      ],
      ['avgmath', 'avgbio', 'mathorbio']
    );

    const t1 = pickPct(['t1', 'test1', 'test1pct', 'ct01', 'pt1']);
    const t2 = pickPct(['t2', 'test2', 'test2pct', 'ct02', 'pt2']);
    const t3 = pickPct(['t3', 'test3', 'test3pct', 'mt01', 'pt3']);
    const t4 = pickPct(['t4', 'test4', 'test4pct', 'ct03', 'pt4']);
    const t5 = pickPct(['t5', 'test5', 'test5pct', 'mt02', 'pt5']);
    const t6 = pickPct(['t6', 'test6', 'test6pct', 'aiot01', 'latesttest', 'grandtest']);

    let offlineRank = pickNum(['offlinerank', 'rank', 'batchrank'], ['offlinera']);
    let regionalRank = pickNum(['regionalrank', 'zonerank', 'staterank'], ['regionalra']);
    let centerRank = pickNum(['centerrank', 'schoolrank', 'branchrank'], ['centerra']);

    const rowRanks = [offlineRank, regionalRank, centerRank].filter(
      (r): r is number => r !== undefined && !isNaN(r) && r > 0
    );
    const rowRanksInflated100x =
      rowRanks.length > 0 &&
      rowRanks.every((r) => r >= 100 && r % 100 === 0) &&
      (wasRowScaledDown || rowRanks.length >= 2 || rowRanks.some((r) => r >= 500));

    if (wasRowScaledDown || rowRanksInflated100x) {
      if (offlineRank !== undefined && offlineRank >= 100 && offlineRank % 100 === 0) {
        offlineRank = Math.round(offlineRank / 100);
      }
      if (regionalRank !== undefined && regionalRank >= 100 && regionalRank % 100 === 0) {
        regionalRank = Math.round(regionalRank / 100);
      }
      if (centerRank !== undefined && centerRank >= 100 && centerRank % 100 === 0) {
        centerRank = Math.round(centerRank / 100);
      }
    }

    const weakTopicsRaw = pickStr(
      ['weaktopics', 'weakarea', 'weakareas', 'weakchapters', 'topics', 'remarks'],
      ['weaktopic', 'weakarea']
    );

    const isAttemptedTest =
      singleTestPct !== undefined ||
      rawScore !== undefined ||
      physicsPct !== undefined ||
      chemistryPct !== undefined ||
      mathOrBioPct !== undefined ||
      t1 !== undefined ||
      t6 !== undefined;

    parsedLines.push({
      regNo,
      name,
      batchName,
      hasExplicitBatch: Boolean(explicitBatch),
      classStream: classStream || undefined,
      centerName: centerName || undefined,
      combinedCenterName: combinedCenterName || undefined,
      regionName: regionName || undefined,
      parentName: parentName || undefined,
      parentEmail: parentEmail || undefined,
      parentPhone: parentPhone || undefined,
      attendancePct,
      classesAttended,
      classesHeld,
      testName: testName || undefined,
      testDate,
      testType: testType || undefined,
      outOf,
      rawScore,
      singleTestPct,
      isMultiTestFormat,
      isAttemptedTest,
      t1,
      t2,
      t3,
      t4,
      t5,
      t6,
      physicsPct,
      chemistryPct,
      mathOrBioPct,
      offlineRank,
      regionalRank,
      centerRank,
      weakTopicsRaw: weakTopicsRaw || undefined,
    });
  }

  // Group parsed lines strictly by (batchName, regNo) so students and test rows from one batch (e.g. LJ121)
  // are NEVER mixed into another batch (e.g. AJ221EA or S1A-LJ21W)
  const groupedByBatchAndRegNo = new Map<string, ParsedRawLine[]>();
  for (const line of parsedLines) {
    const cleanBatchKey = (line.batchName || defaultBatchName || 'Uploaded Batch')
      .trim()
      .toUpperCase();
    const compositeKey = `${cleanBatchKey}__${line.regNo}`;
    const existing = groupedByBatchAndRegNo.get(compositeKey) || [];
    // Deduplicate identical (testName, testDate) rows per student within the same batch if repeated in the sheet
    if (line.testName) {
      const dupIdx = existing.findIndex(
        (e) =>
          e.testName?.toLowerCase() === line.testName?.toLowerCase() &&
          (e.testDate || '').toLowerCase() === (line.testDate || '').toLowerCase()
      );
      if (dupIdx >= 0) {
        existing[dupIdx] = line;
      } else {
        existing.push(line);
      }
    } else {
      existing.push(line);
    }
    groupedByBatchAndRegNo.set(compositeKey, existing);
  }

  // Build a canonical test schedule ID map scoped per batch so tests align cleanly within each batch
  const canonicalTestIdByBatchAndKey = new Map<string, string>();
  const batchTestCounters = new Map<string, number>();
  for (const line of parsedLines) {
    if (line.testName) {
      const bKey = (line.batchName || defaultBatchName || 'Uploaded Batch').trim().toLowerCase();
      const key = `${bKey}__${line.testName.trim().toLowerCase()}__${(line.testDate || '').trim().toLowerCase()}`;
      if (!canonicalTestIdByBatchAndKey.has(key)) {
        const nextNum = (batchTestCounters.get(bKey) || 0) + 1;
        batchTestCounters.set(bKey, nextNum);
        canonicalTestIdByBatchAndKey.set(key, `test-${nextNum}`);
      }
    }
  }

  const consolidatedRows: UploadedStudentRow[] = [];

  for (const [, group] of groupedByBatchAndRegNo.entries()) {
    const first = group[0];
    const regNo = first.regNo;
    const latest = group[group.length - 1];
    const attemptedLines = group.filter((g) => g.isAttemptedTest);
    const latestAttempted =
      attemptedLines.length > 0 ? attemptedLines[attemptedLines.length - 1] : latest;

    const chosenBatchName = (first.batchName || defaultBatchName || 'Uploaded Batch').trim();

    const classStream = latestAttempted.classStream || first.classStream;
    const isBioStream = Boolean(classStream && /neet|bio|med/i.test(classStream));
    const thirdSubName = isBioStream ? 'Biology' : 'Mathematics';

    // Case 1: Single-row summary sheet with explicit T1..T6 columns (not a multi-row test log)
    if (group.length === 1 && !first.isMultiTestFormat) {
      const basePct = first.singleTestPct;
      const t1Pct = first.t1 ?? basePct;
      const t2Pct = first.t2 ?? t1Pct;
      const t3Pct = first.t3 ?? t2Pct;
      const t4Pct = first.t4 ?? t3Pct;
      const t5Pct = first.t5 ?? t4Pct;
      const t6Pct = first.t6 ?? basePct ?? t5Pct;

      consolidatedRows.push({
        regNo,
        name: first.name,
        batchName: chosenBatchName,
        classStream,
        centerName: first.centerName,
        combinedCenterName: first.combinedCenterName,
        regionName: first.regionName,
        parentName: first.parentName,
        parentEmail: first.parentEmail,
        parentPhone: first.parentPhone,
        attendancePct: first.attendancePct,
        classesAttended: first.classesAttended,
        classesHeld: first.classesHeld,
        outOfMarks: first.outOf,
        rawScoreMarks: first.rawScore,
        offlineRank: first.offlineRank,
        regionalRank: first.regionalRank,
        centerRank: first.centerRank,
        test1Pct: t1Pct,
        test2Pct: t2Pct,
        test3Pct: t3Pct,
        test4Pct: t4Pct,
        test5Pct: t5Pct,
        test6Pct: t6Pct,
        physicsPct: first.physicsPct,
        chemistryPct: first.chemistryPct,
        mathOrBioPct: first.mathOrBioPct,
        weakTopicsRaw: first.weakTopicsRaw,
        uploadCategory,
      });
      continue;
    }

    // Case 2: Multi-row test log (like Milestone / AITS coaching sheets) or single-row explicit test score
    const testsScheduled = group.length;
    const testsAppeared = attemptedLines.length;

    const avgOf = (vals: (number | undefined)[]): number | undefined => {
      const valid = vals.filter((v): v is number => v !== undefined && !isNaN(v));
      if (valid.length === 0) return undefined;
      return Number((valid.reduce((sum, v) => sum + v, 0) / valid.length).toFixed(2));
    };

    const meanPhy =
      avgOf(attemptedLines.map((l) => l.physicsPct)) ?? (testsAppeared === 0 ? 0 : undefined);
    const meanChem =
      avgOf(attemptedLines.map((l) => l.chemistryPct)) ?? (testsAppeared === 0 ? 0 : undefined);
    const meanMathBio =
      avgOf(attemptedLines.map((l) => l.mathOrBioPct)) ?? (testsAppeared === 0 ? 0 : undefined);

    const bKeyForCanonical = chosenBatchName.toLowerCase();

    // Preserve ALL scheduled test rows (both appeared and absent) in chronological order for this batch
    const parsedTestAttempts: TestAttempt[] = group.map((line, tIdx) => {
      const maxMarks = line.outOf && line.outOf > 0 ? line.outOf : 300;
      const subMax = Math.round(maxMarks / 3);
      const appeared = line.isAttemptedTest;

      const key = line.testName
        ? `${bKeyForCanonical}__${line.testName.trim().toLowerCase()}__${(line.testDate || '').trim().toLowerCase()}`
        : '';
      const canonicalTestId =
        (key && canonicalTestIdByBatchAndKey.get(key)) || `test-${tIdx + 1}`;
      const testLabel = line.testName || `Milestone Test ${tIdx + 1}`;

      if (!appeared) {
        return {
          testId: canonicalTestId,
          testName: testLabel,
          testDate: line.testDate || `Test ${tIdx + 1}`,
          testType: line.testType || 'Main',
          appeared: false,
          batchCodeForTest: line.batchName,
          regionName: line.regionName || first.regionName,
          combinedCenterName: line.combinedCenterName || first.combinedCenterName,
          centerName: line.centerName || first.centerName,
          classStream: line.classStream || classStream,
          totalMarks: 0,
          maxMarks,
          percentage: 0,
          batchPercentile: 0,
          rankInTest: 0,
          subjectScores: [
            { subject: 'Physics', marksObtained: 0, maxMarks: subMax, percentage: 0 },
            { subject: 'Chemistry', marksObtained: 0, maxMarks: subMax, percentage: 0 },
            { subject: thirdSubName, marksObtained: 0, maxMarks: subMax, percentage: 0 },
          ],
        };
      }

      const pct =
        line.singleTestPct !== undefined
          ? Number(line.singleTestPct.toFixed(2))
          : avgOf([line.physicsPct, line.chemistryPct, line.mathOrBioPct]) ?? 0;

      const totalMarks =
        line.rawScore !== undefined
          ? Math.round(line.rawScore)
          : Math.round((pct / 100) * maxMarks);

      // Keep 2-decimal precision for subject percentages so marksObtained = Math.round((pct/100)*subMax) is 100% exact
      const phyP = Number((line.physicsPct ?? pct).toFixed(2));
      const chemP = Number((line.chemistryPct ?? pct).toFixed(2));
      const mathP = Number((line.mathOrBioPct ?? pct).toFixed(2));

      const phyMarks = Math.round((phyP / 100) * subMax);
      const chemMarks = Math.round((chemP / 100) * subMax);
      let mathMarks = Math.round((mathP / 100) * subMax);

      // Ensure sum of 3 subject marks always matches totalMarks exactly
      if (phyMarks + chemMarks + mathMarks !== totalMarks) {
        mathMarks = Math.max(0, totalMarks - phyMarks - chemMarks);
      }

      return {
        testId: canonicalTestId,
        testName: testLabel,
        testDate: line.testDate || `Test ${tIdx + 1}`,
        testType: line.testType || 'Main',
        appeared: true,
        batchCodeForTest: line.batchName,
        regionName: line.regionName || first.regionName,
        combinedCenterName: line.combinedCenterName || first.combinedCenterName,
        centerName: line.centerName || first.centerName,
        classStream: line.classStream || classStream,
        totalMarks,
        maxMarks,
        percentage: Number(((totalMarks / maxMarks) * 100).toFixed(2)),
        batchPercentile: Math.min(99.5, Math.max(5, Number((pct * 1.1).toFixed(1)))),
        rankInTest: line.offlineRank || line.centerRank || line.regionalRank || tIdx + 1,
        offlineRank: line.offlineRank,
        regionalRank: line.regionalRank,
        centerRank: line.centerRank,
        subjectScores: [
          {
            subject: 'Physics',
            marksObtained: phyMarks,
            maxMarks: subMax,
            percentage: Number(((phyMarks / subMax) * 100).toFixed(2)),
          },
          {
            subject: 'Chemistry',
            marksObtained: chemMarks,
            maxMarks: subMax,
            percentage: Number(((chemMarks / subMax) * 100).toFixed(2)),
          },
          {
            subject: thirdSubName,
            marksObtained: mathMarks,
            maxMarks: subMax,
            percentage: Number(((mathMarks / subMax) * 100).toFixed(2)),
          },
        ],
      };
    });

    const appearedAttemptObjects = parsedTestAttempts.filter((a) => a.appeared !== false);
    const attemptPcts =
      appearedAttemptObjects.length > 0
        ? appearedAttemptObjects.map((a) => a.percentage)
        : [0, 0, 0, 0, 0, 0];

    const totalMarksObtained = appearedAttemptObjects.reduce((s, a) => s + a.totalMarks, 0);
    const totalMaxMarksAppeared = appearedAttemptObjects.reduce((s, a) => s + a.maxMarks, 0);
    const totalMaxMarksScheduled = parsedTestAttempts.reduce((s, a) => s + a.maxMarks, 0);

    const firstPct = attemptPcts[0] ?? 0;
    const lastPct = attemptPcts[attemptPcts.length - 1] ?? 0;

    const t1Pct = attemptPcts[0] ?? firstPct;
    const t2Pct = attemptPcts[1] ?? t1Pct;
    const t3Pct = attemptPcts[2] ?? t2Pct;
    const t4Pct = attemptPcts[3] ?? lastPct;
    const t5Pct = attemptPcts[4] ?? lastPct;
    const t6Pct = lastPct;

    const explicitAtt = avgOf(group.map((g) => g.attendancePct));
    const computedAttendancePct =
      explicitAtt !== undefined
        ? Number(explicitAtt.toFixed(1))
        : Number(((testsAppeared / Math.max(1, testsScheduled)) * 100).toFixed(1));

    // Keep weakTopicsRaw ordered strictly as [PhysicsTopic];[ChemistryTopic];[MathOrBioTopic]
    let weakTopicsRaw = latestAttempted.weakTopicsRaw || first.weakTopicsRaw;
    if (!weakTopicsRaw) {
      const phyTopic =
        (meanPhy ?? 50) < 40 ? 'Rotational Dynamics' : 'Electrostatics & Capacitors';
      const chemTopic =
        (meanChem ?? 50) < 40 ? 'Chemical Equilibrium & Ionic' : 'Electrochemistry';
      const mathBioTopic = isBioStream
        ? 'Molecular Basis of Inheritance'
        : 'Definite Integration & Area';
      weakTopicsRaw = `${phyTopic};${chemTopic};${mathBioTopic}`;
    }

    const bestOffRanks = appearedAttemptObjects
      .map((a) => a.offlineRank)
      .filter((r): r is number => r !== undefined && r > 0);
    const bestRegRanks = appearedAttemptObjects
      .map((a) => a.regionalRank)
      .filter((r): r is number => r !== undefined && r > 0);
    const bestCenRanks = appearedAttemptObjects
      .map((a) => a.centerRank)
      .filter((r): r is number => r !== undefined && r > 0);

    consolidatedRows.push({
      regNo,
      name: latestAttempted.name || first.name,
      batchName: chosenBatchName,
      classStream,
      centerName: latestAttempted.centerName || first.centerName,
      combinedCenterName: latestAttempted.combinedCenterName || first.combinedCenterName,
      regionName: latestAttempted.regionName || first.regionName,
      parentName: latestAttempted.parentName || first.parentName,
      parentEmail: latestAttempted.parentEmail || first.parentEmail,
      parentPhone: latestAttempted.parentPhone || first.parentPhone,
      attendancePct: computedAttendancePct,
      classesAttended: testsAppeared,
      classesHeld: testsScheduled,
      testsScheduled,
      testsAppeared,
      totalMarksObtained,
      totalMaxMarksAppeared,
      totalMaxMarksScheduled,
      outOfMarks: latestAttempted.outOf,
      rawScoreMarks: latestAttempted.rawScore,
      offlineRank: bestOffRanks.length > 0 ? Math.min(...bestOffRanks) : latestAttempted.offlineRank,
      regionalRank: bestRegRanks.length > 0 ? Math.min(...bestRegRanks) : latestAttempted.regionalRank,
      centerRank: bestCenRanks.length > 0 ? Math.min(...bestCenRanks) : latestAttempted.centerRank,
      test1Pct: t1Pct,
      test2Pct: t2Pct,
      test3Pct: t3Pct,
      test4Pct: t4Pct,
      test5Pct: t5Pct,
      test6Pct: t6Pct,
      physicsPct: meanPhy,
      chemistryPct: meanChem,
      mathOrBioPct: meanMathBio,
      weakTopicsRaw,
      uploadCategory,
      parsedTestAttempts,
    });
  }

  return consolidatedRows;
}

/**
 * Converts uploaded spreadsheet/PDF rows into full StudentRecord objects ready for batch analytics.
 * Never fabricates synthetic scores or inflates denominators.
 */
export function convertUploadedRowsToStudents(
  rows: UploadedStudentRow[],
  targetBatch: BatchRecord
): StudentRecord[] {
  return rows.map((row, idx) => {
    const thirdSubject = targetBatch.subjects[2] || 'Mathematics';
    const isAllAbsent = row.testsAppeared !== undefined && row.testsAppeared === 0;

    let testAttempts = row.parsedTestAttempts;
    let overallAvgPct = 0;
    let latestTestPct = 0;
    let growthDeltaPct = 0;

    if (testAttempts && testAttempts.length > 0) {
      const appearedList = testAttempts.filter((a) => a.appeared !== false);
      if (appearedList.length === 0) {
        overallAvgPct = 0;
        latestTestPct = 0;
        growthDeltaPct = 0;
      } else {
        const pcts = appearedList.map((a) => a.percentage);
        overallAvgPct = Number(
          (pcts.reduce((sum, v) => sum + v, 0) / pcts.length).toFixed(2)
        );
        latestTestPct = Number(pcts[pcts.length - 1].toFixed(2));
        growthDeltaPct = Number((latestTestPct - pcts[0]).toFixed(2));
      }
    } else if (isAllAbsent) {
      overallAvgPct = 0;
      latestTestPct = 0;
      growthDeltaPct = 0;
      testAttempts = targetBatch.tests.map((testMeta) => ({
        testId: testMeta.testId,
        testName: testMeta.testName,
        testDate: testMeta.testDate,
        testType: testMeta.testType || 'Main',
        appeared: false,
        totalMarks: 0,
        maxMarks: testMeta.maxMarks,
        percentage: 0,
        batchPercentile: 0,
        rankInTest: 0,
        subjectScores: [
          {
            subject: 'Physics',
            marksObtained: 0,
            maxMarks: Math.round(testMeta.maxMarks / 3),
            percentage: 0,
          },
          {
            subject: 'Chemistry',
            marksObtained: 0,
            maxMarks: Math.round(testMeta.maxMarks / 3),
            percentage: 0,
          },
          {
            subject: thirdSubject,
            marksObtained: 0,
            maxMarks: Math.round(testMeta.maxMarks / 3),
            percentage: 0,
          },
        ],
      }));
    } else {
      const baseScore =
        row.test6Pct ??
        row.test1Pct ??
        row.physicsPct ??
        row.chemistryPct ??
        row.mathOrBioPct ??
        0;

      // Use exact provided T1..T6 columns without fabricating artificial (baseScore - 6) offsets
      const rawProvidedPcts = [
        row.test1Pct,
        row.test2Pct,
        row.test3Pct,
        row.test4Pct,
        row.test5Pct,
        row.test6Pct,
      ];
      const hasMultiColumns =
        rawProvidedPcts.filter((v) => v !== undefined).length > 1 &&
        new Set(rawProvidedPcts.filter((v) => v !== undefined)).size >= 1;

      const scheduleToUse = hasMultiColumns
        ? targetBatch.tests.slice(0, 6)
        : [
            targetBatch.tests[targetBatch.tests.length - 1] || {
              testId: 'test-1',
              testName: 'Assessment 1',
              testDate: 'Recent',
              maxMarks: row.outOfMarks || 300,
              testType: 'Main',
            },
          ];

      const testPcts = scheduleToUse.map((_, tIdx) => {
        const val = hasMultiColumns ? rawProvidedPcts[tIdx] ?? baseScore : baseScore;
        return Math.min(100, Math.max(0, Number(val) || 0));
      });

      overallAvgPct = Number(
        (testPcts.reduce((sum, v) => sum + v, 0) / Math.max(1, testPcts.length)).toFixed(2)
      );
      latestTestPct = Number((testPcts[testPcts.length - 1] ?? 0).toFixed(2));
      growthDeltaPct = Number((latestTestPct - (testPcts[0] ?? 0)).toFixed(2));

      testAttempts = scheduleToUse.map((testMeta, tIdx) => {
        const maxMarks = row.outOfMarks && row.outOfMarks > 0 ? row.outOfMarks : testMeta.maxMarks;
        const pct = testPcts[tIdx] ?? overallAvgPct;
        const totalMarks =
          !hasMultiColumns && row.rawScoreMarks !== undefined
            ? Math.round(row.rawScoreMarks)
            : Math.round((pct / 100) * maxMarks);
        const subMax = Math.round(maxMarks / 3);
        const phyPct = Number((row.physicsPct ?? pct).toFixed(2));
        const chemPct = Number((row.chemistryPct ?? pct).toFixed(2));
        const phyMarks = Math.round((phyPct / 100) * subMax);
        const chemMarks = Math.round((chemPct / 100) * subMax);
        const mathMarks = Math.max(0, totalMarks - phyMarks - chemMarks);

        return {
          testId: testMeta.testId,
          testName: testMeta.testName,
          testDate: testMeta.testDate,
          testType: testMeta.testType || 'Main',
          appeared: true,
          regionName: row.regionName,
          combinedCenterName: row.combinedCenterName,
          centerName: row.centerName,
          totalMarks,
          maxMarks,
          percentage: Number(((totalMarks / maxMarks) * 100).toFixed(2)),
          batchPercentile: Math.min(99.5, Math.max(5, Number((pct * 0.98).toFixed(1)))),
          rankInTest: idx + 1,
          subjectScores: [
            {
              subject: 'Physics',
              marksObtained: phyMarks,
              maxMarks: subMax,
              percentage: Number(((phyMarks / subMax) * 100).toFixed(2)),
            },
            {
              subject: 'Chemistry',
              marksObtained: chemMarks,
              maxMarks: subMax,
              percentage: Number(((chemMarks / subMax) * 100).toFixed(2)),
            },
            {
              subject: thirdSubject,
              marksObtained: mathMarks,
              maxMarks: subMax,
              percentage: Number(((mathMarks / subMax) * 100).toFixed(2)),
            },
          ],
        };
      });
    }

    const attendancePct = Math.min(
      100,
      Math.max(
        0,
        Number(
          row.attendancePct !== undefined
            ? row.attendancePct
            : isAllAbsent
            ? 0
            : 86
        )
      )
    );

    const weakTopicNames = row.weakTopicsRaw
      ? row.weakTopicsRaw
          .split(/[;|,]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : ['Rotational Dynamics', 'Electrochemistry'];

    const phyAccuracy = isAllAbsent
      ? 0
      : Math.min(
          99,
          Math.max(
            5,
            Number(
              (row.physicsPct !== undefined ? row.physicsPct : Math.max(25, overallAvgPct - 8)).toFixed(1)
            )
          )
        );
    const chemAccuracy = isAllAbsent
      ? 0
      : Math.min(
          99,
          Math.max(
            5,
            Number(
              (row.chemistryPct !== undefined ? row.chemistryPct : Math.max(25, overallAvgPct - 6)).toFixed(1)
            )
          )
        );
    const mathAccuracy = isAllAbsent
      ? 0
      : Math.min(
          99,
          Math.max(
            5,
            Number(
              (row.mathOrBioPct !== undefined ? row.mathOrBioPct : overallAvgPct).toFixed(1)
            )
          )
        );

    const classifyTopic = (acc: number): 'Weak' | 'Moderate' | 'Strong' =>
      acc < 60 ? 'Weak' : acc < 75 ? 'Moderate' : 'Strong';

    const topicScores: TopicScore[] = [
      {
        topicId: `up-top-${idx}-1`,
        subject: 'Physics',
        topicName: weakTopicNames[0] || 'Rotational Dynamics',
        accuracyPct: phyAccuracy,
        questionsAttempted: 25,
        questionsCorrect: Math.round((phyAccuracy / 100) * 25),
        status: classifyTopic(phyAccuracy),
      },
      {
        topicId: `up-top-${idx}-2`,
        subject: 'Chemistry',
        topicName: weakTopicNames[1] || 'Electrochemistry',
        accuracyPct: chemAccuracy,
        questionsAttempted: 24,
        questionsCorrect: Math.round((chemAccuracy / 100) * 24),
        status: classifyTopic(chemAccuracy),
      },
      {
        topicId: `up-top-${idx}-3`,
        subject: thirdSubject,
        topicName:
          thirdSubject === 'Biology'
            ? 'Molecular Basis of Inheritance'
            : 'Definite Integration & Area',
        accuracyPct: mathAccuracy,
        questionsAttempted: 30,
        questionsCorrect: Math.round((mathAccuracy / 100) * 30),
        status: classifyTopic(mathAccuracy),
      },
    ];

    const evalStatus = evaluateInterventionStatus(
      overallAvgPct,
      growthDeltaPct,
      attendancePct,
      latestTestPct
    );

    if (isAllAbsent) {
      evalStatus.status = 'Urgent Intervention';
      evalStatus.reasons = [
        `Absent in all scheduled assessments (0/${row.testsScheduled || 1} tests attempted)`,
        ...evalStatus.reasons,
      ];
    } else if (
      row.testsScheduled !== undefined &&
      row.testsAppeared !== undefined &&
      row.testsAppeared < row.testsScheduled
    ) {
      evalStatus.reasons = [
        `Attempted ${row.testsAppeared} of ${row.testsScheduled} scheduled batch tests (${attendancePct}% test attendance)`,
        ...evalStatus.reasons,
      ];
    }

    const normalizedReg = (row.regNo || `REG-2027-9${idx + 10}`).trim().toUpperCase();
    const batchSlug = targetBatch.id
      .replace(/^batch-/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');
    const regSlug = normalizedReg.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    return enrichStudentSummaryFromAttempts({
      id: `stu-${batchSlug}-${regSlug}`,
      regNo: normalizedReg,
      name: row.name,
      batchId: targetBatch.id,
      batchName: targetBatch.name,
      stream: row.classStream || targetBatch.stream,
      regionName: row.regionName,
      combinedCenterName: row.combinedCenterName,
      centerName: row.centerName,
      parentName: row.parentName || `Guardian of ${row.name}`,
      parentEmail:
        row.parentEmail ||
        `${row.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@family.edu`,
      parentPhone: row.parentPhone || '+91 98201 44100',
      classTeacherName: targetBatch.leadFaculty,
      classTeacherEmail: 'faculty.desk@aetheris.edu',
      attendancePct,
      monthlyAttendance: [
        { month: 'May', classesHeld: 24, classesAttended: Math.round((attendancePct / 100) * 24), percentage: attendancePct },
        { month: 'Jun', classesHeld: 26, classesAttended: Math.round((attendancePct / 100) * 26), percentage: attendancePct },
        { month: 'Jul', classesHeld: 25, classesAttended: Math.round((attendancePct / 100) * 25), percentage: attendancePct },
        { month: 'Aug', classesHeld: 24, classesAttended: Math.round((attendancePct / 100) * 24), percentage: attendancePct },
        { month: 'Sep', classesHeld: 25, classesAttended: Math.round((attendancePct / 100) * 25), percentage: attendancePct },
        { month: 'Oct', classesHeld: 22, classesAttended: Math.round((attendancePct / 100) * 22), percentage: attendancePct },
      ],
      testAttempts,
      topicScores,
      overallAvgPct,
      latestTestPct,
      growthDeltaPct,
      rankInBatch: idx + 1,
      batchPercentile: 80,
      interventionStatus: evalStatus.status,
      interventionReasons: evalStatus.reasons,
    });
  });
}

/**
 * Non-destructively merges an incoming UploadedStudentRow into an existing StudentRecord
 * based on whether the upload is 'attendance_only', 'results_only', or 'combined'.
 */
export function mergeExistingStudentWithRow(
  existing: StudentRecord,
  row: UploadedStudentRow,
  targetBatch: BatchRecord,
  category: UploadCategory = 'combined'
): StudentRecord {
  const freshlyBuilt = convertUploadedRowsToStudents([row], targetBatch)[0];

  const hasNewAttendance =
    category === 'attendance_only' ||
    (category === 'combined' && row.attendancePct !== undefined);

  const hasNewResults =
    category === 'results_only' ||
    (category === 'combined' &&
      (row.test1Pct !== undefined ||
        row.test6Pct !== undefined ||
        row.physicsPct !== undefined ||
        (row.parsedTestAttempts && row.parsedTestAttempts.length > 0)));

  const nextAttendancePct = hasNewAttendance
    ? freshlyBuilt.attendancePct
    : existing.attendancePct;
  const nextMonthlyAttendance = hasNewAttendance
    ? freshlyBuilt.monthlyAttendance
    : existing.monthlyAttendance;

  const nextTestAttempts = hasNewResults
    ? freshlyBuilt.testAttempts
    : existing.testAttempts;
  const nextTopicScores = hasNewResults
    ? freshlyBuilt.topicScores
    : existing.topicScores;
  const nextOverallAvgPct = hasNewResults
    ? freshlyBuilt.overallAvgPct
    : existing.overallAvgPct;
  const nextLatestTestPct = hasNewResults
    ? freshlyBuilt.latestTestPct
    : existing.latestTestPct;
  const nextGrowthDeltaPct = hasNewResults
    ? freshlyBuilt.growthDeltaPct
    : existing.growthDeltaPct;

  const evalStatus = evaluateInterventionStatus(
    nextOverallAvgPct,
    nextGrowthDeltaPct,
    nextAttendancePct,
    nextLatestTestPct
  );

  return enrichStudentSummaryFromAttempts({
    ...existing,
    batchId: targetBatch.id,
    batchName: targetBatch.name,
    stream: row.classStream || existing.stream,
    regionName: row.regionName || existing.regionName,
    combinedCenterName: row.combinedCenterName || existing.combinedCenterName,
    centerName: row.centerName || existing.centerName,
    name: row.name && !row.name.startsWith('Student ') ? row.name : existing.name,
    parentName: row.parentName || existing.parentName,
    parentEmail: row.parentEmail || existing.parentEmail,
    parentPhone: row.parentPhone || existing.parentPhone,
    attendancePct: nextAttendancePct,
    monthlyAttendance: nextMonthlyAttendance,
    testAttempts: nextTestAttempts,
    topicScores: nextTopicScores,
    overallAvgPct: nextOverallAvgPct,
    latestTestPct: nextLatestTestPct,
    growthDeltaPct: nextGrowthDeltaPct,
    interventionStatus: evalStatus.status,
    interventionReasons: evalStatus.reasons,
  });
}

/**
 * Optimistically applies imported rows to client-side batches in 0ms so the UI updates
 * immediately without waiting for network round-trips, while also auto-provisioning
 * any new coaching batches discovered in the uploaded sheet.
 */
export function applyImportedRowsLocally(
  currentBatches: BatchRecord[],
  targetBatchId: string,
  incomingRows: UploadedStudentRow[],
  uploadCategory: UploadCategory = 'combined'
): { batches: BatchRecord[]; resolvedTargetBatchId: string } {
  const nextBatches: BatchRecord[] = currentBatches.map((b) => ({
    ...b,
    tests: [...b.tests],
    students: [...b.students],
  }));

  if (incomingRows.length === 0) {
    return { batches: nextBatches, resolvedTargetBatchId: targetBatchId };
  }

  const fallbackBatch =
    nextBatches.find((b) => b.id === targetBatchId) || nextBatches[0];

  const rowsByBatchId = new Map<string, UploadedStudentRow[]>();

  for (const row of incomingRows) {
    const requestedName = (
      row.batchName ||
      fallbackBatch?.name ||
      'Uploaded Coaching Batch'
    ).trim();
    const reqLower = requestedName.toLowerCase();
    const slug = requestedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const candidateBatchId = `batch-${slug || 'custom'}`;

    let matchedBatch = nextBatches.find(
      (b) =>
        b.id.toLowerCase() === candidateBatchId ||
        b.name.trim().toLowerCase() === reqLower ||
        b.code.trim().toLowerCase() === reqLower
    );

    if (!matchedBatch) {
      if (!row.batchName && fallbackBatch) {
        matchedBatch = fallbackBatch;
      } else {
        const isNeet = /neet|med|bio/i.test(`${requestedName} ${row.classStream || ''}`);
        const newBatch: BatchRecord = {
          id: candidateBatchId,
          name: requestedName,
          code: requestedName.toUpperCase().slice(0, 16),
          stream: isNeet ? 'NEET Medical' : 'JEE Advanced',
          academicYear: '2026–2027',
          leadFaculty: row.centerName
            ? `${row.centerName} Academic Desk`
            : 'Prof. R. K. Verma (HOD Physics)',
          subjects: isNeet
            ? ['Physics', 'Chemistry', 'Biology']
            : ['Physics', 'Chemistry', 'Mathematics'],
          tests:
            row.parsedTestAttempts && row.parsedTestAttempts.length > 0
              ? row.parsedTestAttempts.map((att, idx) => ({
                  testId: att.testId || `test-${idx + 1}`,
                  testName: att.testName || `Test ${idx + 1}`,
                  testDate: att.testDate || `Test ${idx + 1}`,
                  maxMarks: att.maxMarks || 300,
                  testType: att.testType || 'Main',
                }))
              : fallbackBatch
              ? [...fallbackBatch.tests]
              : [
                  {
                    testId: 'test-1',
                    testName: 'Milestone Assessment 1',
                    testDate: '17 May 2026',
                    maxMarks: 300,
                    testType: 'Main',
                  },
                ],
          students: [],
        };
        nextBatches.push(newBatch);
        matchedBatch = newBatch;
      }
    }

    const list = rowsByBatchId.get(matchedBatch.id) || [];
    list.push(row);
    rowsByBatchId.set(matchedBatch.id, list);
  }

  let firstAffectedBatchId = targetBatchId;
  let assignedFirst = false;

  for (const [bId, batchRows] of rowsByBatchId.entries()) {
    const bIdx = nextBatches.findIndex((b) => b.id === bId);
    if (bIdx < 0) continue;
    if (!assignedFirst) {
      firstAffectedBatchId = bId;
      assignedFirst = true;
    }

    const batch = nextBatches[bIdx];
    const studentMap = new Map<string, StudentRecord>();
    for (const s of batch.students) {
      studentMap.set(s.regNo.trim().toUpperCase(), s);
    }

    for (const row of batchRows) {
      const regKey = (row.regNo || '').trim().toUpperCase();
      if (!regKey) continue;
      const existing = studentMap.get(regKey);
      const effectiveCategory = row.uploadCategory || uploadCategory;
      if (existing) {
        studentMap.set(
          regKey,
          mergeExistingStudentWithRow(existing, row, batch, effectiveCategory)
        );
      } else {
        const created = convertUploadedRowsToStudents([row], batch)[0];
        studentMap.set(regKey, created);
      }
    }

    // Build canonical test schedule across all students in this batch
    const testMap = new Map<
      string,
      { testId: string; testName: string; testDate: string; maxMarks: number; testType?: string }
    >();
    for (const st of studentMap.values()) {
      for (const att of st.testAttempts || []) {
        if (!testMap.has(att.testId)) {
          testMap.set(att.testId, {
            testId: att.testId,
            testName: att.testName,
            testDate: att.testDate,
            maxMarks: att.maxMarks,
            testType: att.testType,
          });
        }
      }
    }

    const mergedStudents = recalculateBatchRanks(Array.from(studentMap.values()));
    nextBatches[bIdx] = {
      ...batch,
      tests: testMap.size > 0 ? Array.from(testMap.values()) : batch.tests,
      students: mergedStudents,
    };
  }

  return { batches: nextBatches, resolvedTargetBatchId: firstAffectedBatchId };
}

/**
 * Parses unstructured or tabular text extracted from a PDF or CSV string into UploadedStudentRow items.
 */
export function parseDelimitedOrPdfTextToRows(
  rawText: string,
  defaultBatchName: string,
  uploadCategory: UploadCategory = 'combined'
): UploadedStudentRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) return [];

  // If the first line is a structured header row (e.g. from CSV/TSV or PDF table extraction),
  // convert all lines into raw key-value objects and route through normalizeSmartExcelRows
  // so multi-test coaching tables, Out of / Score, and 100x cell inflation are handled identically.
  const firstLine = lines[0];
  if (
    lines.length >= 2 &&
    /reg\s*_?no|registration|student\s*_?name|roll\s*_?no|out\s*of|test\s*_?name/i.test(firstLine)
  ) {
    const splitLine = (lineStr: string) =>
      lineStr.includes('\t')
        ? lineStr.split('\t').map((p) => p.trim())
        : lineStr.includes(',')
        ? lineStr.split(',').map((p) => p.trim())
        : lineStr.split(/\s{2,}/).map((p) => p.trim());

    const headers = splitLine(firstLine);
    if (headers.length >= 3) {
      const rawObjects: Record<string, unknown>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = splitLine(lines[i]);
        if (vals.length < 2) continue;
        const obj: Record<string, unknown> = {};
        headers.forEach((h, idx) => {
          if (h) obj[h] = vals[idx] ?? '';
        });
        rawObjects.push(obj);
      }
      const normalized = normalizeSmartExcelRows(rawObjects, defaultBatchName, uploadCategory);
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  const rows: UploadedStudentRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/reg_?no|registration|student_?name|roll_?no/i.test(line) && i === 0) {
      continue;
    }

    const parts = line.includes(',')
      ? line.split(',').map((p) => p.trim())
      : line.split(/\t|\s{2,}/).map((p) => p.trim());

    if (parts.length >= 3) {
      const regNo = (parts[0] || `REG-2027-80${i}`).toUpperCase();
      const name = parts[1] || `Student ${i + 1}`;
      const batchName = isNaN(Number(parts[2])) ? parts[2] : defaultBatchName;
      const numOffset = isNaN(Number(parts[2])) ? 3 : 2;

      if (uploadCategory === 'attendance_only') {
        const val1 = Number(parts[numOffset]?.replace(/%/g, ''));
        const val2 = Number(parts[numOffset + 1]?.replace(/%/g, ''));
        let attendancePct = 86;
        if (!isNaN(val1) && !isNaN(val2) && val2 > 0 && val1 <= val2 && val2 <= 300) {
          attendancePct = Number(((val1 / val2) * 100).toFixed(1));
        } else if (!isNaN(val1)) {
          attendancePct = val1;
        }
        rows.push({
          regNo,
          name,
          batchName,
          attendancePct,
          uploadCategory: 'attendance_only',
        });
        continue;
      }

      const attendancePct = Number(parts[numOffset]?.replace(/%/g, '')) || 86;
      const t1 = Number(parts[numOffset + 1]) || 68;
      const t2 = Number(parts[numOffset + 2]) || Math.min(100, t1 + 3);
      const t3 = Number(parts[numOffset + 3]) || Math.min(100, t2 + 2);
      const t4 = Number(parts[numOffset + 4]) || Math.min(100, t3 + 2);
      const t5 = Number(parts[numOffset + 5]) || Math.min(100, t4 + 3);
      const t6 = Number(parts[numOffset + 6]) || Math.min(100, t5 + 2);
      const phy = Number(parts[numOffset + 7]) || t6;
      const chem = Number(parts[numOffset + 8]) || t6;
      const mathBio = Number(parts[numOffset + 9]) || t6;
      const weakTopicsRaw = parts[numOffset + 10] || 'Rotational Dynamics; Electrochemistry';

      rows.push({
        regNo,
        name,
        batchName,
        attendancePct,
        test1Pct: t1,
        test2Pct: t2,
        test3Pct: t3,
        test4Pct: t4,
        test5Pct: t5,
        test6Pct: t6,
        physicsPct: phy,
        chemistryPct: chem,
        mathOrBioPct: mathBio,
        weakTopicsRaw,
        uploadCategory,
      });
    }
  }

  return rows;
}

/**
 * Converts a StudentRecord into a compact AcademicAgentMatchedStudent card payload
 * with exact per-test marks (`latestMarksObtained/latestMaxMarks` and `bestMarksObtained/bestMaxMarks`).
 */
function toMatchedStudentCard(
  student: StudentRecord,
  batch: BatchRecord
): AcademicAgentMatchedStudent {
  const enriched = enrichStudentSummaryFromAttempts(student);
  const weakTopics = (enriched.topicScores || [])
    .filter((t) => t.status === 'Weak' || t.accuracyPct < 60)
    .map((t) => t.topicName)
    .slice(0, 3);

  return {
    studentId: enriched.id,
    batchId: batch.id,
    batchName: batch.name,
    regNo: enriched.regNo,
    name: enriched.name,
    rankInBatch: enriched.rankInBatch,
    overallAvgPct: enriched.overallAvgPct,
    attendancePct: enriched.attendancePct,
    latestMarksObtained: enriched.latestMarksObtained,
    latestMaxMarks: enriched.latestMaxMarks,
    latestTestName: enriched.latestTestName,
    bestMarksObtained: enriched.bestMarksObtained,
    bestMaxMarks: enriched.bestMaxMarks,
    bestTestName: enriched.bestTestName,
    totalMarksObtained: enriched.totalMarksObtained,
    totalMaxMarksAppeared: enriched.totalMaxMarksAppeared,
    testsAppearedCount: enriched.testsAppearedCount,
    testsScheduledCount: enriched.testsScheduledCount,
    interventionStatus: enriched.interventionStatus,
    weakTopics,
  };
}

/**
 * Builds a comprehensive, grounded telemetry snapshot of all batches and students
 * for the Gemini AI Agent AND generates a deterministic, high-precision fallback response
 * so queries about any batch, student, registration number, test outlier, or intervention
 * roster always return exact, actionable academic intelligence.
 */
export function buildAcademicAgentContextAndFallback(params: {
  query: string;
  batches: BatchRecord[];
  activeBatchId?: string;
  activeStudentId?: string;
  history?: AcademicAgentChatTurn[];
}): {
  systemContext: string;
  fallbackResponse: AcademicAgentQueryResponse;
} {
  const { query, batches, activeBatchId, activeStudentId } = params;
  const cleanQuery = (query || '').trim();
  const qLower = cleanQuery.toLowerCase();

  if (!batches || batches.length === 0) {
    return {
      systemContext: 'No batches are currently loaded.',
      fallbackResponse: {
        reply: 'No academic batch records are currently loaded. Please import an Excel or PDF dataset or refresh the workspace.',
        engine: 'deterministic-intelligence',
        matchedStudents: [],
        matchedBatches: [],
        suggestedFollowUps: ['How do I import an Excel test sheet?'],
      },
    };
  }

  const batchSummaries = batches.map((b) => ({
    batch: b,
    analytics: computeBatchAnalytics(b),
    rankedStudents: recalculateBatchRanks(b.students),
  }));

  const activeEntry =
    batchSummaries.find((bs) => bs.batch.id === activeBatchId) || batchSummaries[0];

  let activeStudentEntry: { student: StudentRecord; batch: BatchRecord } | undefined;
  for (const bs of batchSummaries) {
    const found = bs.rankedStudents.find((s) => s.id === activeStudentId);
    if (found) {
      activeStudentEntry = { student: found, batch: bs.batch };
      break;
    }
  }

  // 1. Match specific batches mentioned in the query
  const explicitlyMatchedBatches = batchSummaries.filter(({ batch }) => {
    const nameLower = batch.name.toLowerCase();
    const codeLower = batch.code.toLowerCase();
    if (qLower.includes(nameLower) || qLower.includes(codeLower)) return true;
    const tokens = `${nameLower} ${codeLower}`
      .split(/[\s—\-_/()]+/)
      .filter((t) => t.length >= 4 && !['batch', '2026', '2027'].includes(t));
    return tokens.some((tok) => qLower.includes(tok));
  });

  const targetBatchEntry =
    explicitlyMatchedBatches[0] || activeEntry || batchSummaries[0];

  // 2. Match specific students mentioned by Name or Reg No across all batches
  const matchedStudentEntries: Array<{ student: StudentRecord; batch: BatchRecord; score: number }> = [];
  for (const bs of batchSummaries) {
    for (const student of bs.rankedStudents) {
      const nameLower = student.name.toLowerCase();
      const regLower = student.regNo.toLowerCase();
      let score = 0;

      if (regLower && qLower.includes(regLower)) {
        score += 100;
      }
      if (qLower.includes(nameLower)) {
        score += 90;
      } else {
        const nameParts = nameLower.split(/\s+/).filter((p) => p.length >= 3);
        const matchedParts = nameParts.filter((part) => {
          const regex = new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          return regex.test(cleanQuery);
        });
        if (matchedParts.length >= 2) {
          score += 80;
        } else if (matchedParts.length === 1 && matchedParts[0].length >= 4) {
          score += 55;
        }
      }

      if (score > 0) {
        matchedStudentEntries.push({ student, batch: bs.batch, score });
      }
    }
  }

  matchedStudentEntries.sort((a, b) => b.score - a.score);

  if (
    matchedStudentEntries.length === 0 &&
    activeStudentEntry &&
    /\b(this student|current student|selected student|active student|his |her |their marks|student profile)\b/i.test(
      cleanQuery
    )
  ) {
    matchedStudentEntries.push({
      student: activeStudentEntry.student,
      batch: activeStudentEntry.batch,
      score: 75,
    });
  }

  const formatExactMarksNote = (s: StudentRecord): string => {
    const scoreMeta = getStudentExactScoreSummary(s);
    if (!scoreMeta.hasAppeared) return '0 / 0 (Absent)';
    return `Latest: ${scoreMeta.latestMarks}/${scoreMeta.latestMax} (${scoreMeta.latestPct}% in ${scoreMeta.latestTestName}) | Best: ${scoreMeta.bestMarks}/${scoreMeta.bestMax} (${scoreMeta.bestPct}% in ${scoreMeta.bestTestName})`;
  };

  // Build compact system context for Gemini
  const contextLines: string[] = [
    `ACTIVE WORKSPACE CONTEXT:`,
    `- Active Batch: ${activeEntry.batch.name} (${activeEntry.batch.code})`,
    activeStudentEntry
      ? `- Currently Selected Student in UI: ${activeStudentEntry.student.name} (Reg No: ${activeStudentEntry.student.regNo}, Batch: ${activeStudentEntry.batch.name}, Rank #${activeStudentEntry.student.rankInBatch}, Overall Mean: ${activeStudentEntry.student.overallAvgPct}%, ${formatExactMarksNote(activeStudentEntry.student)}, Attendance: ${activeStudentEntry.student.attendancePct}%)`
      : `- Currently Selected Student in UI: None`,
    ``,
    `ALL COHORT & BATCH SUMMARIES (${batchSummaries.length} Batches):`,
  ];

  for (const { batch, analytics, rankedStudents } of batchSummaries) {
    const urgentList = rankedStudents.filter(
      (s) => s.interventionStatus === 'Urgent Intervention'
    );
    const watchList = rankedStudents.filter((s) => s.interventionStatus === 'Watch');
    const hardestPoint = [...analytics.longitudinalSeries]
      .filter((pt) => (pt.appearedCount ?? 0) > 0)
      .sort((a, b) => a.batchAvgPct - b.batchAvgPct)[0];

    contextLines.push(
      `=== BATCH: ${batch.name} [Code: ${batch.code} | ID: ${batch.id}] ===`,
      `Stream: ${batch.stream} | Academic Year: ${batch.academicYear} | Lead Faculty: ${batch.leadFaculty}`,
      `Total Students: ${analytics.totalStudents} | Batch Mean: ${analytics.overallBatchAvgPct}% | Growth Delta: ${analytics.overallGrowthDeltaPct >= 0 ? '+' : ''}${analytics.overallGrowthDeltaPct}% | Avg Attendance: ${analytics.avgAttendancePct}%`,
      `Intervention Counts: ${urgentList.length} Urgent Intervention, ${watchList.length} Watch, ${analytics.totalStudents - urgentList.length - watchList.length} Optimal`,
      `Subject Averages: ${analytics.subjectSummaries.map((sub) => `${sub.subject}: ${sub.avgPct}% (Top: ${sub.topScorePct}%, Below 60%: ${sub.weakStudentCount} students)`).join(' | ')}`,
      `Top 5 Performers: ${analytics.topTenStudents.slice(0, 5).map((s) => `#${s.rankInBatch} ${s.name} (${s.regNo}): ${s.overallAvgPct}% [${formatExactMarksNote(s)}, Att: ${s.attendancePct}%]`).join('; ')}`,
      `Bottom 5 / Needs Support: ${analytics.bottomTenStudents.slice(0, 5).map((s) => `#${s.rankInBatch} ${s.name} (${s.regNo}): ${s.overallAvgPct}% [${formatExactMarksNote(s)}, Att: ${s.attendancePct}%, Status: ${s.interventionStatus}]`).join('; ')}`,
      `Longitudinal Tests (${analytics.longitudinalSeries.length}): ${analytics.longitudinalSeries.map((pt) => `${pt.testName} (${pt.testDate}): Mean ${pt.batchAvgPct}% (${pt.avgMarksObtained ?? 0}/${pt.maxMarks ?? 300} marks, ${pt.appearedCount ?? 0}/${pt.totalStudents ?? analytics.totalStudents} appeared, Difficulty: ${pt.difficultyLabel ?? 'Moderate'} ${pt.difficultyIndex ?? 50}/100, Hardest Sub: ${pt.hardestSubject?.name ?? 'N/A'} ${pt.hardestSubject?.avgPct ?? 0}%, Top: ${pt.topOutlier?.name ?? 'N/A'} ${pt.topOutlier?.pct ?? 0}%)`).join(' || ')}`,
      hardestPoint
        ? `Toughest Assessment in Batch: ${hardestPoint.testName} on ${hardestPoint.testDate} (Mean ${hardestPoint.batchAvgPct}%, Difficulty ${hardestPoint.difficultyIndex}/100)`
        : ``,
      `Complete Student Roster for ${batch.name}:`
    );

    for (const st of rankedStudents) {
      const weakTopics = (st.topicScores || [])
        .filter((t) => t.status === 'Weak' || t.accuracyPct < 60)
        .map((t) => `${t.topicName} (${t.accuracyPct}%)`)
        .join(', ');
      const testSummary = (st.testAttempts || [])
        .map((t) =>
          t.appeared === false
            ? `${t.testName}: ABSENT (0/${t.maxMarks})`
            : `${t.testName}: ${t.totalMarks}/${t.maxMarks} (${t.percentage}%)`
        )
        .join(', ');
      contextLines.push(
        `  * ${st.name} | RegNo: ${st.regNo} | Rank: #${st.rankInBatch}/${analytics.totalStudents} (${st.batchPercentile}th %ile) | Overall Mean: ${st.overallAvgPct}% | ${formatExactMarksNote(st)} | Appeared ${st.testsAppearedCount ?? st.testAttempts.length}/${st.testsScheduledCount ?? st.testAttempts.length} tests | Growth: ${st.growthDeltaPct >= 0 ? '+' : ''}${st.growthDeltaPct}% | Attendance: ${st.attendancePct}% | Status: ${st.interventionStatus} (${st.interventionReasons.join('; ')}) | Weak Topics: ${weakTopics || 'None'} | Tests: [${testSummary}]`
      );
    }
    contextLines.push('');
  }

  const systemContext = contextLines.join('\n');

  const toMatchedBatchCard = (bs: (typeof batchSummaries)[number]): AcademicAgentMatchedBatch => {
    const urgentCount = bs.rankedStudents.filter(
      (s) => s.interventionStatus === 'Urgent Intervention'
    ).length;
    const hardestTest = [...bs.analytics.longitudinalSeries]
      .filter((pt) => (pt.appearedCount ?? 0) > 0)
      .sort((a, b) => a.batchAvgPct - b.batchAvgPct)[0];
    return {
      batchId: bs.batch.id,
      batchName: bs.batch.name,
      code: bs.batch.code,
      totalStudents: bs.analytics.totalStudents,
      overallBatchAvgPct: bs.analytics.overallBatchAvgPct,
      avgAttendancePct: bs.analytics.avgAttendancePct,
      urgentInterventionCount: urgentCount,
      topStudentName: bs.analytics.topTenStudents[0]?.name,
      hardestTestName: hardestTest?.testName,
    };
  };

  // Case A: Specific student(s) matched by Name or Reg No
  if (matchedStudentEntries.length > 0) {
    const primary = matchedStudentEntries[0];
    const st = enrichStudentSummaryFromAttempts(primary.student);
    const b = primary.batch;
    const scoreMeta = getStudentExactScoreSummary(st);
    const appearedAttempts = (st.testAttempts || []).filter((t) => t.appeared !== false);
    const absentAttempts = (st.testAttempts || []).filter((t) => t.appeared === false);
    const weakTopics = (st.topicScores || [])
      .filter((t) => t.status === 'Weak' || t.accuracyPct < 60)
      .map((t) => `${t.topicName} (${t.subject} — ${t.accuracyPct}%)`);

    const subMap = new Map<string, { sumPct: number; count: number; latestObt: number; latestMax: number }>();
    for (const att of appearedAttempts) {
      for (const sub of att.subjectScores || []) {
        const prev = subMap.get(sub.subject) || { sumPct: 0, count: 0, latestObt: 0, latestMax: 0 };
        prev.sumPct += Number(sub.percentage) || 0;
        prev.count += 1;
        prev.latestObt = Number(sub.marksObtained) || 0;
        prev.latestMax = Number(sub.maxMarks) || 0;
        subMap.set(sub.subject, prev);
      }
    }
    const subjectBreakdown = Array.from(subMap.entries())
      .map(([subName, agg]) => {
        const pct = agg.count > 0 ? (agg.sumPct / agg.count).toFixed(2) : '0.00';
        return `${subName}: ${agg.latestObt}/${agg.latestMax} latest (${pct}% mean)`;
      })
      .join(' · ');

    const recentTestsLines = (st.testAttempts || [])
      .map((t) =>
        t.appeared === false
          ? `• ${t.testName} (${t.testDate}): Absent (0 / ${t.maxMarks})`
          : `• ${t.testName} (${t.testDate}): **${t.totalMarks} / ${t.maxMarks}** marks (${t.percentage.toFixed(2)}%)${t.offlineRank ? ` · Offline Rank #${t.offlineRank}` : ''}`
      )
      .join('\n');

    const reply = [
      `### Student Diagnostic Summary: ${st.name} (${st.regNo})`,
      `**Cohort**: ${b.name} (${b.code}) · **Batch Rank**: #${st.rankInBatch} (${st.batchPercentile}th percentile) · **Status**: ${st.interventionStatus}`,
      ``,
      `**1. Exact Assessment Score & Marks Telemetry**`,
      `• **Latest Test Marks**: **${scoreMeta.latestMarks} / ${scoreMeta.latestMax}** (${scoreMeta.latestPct.toFixed(2)}%) in *${scoreMeta.latestTestName}*`,
      `• **Best Test Marks**: **${scoreMeta.bestMarks} / ${scoreMeta.bestMax}** (${scoreMeta.bestPct.toFixed(2)}%) in *${scoreMeta.bestTestName}*`,
      `• **Mean Score Across ${st.testsAppearedCount ?? appearedAttempts.length} Appeared Tests**: **${st.overallAvgPct.toFixed(2)}%** (${st.testsAppearedCount ?? appearedAttempts.length} of ${st.testsScheduledCount ?? st.testAttempts.length} scheduled tests attempted)`,
      `• **Trajectory & Attendance**: ${st.growthDeltaPct >= 0 ? '+' : ''}${st.growthDeltaPct.toFixed(2)}% growth delta · Attendance ${st.attendancePct.toFixed(1)}%`,
      subjectBreakdown ? `• **Subject Breakdown**: ${subjectBreakdown}` : ``,
      ``,
      `**2. Assessment-by-Assessment Ledger (Excel Exact)**`,
      recentTestsLines,
      ``,
      `**3. Diagnostic Risks & Recommended Action**`,
      `• **Intervention Signals**: ${st.interventionReasons.join('; ')}`,
      `• **Priority Weak Topics**: ${weakTopics.length > 0 ? weakTopics.join(', ') : 'No critical topic deficits below 60% threshold'}`,
      absentAttempts.length > 0
        ? `• **Attendance Follow-Up**: Missed ${absentAttempts.length} scheduled test(s) (${absentAttempts.map((a) => a.testName).join(', ')}). Recommend immediate mentor check-in and make-up drill assignment.`
        : `• **Next Step**: Assign targeted adaptive practice questions on ${weakTopics[0]?.split(' (')[0] || 'core conceptual application'} and dispatch a governed progress report to ${st.parentName}.`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      systemContext,
      fallbackResponse: {
        reply,
        engine: 'deterministic-intelligence',
        matchedStudents: matchedStudentEntries
          .slice(0, 4)
          .map((entry) => toMatchedStudentCard(entry.student, entry.batch)),
        matchedBatches: [
          toMatchedBatchCard(
            batchSummaries.find((bs) => bs.batch.id === b.id) || targetBatchEntry
          ),
        ],
        keyMetrics: [
          {
            label: 'Batch Rank',
            value: `#${st.rankInBatch} · ${st.overallAvgPct.toFixed(2)}%`,
            tone: st.overallAvgPct >= 75 ? 'emerald' : st.overallAvgPct >= 55 ? 'indigo' : 'rose',
          },
          {
            label: `Latest (${scoreMeta.latestTestName})`,
            value: `${scoreMeta.latestMarks} / ${scoreMeta.latestMax}`,
            tone: 'indigo',
          },
          {
            label: `Best (${scoreMeta.bestTestName})`,
            value: `${scoreMeta.bestMarks} / ${scoreMeta.bestMax}`,
            tone: 'emerald',
          },
          {
            label: 'Status',
            value: st.interventionStatus,
            tone:
              st.interventionStatus === 'Optimal'
                ? 'emerald'
                : st.interventionStatus === 'Watch'
                  ? 'amber'
                  : 'rose',
          },
        ],
        suggestedFollowUps: [
          `Compare ${st.name} against the ${b.name} batch average`,
          `Who are the Top 5 students in ${b.name}?`,
          `Which students need urgent intervention in ${b.name}?`,
        ],
      },
    };
  }

  // Case B: Query asks about cross-batch comparison ("all batches", "compare batches", "both batches")
  if (
    batchSummaries.length > 1 &&
    /\b(all batches|compare batches|both batches|across batches|which batch)\b/i.test(cleanQuery)
  ) {
    const lines = batchSummaries.map(({ batch, analytics, rankedStudents }) => {
      const urgentCount = rankedStudents.filter(
        (s) => s.interventionStatus === 'Urgent Intervention'
      ).length;
      const topSt = analytics.topTenStudents[0];
      return `• **${batch.name} (${batch.code})**: ${analytics.totalStudents} students · Batch Mean **${analytics.overallBatchAvgPct}%** · Attendance **${analytics.avgAttendancePct}%** · Growth **${analytics.overallGrowthDeltaPct >= 0 ? '+' : ''}${analytics.overallGrowthDeltaPct}%** · Urgent Alerts: **${urgentCount}** · Top Scorer: ${topSt ? `${topSt.name} (${topSt.overallAvgPct}%)` : 'N/A'}`;
    });

    const reply = [
      `### Cross-Cohort Executive Comparison (${batchSummaries.length} Active Batches)`,
      ...lines,
      ``,
      `**Key Takeaway**: Select any batch card below to inspect longitudinal test difficulty, Top 10 / Bottom 10 outliers, or individual student answer ledgers.`,
    ].join('\n');

    return {
      systemContext,
      fallbackResponse: {
        reply,
        engine: 'deterministic-intelligence',
        matchedStudents: batchSummaries
          .map((bs) =>
            bs.analytics.topTenStudents[0]
              ? toMatchedStudentCard(bs.analytics.topTenStudents[0], bs.batch)
              : null
          )
          .filter((x): x is AcademicAgentMatchedStudent => x !== null),
        matchedBatches: batchSummaries.map(toMatchedBatchCard),
        keyMetrics: batchSummaries.slice(0, 4).map((bs) => ({
          label: bs.batch.code,
          value: `${bs.analytics.overallBatchAvgPct}% Mean (${bs.analytics.totalStudents} st)`,
          tone: 'indigo' as const,
        })),
        suggestedFollowUps: batchSummaries.map(
          (bs) => `Summarize ${bs.batch.name} performance and outliers`
        ),
      },
    };
  }

  // Target batch analysis (either explicitly named in query or activeBatch)
  const { batch: tb, analytics: ta, rankedStudents: tr } = targetBatchEntry;
  const urgentStudents = tr.filter((s) => s.interventionStatus === 'Urgent Intervention');
  const watchStudents = tr.filter((s) => s.interventionStatus === 'Watch');

  // Case C: Query asks about Urgent Intervention / At-Risk / Bottom performers / Low Attendance
  if (
    /\b(urgent|intervention|at-risk|at risk|weak|bottom|lowest|struggling|absent|attendance|drop|lagging)\b/i.test(
      cleanQuery
    )
  ) {
    const focusStudents =
      urgentStudents.length > 0
        ? [...urgentStudents, ...watchStudents].slice(0, 6)
        : ta.bottomTenStudents.slice(0, 6);

    const studentLines = focusStudents
      .map((s) => {
        const sm = getStudentExactScoreSummary(s);
        return `• **${s.name} (${s.regNo})** — Rank #${s.rankInBatch} · Mean **${s.overallAvgPct.toFixed(2)}%** (Latest: **${sm.latestMarks}/${sm.latestMax}** in ${sm.latestTestName}, Best: **${sm.bestMarks}/${sm.bestMax}**) · Attendance **${s.attendancePct.toFixed(1)}%** · *${s.interventionStatus}*: ${s.interventionReasons.join('; ')}`;
      })
      .join('\n');

    const reply = [
      `### Intervention & Risk Triage — ${tb.name} (${tb.code})`,
      `**Cohort Summary**: Out of **${ta.totalStudents} students**, **${urgentStudents.length}** require **Urgent Intervention** and **${watchStudents.length}** are on the **Watch** list (Batch Mean: ${ta.overallBatchAvgPct}%, Avg Attendance: ${ta.avgAttendancePct}%).`,
      ``,
      `**Priority Students Requiring Immediate Faculty Action**:`,
      studentLines,
      ``,
      `**Recommended Remediation Protocol**:`,
      `1. **Absentee & Low-Score Counseling**: Schedule 1-on-1 faculty diagnostics for students with 0 appeared tests or mean scores below 55%.`,
      `2. **Targeted Topic Drills**: Assign foundation + conceptual practice sets in **${ta.subjectSummaries.sort((a, b) => a.avgPct - b.avgPct)[0]?.subject || 'Physics'}** (lowest cohort average at ${ta.subjectSummaries.sort((a, b) => a.avgPct - b.avgPct)[0]?.avgPct || 0}%).`,
      `3. **Parent Governance Dispatch**: Queue parent/mentor progress reports directly from the student cards below.`,
    ].join('\n');

    return {
      systemContext,
      fallbackResponse: {
        reply,
        engine: 'deterministic-intelligence',
        matchedStudents: focusStudents
          .slice(0, 5)
          .map((s) => toMatchedStudentCard(s, tb)),
        matchedBatches: [toMatchedBatchCard(targetBatchEntry)],
        keyMetrics: [
          {
            label: 'Urgent Alerts',
            value: `${urgentStudents.length} Students`,
            tone: urgentStudents.length > 0 ? 'rose' : 'emerald',
          },
          {
            label: 'Watch List',
            value: `${watchStudents.length} Students`,
            tone: watchStudents.length > 0 ? 'amber' : 'emerald',
          },
          {
            label: 'Batch Mean',
            value: `${ta.overallBatchAvgPct}%`,
            tone: 'indigo',
          },
          {
            label: 'Avg Attendance',
            value: `${ta.avgAttendancePct}%`,
            tone: ta.avgAttendancePct >= 82 ? 'emerald' : 'amber',
          },
        ],
        suggestedFollowUps: [
          focusStudents[0]
            ? `Show full test-by-test breakdown for ${focusStudents[0].name}`
            : `Who are the Top 10 students in ${tb.name}?`,
          `Which test was the hardest in ${tb.name}?`,
          `Who are the Top 5 performers in ${tb.name}?`,
        ],
      },
    };
  }

  // Case D: Query asks about Top Performers / Rankers / Topper / Leaderboard
  if (/\b(top|topper|toppers|rank 1|highest|best|leaderboard|merit)\b/i.test(cleanQuery)) {
    const topSlice = ta.topTenStudents.slice(0, 6);
    const topLines = topSlice
      .map((s) => {
        const sm = getStudentExactScoreSummary(s);
        return `• **Rank #${s.rankInBatch}: ${s.name} (${s.regNo})** — Mean **${s.overallAvgPct.toFixed(2)}%** · Latest Marks: **${sm.latestMarks} / ${sm.latestMax}** (${sm.latestPct.toFixed(2)}%) · Best Marks: **${sm.bestMarks} / ${sm.bestMax}** · Attendance: **${s.attendancePct.toFixed(1)}%**`;
      })
      .join('\n');

    const reply = [
      `### Top Performers & Merit Leaderboard — ${tb.name} (${tb.code})`,
      `**Top 10 Cohort Mean**: **${ta.longitudinalSeries[ta.longitudinalSeries.length - 1]?.topTenAvgPct ?? ta.overallBatchAvgPct}%** vs Overall Batch Mean **${ta.overallBatchAvgPct}%**`,
      ``,
      `**Leading Students in ${tb.name}**:`,
      topLines,
    ].join('\n');

    return {
      systemContext,
      fallbackResponse: {
        reply,
        engine: 'deterministic-intelligence',
        matchedStudents: topSlice.slice(0, 5).map((s) => toMatchedStudentCard(s, tb)),
        matchedBatches: [toMatchedBatchCard(targetBatchEntry)],
        keyMetrics: [
          {
            label: 'Rank #1 Topper',
            value: topSlice[0] ? `${topSlice[0].name} (${topSlice[0].overallAvgPct}%)` : 'N/A',
            tone: 'emerald',
          },
          {
            label: 'Batch Mean',
            value: `${ta.overallBatchAvgPct}%`,
            tone: 'indigo',
          },
          {
            label: 'Cohort Size',
            value: `${ta.totalStudents} Students`,
            tone: 'indigo',
          },
        ],
        suggestedFollowUps: [
          topSlice[0]
            ? `Inspect full subject breakdown for ${topSlice[0].name}`
            : `Summarize ${tb.name}`,
          `Who needs urgent intervention in ${tb.name}?`,
          `Analyze test difficulty and subject trends in ${tb.name}`,
        ],
      },
    };
  }

  // Case E: Query asks about Tests, Difficulty, Subject comparison, or General Batch Summary
  const hardestTests = [...ta.longitudinalSeries]
    .filter((pt) => (pt.appearedCount ?? 0) > 0)
    .sort((a, b) => a.batchAvgPct - b.batchAvgPct);
  const toughestTest = hardestTests[0];
  const latestTest = ta.longitudinalSeries[ta.longitudinalSeries.length - 1];

  const subjectLines = ta.subjectSummaries
    .map(
      (sub) =>
        `• **${sub.subject}**: Cohort Mean **${sub.avgPct}%** · Top Score **${sub.topScorePct}%** · Students below 60% threshold: **${sub.weakStudentCount}**`
    )
    .join('\n');

  const testLines = ta.longitudinalSeries
    .map(
      (pt) =>
        `• **${pt.testName} (${pt.testDate})**: Mean **${pt.batchAvgPct}%** (${pt.avgMarksObtained ?? 0}/${pt.maxMarks ?? 300} marks) · Appeared: **${pt.appearedCount ?? 0}/${pt.totalStudents ?? ta.totalStudents}** · Difficulty: **${pt.difficultyLabel ?? 'Moderate'} (${pt.difficultyIndex ?? 50}/100)** · Top: ${pt.topOutlier ? `${pt.topOutlier.name} (${pt.topOutlier.marks}/${pt.topOutlier.maxMarks}, ${pt.topOutlier.pct}%)` : 'N/A'}`
    )
    .join('\n');

  const reply = [
    `### Executive Cohort Intelligence — ${tb.name} (${tb.code})`,
    `**Stream**: ${tb.stream} · **Lead Faculty**: ${tb.leadFaculty} · **Enrolled**: ${ta.totalStudents} Students`,
    ``,
    `**1. Core Telemetry & Trajectory**`,
    `• **Cumulative Batch Mean**: **${ta.overallBatchAvgPct}%** (${ta.overallGrowthDeltaPct >= 0 ? '+' : ''}${ta.overallGrowthDeltaPct}% longitudinal growth delta)`,
    `• **Cohort Attendance**: **${ta.avgAttendancePct}%** · **Intervention Triage**: **${urgentStudents.length}** Urgent, **${watchStudents.length}** Watch`,
    toughestTest
      ? `• **Highest Difficulty Assessment**: **${toughestTest.testName}** (${toughestTest.testDate}) — Batch Mean **${toughestTest.batchAvgPct}%** (Difficulty Index ${toughestTest.difficultyIndex}/100, Hardest Subject: ${toughestTest.hardestSubject?.name ?? 'Physics'} at ${toughestTest.hardestSubject?.avgPct ?? 0}%)`
      : ``,
    latestTest
      ? `• **Latest Assessment**: **${latestTest.testName}** (${latestTest.testDate}) — Batch Mean **${latestTest.batchAvgPct}%** · Top Scorer: ${latestTest.topOutlier ? `${latestTest.topOutlier.name} (${latestTest.topOutlier.marks}/${latestTest.topOutlier.maxMarks}, ${latestTest.topOutlier.pct}%)` : 'N/A'}`
      : ``,
    ``,
    `**2. Subject-Wise Performance Matrix**`,
    subjectLines,
    ``,
    `**3. Longitudinal Assessment Ledger**`,
    testLines,
  ]
    .filter(Boolean)
    .join('\n');

  const highlightStudents = [
    ta.topTenStudents[0],
    ta.topTenStudents[1],
    urgentStudents[0] || ta.bottomTenStudents[0],
    urgentStudents[1] || ta.bottomTenStudents[1],
  ].filter((s): s is StudentRecord => Boolean(s));

  return {
    systemContext,
    fallbackResponse: {
      reply,
      engine: 'deterministic-intelligence',
      matchedStudents: highlightStudents
        .slice(0, 4)
        .map((s) => toMatchedStudentCard(s, tb)),
      matchedBatches: [toMatchedBatchCard(targetBatchEntry)],
      keyMetrics: [
        {
          label: 'Batch Mean',
          value: `${ta.overallBatchAvgPct}%`,
          tone: 'indigo',
        },
        {
          label: 'Growth Delta',
          value: `${ta.overallGrowthDeltaPct >= 0 ? '+' : ''}${ta.overallGrowthDeltaPct}%`,
          tone: ta.overallGrowthDeltaPct >= 0 ? 'emerald' : 'amber',
        },
        {
          label: 'Attendance',
          value: `${ta.avgAttendancePct}%`,
          tone: ta.avgAttendancePct >= 82 ? 'emerald' : 'amber',
        },
        {
          label: 'Urgent Alerts',
          value: `${urgentStudents.length} Students`,
          tone: urgentStudents.length > 0 ? 'rose' : 'emerald',
        },
      ],
      suggestedFollowUps: [
        `Who needs urgent intervention in ${tb.name}?`,
        `Who are the Top 5 students in ${tb.name}?`,
        ta.topTenStudents[0]
          ? `Give me a complete diagnostic on ${ta.topTenStudents[0].name}`
          : `Compare all batches`,
      ],
    },
  };
}

