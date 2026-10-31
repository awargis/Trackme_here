import { eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  batches,
  practiceQuestions,
  queuedReports,
  students,
} from './schema.ts';
import type {
  BatchRecord,
  BatchTestMeta,
  MonthlyAttendanceRecord,
  PracticeQuestion,
  QueuedReport,
  StudentRecord,
  SubjectName,
  TestAttempt,
  TopicScore,
  UploadCategory,
  UploadedStudentRow,
} from '../types/academic.ts';
import {
  INITIAL_BATCHES,
  PRACTICE_QUESTION_BANK,
} from '../data/seedBatches.ts';
import {
  convertUploadedRowsToStudents,
  enrichStudentSummaryFromAttempts,
  formatCoachingDate,
  mergeExistingStudentWithRow,
  recalculateBatchRanks,
  sanitizeTestAttemptScaleAndDate,
} from '../utils/analyticsEngine.ts';

let seedPromise: Promise<void> | null = null;

function sanitizeBatchTestsMeta(tests: BatchTestMeta[]): BatchTestMeta[] {
  return (tests || []).map((t) => {
    let maxMarks = Number(t.maxMarks) || 300;
    if (maxMarks > 1000 && maxMarks % 100 === 0 && maxMarks / 100 <= 1000) {
      maxMarks = Math.round(maxMarks / 100);
    }
    const testDate = t.testDate ? formatCoachingDate(String(t.testDate)) || t.testDate : t.testDate;
    return {
      ...t,
      maxMarks,
      testDate,
    };
  });
}

function mapRowToStudent(row: typeof students.$inferSelect): StudentRecord {
  const rawAttempts = (JSON.parse(row.testAttemptsJson) as TestAttempt[]).map((rawAtt) => {
    const att = sanitizeTestAttemptScaleAndDate(rawAtt);
    if (att.appeared === false || !att.subjectScores || att.subjectScores.length < 3) {
      return att;
    }
    const maxMarks = Number(att.maxMarks) || 300;
    const subMax = Math.round(maxMarks / 3);
    const s0 = Math.min(subMax, Math.max(0, Math.round(Number(att.subjectScores[0]?.marksObtained) || 0)));
    const s1 = Math.min(subMax, Math.max(0, Math.round(Number(att.subjectScores[1]?.marksObtained) || 0)));
    const targetTotal = Math.round(Number(att.totalMarks) || s0 + s1 + (Number(att.subjectScores[2]?.marksObtained) || 0));
    const s2 = Math.min(subMax, Math.max(0, targetTotal - s0 - s1));
    const exactTotal = s0 + s1 + s2;
    return {
      ...att,
      totalMarks: exactTotal,
      maxMarks,
      percentage: Number(((exactTotal / maxMarks) * 100).toFixed(2)),
      subjectScores: [
        {
          ...att.subjectScores[0],
          marksObtained: s0,
          maxMarks: subMax,
          percentage: Number(((s0 / subMax) * 100).toFixed(2)),
        },
        {
          ...att.subjectScores[1],
          marksObtained: s1,
          maxMarks: subMax,
          percentage: Number(((s1 / subMax) * 100).toFixed(2)),
        },
        {
          ...att.subjectScores[2],
          marksObtained: s2,
          maxMarks: subMax,
          percentage: Number(((s2 / subMax) * 100).toFixed(2)),
        },
      ],
    };
  });

  return enrichStudentSummaryFromAttempts({
    id: row.id,
    regNo: row.regNo,
    name: row.name,
    batchId: row.batchId,
    batchName: row.batchName,
    stream: row.stream as StudentRecord['stream'],
    parentName: row.parentName,
    parentEmail: row.parentEmail,
    parentPhone: row.parentPhone,
    classTeacherName: row.classTeacherName,
    classTeacherEmail: row.classTeacherEmail,
    attendancePct: Number(row.attendancePct),
    monthlyAttendance: JSON.parse(row.monthlyAttendanceJson) as MonthlyAttendanceRecord[],
    testAttempts: rawAttempts,
    topicScores: JSON.parse(row.topicScoresJson) as TopicScore[],
    overallAvgPct: Number(row.overallAvgPct),
    latestTestPct: Number(row.latestTestPct),
    growthDeltaPct: Number(row.growthDeltaPct),
    rankInBatch: Number(row.rankInBatch),
    batchPercentile: Number(row.batchPercentile),
    interventionStatus: row.interventionStatus as StudentRecord['interventionStatus'],
    interventionReasons: JSON.parse(row.interventionReasonsJson) as string[],
  });
}

function mapStudentToRow(student: StudentRecord): typeof students.$inferInsert {
  return {
    id: student.id,
    regNo: student.regNo.trim().toUpperCase(),
    name: student.name,
    batchId: student.batchId,
    batchName: student.batchName,
    stream: student.stream,
    parentName: student.parentName,
    parentEmail: student.parentEmail,
    parentPhone: student.parentPhone,
    classTeacherName: student.classTeacherName,
    classTeacherEmail: student.classTeacherEmail,
    attendancePct: student.attendancePct,
    monthlyAttendanceJson: JSON.stringify(student.monthlyAttendance),
    testAttemptsJson: JSON.stringify(student.testAttempts),
    topicScoresJson: JSON.stringify(student.topicScores),
    overallAvgPct: student.overallAvgPct,
    latestTestPct: student.latestTestPct,
    growthDeltaPct: student.growthDeltaPct,
    rankInBatch: student.rankInBatch,
    batchPercentile: student.batchPercentile,
    interventionStatus: student.interventionStatus,
    interventionReasonsJson: JSON.stringify(student.interventionReasons),
  };
}

function mapRowToQuestion(row: typeof practiceQuestions.$inferSelect): PracticeQuestion {
  return {
    id: row.id,
    topicName: row.topicName,
    subject: row.subject as SubjectName,
    difficulty: row.difficulty as PracticeQuestion['difficulty'],
    expectedMinutes: Number(row.expectedMinutes),
    questionText: row.questionText,
    options: JSON.parse(row.optionsJson) as [string, string, string, string],
    correctIndex: Number(row.correctIndex),
    hint: row.hint,
    solutionSteps: JSON.parse(row.solutionStepsJson) as string[],
  };
}

function mapRowToReport(row: typeof queuedReports.$inferSelect): QueuedReport {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.studentName,
    regNo: row.regNo,
    batchId: row.batchId,
    batchName: row.batchName,
    recipientType: row.recipientType as QueuedReport['recipientType'],
    recipientName: row.recipientName,
    recipientEmail: row.recipientEmail,
    recipientPhone: row.recipientPhone,
    overallAvgPct: Number(row.overallAvgPct),
    attendancePct: Number(row.attendancePct),
    rankInBatch: Number(row.rankInBatch),
    weakTopics: JSON.parse(row.weakTopicsJson) as string[],
    recommendedQuestionsCount: Number(row.recommendedQuestionsCount),
    teacherRemarks: row.teacherRemarks,
    requestedBy: row.requestedBy,
    createdAt: row.createdAt,
    status: row.status as QueuedReport['status'],
    ...(row.approvedBy ? { approvedBy: row.approvedBy } : {}),
    ...(row.dispatchedAt ? { dispatchedAt: row.dispatchedAt } : {}),
    ...(row.adminNote ? { adminNote: row.adminNote } : {}),
  };
}

async function seedDatabaseIfEmpty(): Promise<void> {
  try {
    const questionValues: (typeof practiceQuestions.$inferInsert)[] =
      PRACTICE_QUESTION_BANK.map((q) => ({
        id: q.id,
        topicName: q.topicName,
        subject: q.subject,
        difficulty: q.difficulty,
        expectedMinutes: q.expectedMinutes,
        questionText: q.questionText,
        optionsJson: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        hint: q.hint,
        solutionStepsJson: JSON.stringify(q.solutionSteps),
      }));
    if (questionValues.length > 0) {
      await db.insert(practiceQuestions).values(questionValues).onConflictDoNothing();
    }
  } catch (error) {
    console.error('Database error in seedDatabaseIfEmpty:', error);
    throw new Error('Failed to initialize academic database', { cause: error });
  }
}

export async function clearAllAcademicDataInDb(): Promise<void> {
  try {
    await db.delete(queuedReports);
    await db.delete(students);
    await db.delete(batches);
  } catch (error) {
    console.error('Database error in clearAllAcademicDataInDb:', error);
    throw new Error('Failed to clear academic tables in Cloud SQL PostgreSQL', {
      cause: error,
    });
  }
}

export async function ensureSeededAndGetBootstrapData(): Promise<{
  batches: BatchRecord[];
  questionBank: PracticeQuestion[];
  reports: QueuedReport[];
}> {
  try {
    if (!seedPromise) {
      seedPromise = seedDatabaseIfEmpty().finally(() => {
        seedPromise = null;
      });
    }
    await seedPromise;

    const [batchRows, studentRows, questionRows, reportRows] = await Promise.all([
      db.select().from(batches),
      db.select().from(students),
      db.select().from(practiceQuestions),
      db.select().from(queuedReports),
    ]);

    const studentsByBatch = new Map<string, StudentRecord[]>();
    for (const sRow of studentRows) {
      const mapped = mapRowToStudent(sRow);
      const list = studentsByBatch.get(mapped.batchId) || [];
      list.push(mapped);
      studentsByBatch.set(mapped.batchId, list);
    }

    const defaultBatchOrder = ['batch-jee-2027', 'batch-neet-2027', 'batch-oly-2027'];
    const reconstructedBatches: BatchRecord[] = batchRows
      .map((bRow) => {
        const bStudents = recalculateBatchRanks(studentsByBatch.get(bRow.id) || []);
        return {
          id: bRow.id,
          name: bRow.name,
          code: bRow.code,
          stream: bRow.stream as BatchRecord['stream'],
          academicYear: bRow.academicYear,
          leadFaculty: bRow.leadFaculty,
          subjects: JSON.parse(bRow.subjectsJson) as SubjectName[],
          tests: sanitizeBatchTestsMeta(JSON.parse(bRow.testsJson) as BatchTestMeta[]),
          students: bStudents,
        };
      })
      .sort((a, b) => {
        const isDefaultA = defaultBatchOrder.indexOf(a.id);
        const isDefaultB = defaultBatchOrder.indexOf(b.id);
        if (isDefaultA === -1 && isDefaultB !== -1) return -1;
        if (isDefaultA !== -1 && isDefaultB === -1) return 1;
        if (isDefaultA !== -1 && isDefaultB !== -1) return isDefaultA - isDefaultB;
        return a.name.localeCompare(b.name);
      });

    const mappedQuestions = questionRows.map(mapRowToQuestion);
    const mappedReports = reportRows
      .map(mapRowToReport)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      batches: reconstructedBatches,
      questionBank: mappedQuestions,
      reports: mappedReports,
    };
  } catch (error) {
    console.error('Database error in ensureSeededAndGetBootstrapData:', error);
    throw new Error('Failed to load academic data from Cloud SQL PostgreSQL', {
      cause: error,
    });
  }
}

function buildDynamicBatchFromUpload(
  batchName: string,
  sampleRows: UploadedStudentRow[]
): BatchRecord {
  const cleanName = batchName.trim() || 'Uploaded Coaching Batch';
  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const batchId = `batch-${slug || 'custom'}`;
  const rawStream = sampleRows.find((r) => r.classStream)?.classStream || '12 JEE';
  const isBio = /neet|bio|med/i.test(rawStream);
  const streamLabel = isBio
    ? `${rawStream} (PCB)`
    : /jee/i.test(rawStream)
    ? `${rawStream} (PCM)`
    : `${rawStream} Integrated`;
  const subjects = isBio
    ? ['Physics', 'Chemistry', 'Biology']
    : ['Physics', 'Chemistry', 'Mathematics'];
  const centerInfo = sampleRows.find((r) => r.centerName)?.centerName;
  const regionInfo = sampleRows.find((r) => r.regionName)?.regionName;
  const leadFaculty = centerInfo
    ? `${centerInfo}${regionInfo ? ` (${regionInfo})` : ''} Academic Desk`
    : 'Prof. Raghavendra Kulkarni (Academic Desk)';

  // Build batch test metadata from the union of all parsedTestAttempts across sampleRows in this batch
  const testMap = new Map<string, BatchTestMeta>();
  for (const row of sampleRows) {
    for (const [idx, att] of (row.parsedTestAttempts || []).entries()) {
      const tId = att.testId || `test-${idx + 1}`;
      if (!testMap.has(tId)) {
        testMap.set(tId, {
          testId: tId,
          testName: att.testName || `Milestone Assessment ${idx + 1}`,
          testDate: att.testDate || `Test ${idx + 1}`,
          maxMarks: att.maxMarks || 300,
          testType: att.testType || 'Main',
          syllabusFocus: `${streamLabel} Cumulative Evaluation`,
        });
      }
    }
  }

  const tests: BatchTestMeta[] =
    testMap.size > 0 ? Array.from(testMap.values()) : INITIAL_BATCHES[0].tests;

  return {
    id: batchId,
    name: cleanName,
    code: cleanName.toUpperCase().slice(0, 16),
    stream: streamLabel,
    academicYear: '2026–2027',
    leadFaculty,
    subjects,
    tests,
    students: [],
  };
}

export async function upsertStudentsByRegNo(
  targetBatchId: string,
  incomingRows: UploadedStudentRow[],
  uploadCategory: UploadCategory = 'combined'
): Promise<{
  batches: BatchRecord[];
  primaryBatchId: string;
  insertedCount: number;
  mergedCount: number;
}> {
  try {
    await seedDatabaseIfEmpty();

    const [allBatchRows, allStudentRows] = await Promise.all([
      db.select().from(batches),
      db.select().from(students),
    ]);

    const batchMapById = new Map<string, BatchRecord>();
    const batchIdByNormName = new Map<string, string>();

    for (const bRow of allBatchRows) {
      const bRec: BatchRecord = {
        id: bRow.id,
        name: bRow.name,
        code: bRow.code,
        stream: bRow.stream,
        academicYear: bRow.academicYear,
        leadFaculty: bRow.leadFaculty,
        subjects: JSON.parse(bRow.subjectsJson) as string[],
        tests: sanitizeBatchTestsMeta(JSON.parse(bRow.testsJson) as BatchTestMeta[]),
        students: [],
      };
      batchMapById.set(bRec.id, bRec);
      batchIdByNormName.set(bRec.name.trim().toLowerCase(), bRec.id);
      batchIdByNormName.set(bRec.code.trim().toLowerCase(), bRec.id);
    }

    // Track existing students strictly per batch (never merge or move students across different batches)
    const studentsByBatchId = new Map<string, Map<string, StudentRecord>>();

    for (const sRow of allStudentRows) {
      const stu = mapRowToStudent(sRow);
      const normReg = stu.regNo.trim().toUpperCase();
      const bMap = studentsByBatchId.get(stu.batchId) || new Map<string, StudentRecord>();
      bMap.set(normReg, stu);
      studentsByBatchId.set(stu.batchId, bMap);
    }

    // Group incoming rows by destination batchId — ALWAYS respect row.batchName when present
    // so LJ121 students are strictly isolated in LJ121 and AJ221EA students in AJ221EA
    const rowsByBatchId = new Map<string, UploadedStudentRow[]>();
    const newBatchesToInsert: BatchRecord[] = [];

    for (const row of incomingRows) {
      const normReg = (row.regNo || '').trim().toUpperCase();
      if (!normReg) continue;

      const rawBatchName = (row.batchName || '').trim();
      let destBatchId = targetBatchId;

      if (rawBatchName) {
        const existingMatchId = batchIdByNormName.get(rawBatchName.toLowerCase());
        if (existingMatchId) {
          destBatchId = existingMatchId;
        } else {
          const dynamicBatch = buildDynamicBatchFromUpload(
            rawBatchName,
            incomingRows.filter(
              (r) => (r.batchName || '').trim().toLowerCase() === rawBatchName.toLowerCase()
            )
          );
          if (!batchMapById.has(dynamicBatch.id)) {
            batchMapById.set(dynamicBatch.id, dynamicBatch);
            newBatchesToInsert.push(dynamicBatch);
          }
          batchIdByNormName.set(rawBatchName.toLowerCase(), dynamicBatch.id);
          batchIdByNormName.set(dynamicBatch.code.toLowerCase(), dynamicBatch.id);
          destBatchId = dynamicBatch.id;
        }
      } else if (
        destBatchId === '__auto_from_file__' ||
        !batchMapById.has(destBatchId)
      ) {
        const fallbackBatch = buildDynamicBatchFromUpload(
          'Uploaded Coaching Batch',
          incomingRows
        );
        if (!batchMapById.has(fallbackBatch.id)) {
          batchMapById.set(fallbackBatch.id, fallbackBatch);
          newBatchesToInsert.push(fallbackBatch);
        }
        destBatchId = fallbackBatch.id;
      }

      const list = rowsByBatchId.get(destBatchId) || [];
      list.push({ ...row, regNo: normReg });
      rowsByBatchId.set(destBatchId, list);
    }

    // Insert any newly discovered batches into Cloud SQL PostgreSQL first
    if (newBatchesToInsert.length > 0) {
      const newBatchDbRows: (typeof batches.$inferInsert)[] = newBatchesToInsert.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        stream: b.stream,
        academicYear: b.academicYear,
        leadFaculty: b.leadFaculty,
        subjectsJson: JSON.stringify(b.subjects),
        testsJson: JSON.stringify(b.tests),
      }));

      await db
        .insert(batches)
        .values(newBatchDbRows)
        .onConflictDoUpdate({
          target: batches.id,
          set: {
            name: sql`excluded.name`,
            stream: sql`excluded.stream`,
            leadFaculty: sql`excluded.lead_faculty`,
            subjectsJson: sql`excluded.subjects_json`,
            testsJson: sql`excluded.tests_json`,
          },
        });
    }

    let insertedCount = 0;
    let mergedCount = 0;
    const allStudentRowsToUpsert = new Map<string, typeof students.$inferInsert>();
    let firstTouchedBatchId = targetBatchId;
    let assignedFirstBatch = false;

    for (const [bId, batchIncomingRows] of rowsByBatchId.entries()) {
      if (!assignedFirstBatch) {
        firstTouchedBatchId = bId;
        assignedFirstBatch = true;
      }
      const targetBatch =
        batchMapById.get(bId) ||
        buildDynamicBatchFromUpload(bId.replace(/^batch-/, ''), batchIncomingRows);

      const batchStudentMap =
        studentsByBatchId.get(bId) || new Map<string, StudentRecord>();

      for (const row of batchIncomingRows) {
        const normReg = row.regNo.trim().toUpperCase();
        const existingInBatch = batchStudentMap.get(normReg);

        if (existingInBatch) {
          const merged = mergeExistingStudentWithRow(
            existingInBatch,
            row,
            targetBatch,
            uploadCategory
          );
          merged.id = existingInBatch.id;
          batchStudentMap.set(normReg, merged);
          mergedCount += 1;
        } else {
          const created = convertUploadedRowsToStudents([row], targetBatch)[0];
          batchStudentMap.set(normReg, created);
          insertedCount += 1;
        }
      }

      // Build complete union of tests across all students in this batch
      const batchTestMap = new Map<string, BatchTestMeta>();
      for (const st of batchStudentMap.values()) {
        for (const [idx, att] of (st.testAttempts || []).entries()) {
          const tId = att.testId || `test-${idx + 1}`;
          if (!batchTestMap.has(tId)) {
            batchTestMap.set(tId, {
              testId: tId,
              testName: att.testName || `Assessment ${idx + 1}`,
              testDate: att.testDate || `Test ${idx + 1}`,
              maxMarks: att.maxMarks || 300,
              testType: att.testType || 'Main',
              syllabusFocus: `${targetBatch.stream} Cumulative Evaluation`,
            });
          }
        }
      }

      if (batchTestMap.size > 0) {
        const updatedTests = Array.from(batchTestMap.values());
        targetBatch.tests = updatedTests;
        await db
          .update(batches)
          .set({ testsJson: JSON.stringify(updatedTests) })
          .where(eq(batches.id, bId));
      }

      studentsByBatchId.set(bId, batchStudentMap);
      const reranked = recalculateBatchRanks(Array.from(batchStudentMap.values()));
      for (const stu of reranked) {
        allStudentRowsToUpsert.set(stu.id, mapStudentToRow(stu));
      }
    }

    // Upsert in safe chunks of 100 students per SQL query conflicting on batch-scoped primary key id
    const deduplicatedValues = Array.from(allStudentRowsToUpsert.values());
    const CHUNK_SIZE = 100;
    for (let i = 0; i < deduplicatedValues.length; i += CHUNK_SIZE) {
      const chunk = deduplicatedValues.slice(i, i + CHUNK_SIZE);
      await db
        .insert(students)
        .values(chunk)
        .onConflictDoUpdate({
          target: students.id,
          set: {
            regNo: sql`excluded.reg_no`,
            name: sql`excluded.name`,
            batchId: sql`excluded.batch_id`,
            batchName: sql`excluded.batch_name`,
            stream: sql`excluded.stream`,
            parentName: sql`excluded.parent_name`,
            parentEmail: sql`excluded.parent_email`,
            parentPhone: sql`excluded.parent_phone`,
            classTeacherName: sql`excluded.class_teacher_name`,
            classTeacherEmail: sql`excluded.class_teacher_email`,
            attendancePct: sql`excluded.attendance_pct`,
            monthlyAttendanceJson: sql`excluded.monthly_attendance_json`,
            testAttemptsJson: sql`excluded.test_attempts_json`,
            topicScoresJson: sql`excluded.topic_scores_json`,
            overallAvgPct: sql`excluded.overall_avg_pct`,
            latestTestPct: sql`excluded.latest_test_pct`,
            growthDeltaPct: sql`excluded.growth_delta_pct`,
            rankInBatch: sql`excluded.rank_in_batch`,
            batchPercentile: sql`excluded.batch_percentile`,
            interventionStatus: sql`excluded.intervention_status`,
            interventionReasonsJson: sql`excluded.intervention_reasons_json`,
            updatedAt: new Date(),
          },
        });
    }

    const freshBootstrap = await ensureSeededAndGetBootstrapData();

    return {
      batches: freshBootstrap.batches,
      primaryBatchId: firstTouchedBatchId,
      insertedCount,
      mergedCount,
    };
  } catch (error) {
    console.error('Database error in upsertStudentsByRegNo:', error);
    throw new Error('Failed to upsert student records into Cloud SQL PostgreSQL', {
      cause: error,
    });
  }
}

export async function createQueuedReportInDb(
  report: QueuedReport
): Promise<QueuedReport> {
  try {
    await db
      .insert(queuedReports)
      .values({
        id: report.id,
        studentId: report.studentId,
        studentName: report.studentName,
        regNo: report.regNo,
        batchId: report.batchId,
        batchName: report.batchName,
        recipientType: report.recipientType,
        recipientName: report.recipientName,
        recipientEmail: report.recipientEmail,
        recipientPhone: report.recipientPhone,
        overallAvgPct: report.overallAvgPct,
        attendancePct: report.attendancePct,
        rankInBatch: report.rankInBatch,
        weakTopicsJson: JSON.stringify(report.weakTopics),
        recommendedQuestionsCount: report.recommendedQuestionsCount,
        teacherRemarks: report.teacherRemarks,
        requestedBy: report.requestedBy,
        createdAt: report.createdAt,
        status: report.status,
        approvedBy: report.approvedBy ?? null,
        dispatchedAt: report.dispatchedAt ?? null,
        adminNote: report.adminNote ?? null,
      })
      .onConflictDoNothing();

    return report;
  } catch (error) {
    console.error('Database error in createQueuedReportInDb:', error);
    throw new Error('Failed to save report to PostgreSQL', { cause: error });
  }
}

export async function updateQueuedReportStatusInDb(
  reportId: string,
  patch: {
    status: QueuedReport['status'];
    approvedBy?: string;
    dispatchedAt?: string;
    adminNote?: string;
  }
): Promise<void> {
  try {
    await db
      .update(queuedReports)
      .set({
        status: patch.status,
        ...(patch.approvedBy !== undefined ? { approvedBy: patch.approvedBy } : {}),
        ...(patch.dispatchedAt !== undefined ? { dispatchedAt: patch.dispatchedAt } : {}),
        ...(patch.adminNote !== undefined ? { adminNote: patch.adminNote } : {}),
      })
      .where(eq(queuedReports.id, reportId));
  } catch (error) {
    console.error('Database error in updateQueuedReportStatusInDb:', error);
    throw new Error('Failed to update report status in PostgreSQL', { cause: error });
  }
}

export async function approveAllPendingReportsInDb(
  approvedBy: string,
  dispatchedAt: string
): Promise<void> {
  try {
    await db
      .update(queuedReports)
      .set({
        status: 'Approved & Sent',
        approvedBy,
        dispatchedAt,
      })
      .where(eq(queuedReports.status, 'Pending Approval'));
  } catch (error) {
    console.error('Database error in approveAllPendingReportsInDb:', error);
    throw new Error('Failed to bulk-approve reports in PostgreSQL', { cause: error });
  }
}
