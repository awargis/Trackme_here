import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyImportedRowsLocally,
  buildAcademicAgentContextAndFallback,
  computeBatchAnalytics,
  convertUploadedRowsToStudents,
  evaluateInterventionStatus,
  getStudentWeakTopicDiagnostics,
  mergeExistingStudentWithRow,
  normalizeSmartExcelRows,
  parseDelimitedOrPdfTextToRows,
  resolveLookupQuery,
} from './analyticsEngine.ts';
import { INITIAL_BATCHES, PRACTICE_QUESTION_BANK } from '../data/seedBatches.ts';

test('resolveLookupQuery resolves student by exact Registration Number and Batch Name', () => {
  const res = resolveLookupQuery(INITIAL_BATCHES, 'REG-2027-101', 'Apex JEE-Adv 2027');
  assert.equal(res.mode, 'student');
  assert.equal(res.matchedStudent?.name, 'Aarav Mehta');
  assert.equal(res.matchedBatch?.id, 'batch-jee-2027');
});

test('resolveLookupQuery resolves student by partial Student Name across batches', () => {
  const res = resolveLookupQuery(INITIAL_BATCHES, 'Zoya Merchant', '');
  assert.equal(res.mode, 'student');
  assert.equal(res.matchedStudent?.regNo, 'REG-2027-201');
  assert.equal(res.matchedBatch?.name, 'Vanguard NEET-Med 2027');
});

test('resolveLookupQuery returns batch mode when teacher enters only Batch Name', () => {
  const res = resolveLookupQuery(INITIAL_BATCHES, '', 'Apex JEE-Adv 2027');
  assert.equal(res.mode, 'batch');
  assert.equal(res.matchedBatch?.id, 'batch-jee-2027');
});

test('computeBatchAnalytics computes Top 10, Bottom 10, Intervention list, and longitudinal growth', () => {
  const jeeBatch = INITIAL_BATCHES.find((b) => b.id === 'batch-jee-2027')!;
  const summary = computeBatchAnalytics(jeeBatch);

  assert.equal(summary.totalStudents, 16);
  assert.equal(summary.topTenStudents.length, 10);
  assert.equal(summary.bottomTenStudents.length, 10);
  assert.ok(summary.topTenStudents[0].overallAvgPct > summary.topTenStudents[9].overallAvgPct);
  assert.ok(
    summary.bottomTenStudents[0].overallAvgPct < summary.bottomTenStudents[9].overallAvgPct
  );
  assert.ok(summary.interventionStudents.length >= 4);
  assert.equal(summary.longitudinalSeries.length, 6);
  assert.ok(summary.overallGrowthDeltaPct > 0);
  assert.ok((summary.longitudinalSeries[0].avgMarksObtained ?? 0) > 0);
  assert.ok((summary.longitudinalSeries[0].physicsAvgPct ?? 0) > 0);
  assert.ok((summary.longitudinalSeries[0].chemistryAvgPct ?? 0) > 0);
  assert.ok((summary.longitudinalSeries[0].mathOrBioAvgPct ?? 0) > 0);
  assert.ok(summary.longitudinalSeries[0].dateLabel?.includes('CT-01'));
  assert.ok(summary.longitudinalSeries[0].difficultyLabel);
  assert.ok((summary.longitudinalSeries[0].difficultyIndex ?? 0) > 0);
  assert.ok((summary.longitudinalSeries[0].scoreSpreadStdDev ?? 0) > 0);
  assert.ok(summary.longitudinalSeries[0].hardestSubject?.name);
  assert.ok(summary.longitudinalSeries[0].topOutlier?.name);
  assert.ok(summary.longitudinalSeries[0].bottomOutlier?.name);
  assert.ok(
    (summary.longitudinalSeries[0].topOutlier?.pct ?? 0) >
      (summary.longitudinalSeries[0].bottomOutlier?.pct ?? 0)
  );
  assert.ok(summary.longitudinalSeries[1].momentumOutlier?.name);
});

test('getStudentWeakTopicDiagnostics pairs weak topics with targeted practice questions', () => {
  const jeeBatch = INITIAL_BATCHES.find((b) => b.id === 'batch-jee-2027')!;
  const student = jeeBatch.students[0]; // Aarav Mehta
  const diagnostics = getStudentWeakTopicDiagnostics(student, PRACTICE_QUESTION_BANK);

  assert.ok(diagnostics.weakTopics.length >= 1);
  assert.ok(diagnostics.weakTopics[0].recommendedQuestions.length >= 1);
  assert.equal(
    diagnostics.weakTopics[0].recommendedQuestions[0].topicName,
    diagnostics.weakTopics[0].topicName
  );
});

test('evaluateInterventionStatus flags low attendance or sharp test drop as Urgent Intervention', () => {
  const urgent = evaluateInterventionStatus(52.0, -9.5, 71.0, 48.0);
  assert.equal(urgent.status, 'Urgent Intervention');
  assert.ok(urgent.reasons.length >= 2);

  const optimal = evaluateInterventionStatus(88.5, 8.2, 95.0, 91.0);
  assert.equal(optimal.status, 'Optimal');
});

test('parseDelimitedOrPdfTextToRows and convertUploadedRowsToStudents ingest CSV/PDF lines cleanly', () => {
  const jeeBatch = INITIAL_BATCHES.find((b) => b.id === 'batch-jee-2027')!;
  const sampleCsv = [
    'RegNo,Name,Batch,Attendance,T1,T2,T3,T4,T5,T6,Physics,Chemistry,Math,WeakTopics',
    'REG-2027-901,Rohan Kulkarni,Apex JEE-Adv 2027,92,74,76,79,82,85,88,86,82,90,Rotational Dynamics;Electrochemistry',
  ].join('\n');

  const parsedRows = parseDelimitedOrPdfTextToRows(sampleCsv, 'Apex JEE-Adv 2027');
  assert.equal(parsedRows.length, 1);
  assert.equal(parsedRows[0].name, 'Rohan Kulkarni');
  assert.equal(parsedRows[0].test6Pct, 88);

  const converted = convertUploadedRowsToStudents(parsedRows, jeeBatch);
  assert.equal(converted.length, 1);
  assert.equal(converted[0].regNo, 'REG-2027-901');
  assert.ok(converted[0].overallAvgPct > 80);
});

test('normalizeSmartExcelRows and mergeExistingStudentWithRow support non-destructive Attendance-Only and Result-Only merging by Reg No', () => {
  const batch = INITIAL_BATCHES.find((b) => b.id === 'batch-jee-2027')!;
  const existingStudent = batch.students[0]; // REG-2027-101, Aarav Mehta
  const originalOverallAvg = existingStudent.overallAvgPct;

  const attendanceExcelRaw = [
    {
      'Roll No': 'REG-2027-101',
      'Candidate Name': 'Aarav Mehta',
      'Classes Attended': 135,
      'Classes Held': 150,
    },
  ];
  const mappedAttendance = normalizeSmartExcelRows(
    attendanceExcelRaw,
    batch.name,
    'attendance_only'
  );
  assert.equal(mappedAttendance.length, 1);
  assert.equal(mappedAttendance[0].attendancePct, 90.0);

  const afterAttendanceMerge = mergeExistingStudentWithRow(
    existingStudent,
    mappedAttendance[0],
    batch,
    'attendance_only'
  );
  assert.equal(afterAttendanceMerge.attendancePct, 90.0);
  assert.equal(afterAttendanceMerge.overallAvgPct, originalOverallAvg);

  const resultsExcelRaw = [
    {
      RegNo: 'REG-2027-101',
      StudentName: 'Aarav Mehta',
      T1: 95,
      T2: 96,
      T3: 97,
      T4: 98,
      T5: 99,
      T6: 100,
      Phy: 99,
      Chem: 98,
      Math: 100,
    },
  ];
  const mappedResults = normalizeSmartExcelRows(
    resultsExcelRaw,
    batch.name,
    'results_only'
  );
  const afterResultsMerge = mergeExistingStudentWithRow(
    afterAttendanceMerge,
    mappedResults[0],
    batch,
    'results_only'
  );
  assert.equal(afterResultsMerge.attendancePct, 90.0);
  assert.equal(afterResultsMerge.latestTestPct, 100);
  assert.ok(afterResultsMerge.overallAvgPct > 96);
});

test('normalizeSmartExcelRows aggregates multi-row Milestone/AITS coaching test logs strictly by (Batch, Reg No) without mixing batches', () => {
  const multiRowCoachingLog = [
    {
      region: 'UP',
      combined_center: 'Varanasi Vidyapeeth',
      center: 'GD Global school (S-SIP)',
      'Reg No': '23273301',
      student_name: 'NAMAN RAJPUT',
      batch: 'S1A-LJ11M',
      class_stream: '12 JEE',
      test_date: '17 May 2026',
      test_name: 'Milestone:1',
      'Test Type': 'Main',
      'Out of': 300,
      Score: '',
    },
    {
      region: 'UP',
      combined_center: 'Varanasi Vidyapeeth',
      center: 'GD Global school (S-SIP)',
      'Reg No': '23273301',
      student_name: 'NAMAN RAJPUT',
      batch: 'S1A-LJ21W',
      class_stream: '12 JEE',
      test_date: '01 July 2026',
      test_name: 'Milestone-2',
      'Test Type': 'Main',
      'Out of': 144,
      Score: 81,
      'Avg. Score': 0.5625, // Raw Excel decimal for 56.25%
      'Avg. Physics': '35.42%',
      'Avg. Chemistry': '54.17%',
      'Avg. Maths': '79.17%',
      'Offline Rank': 8,
      'Regional Rank': 7,
      'Center Rank': 7,
    },
    {
      region: 'UP',
      combined_center: 'Varanasi Vidyapeeth',
      center: 'GD Global school (S-SIP)',
      'Reg No': '23273301',
      student_name: 'NAMAN RAJPUT',
      batch: 'S1A-LJ21W',
      class_stream: '12 JEE',
      test_date: '26 August 2026',
      test_name: 'Milestone-5',
      'Test Type': 'Main',
      'Out of': 144,
      Score: 37,
      'Avg. Score': '25.69%',
      'Avg. Physics': '25.00%',
      'Avg. Chemistry': '8.33%',
      'Avg. Maths': '43.75%',
      'Offline Rank': 10,
      'Regional Rank': 2,
      'Center Rank': 2,
    },
    {
      region: 'UP',
      combined_center: 'Varanasi Vidyapeeth',
      center: 'GD Global school (S-SIP)',
      'Reg No': '23273302',
      student_name: 'TRISHA MISHRA',
      batch: 'S1A-LJ21W',
      class_stream: '12 JEE',
      test_date: '17 May 2026',
      test_name: 'Milestone:1',
      'Out of': 300,
      Score: '',
    },
  ];

  const grouped = normalizeSmartExcelRows(multiRowCoachingLog, 'Apex JEE-Adv 2027', 'combined');
  // 1 record in S1A-LJ11M (23273301) and 2 records in S1A-LJ21W (23273301, 23273302)
  assert.equal(grouped.length, 3);

  const namanLj11m = grouped.find(
    (r) => r.regNo === '23273301' && r.batchName === 'S1A-LJ11M'
  )!;
  assert.ok(namanLj11m);
  assert.equal(namanLj11m.testsScheduled, 1);
  assert.equal(namanLj11m.testsAppeared, 0);

  const naman = grouped.find(
    (r) => r.regNo === '23273301' && r.batchName === 'S1A-LJ21W'
  )!;
  assert.equal(naman.batchName, 'S1A-LJ21W');
  assert.equal(naman.regionName, 'UP');
  assert.equal(naman.combinedCenterName, 'Varanasi Vidyapeeth');
  assert.equal(naman.centerName, 'GD Global school (S-SIP)');
  assert.equal(naman.testsScheduled, 2);
  assert.equal(naman.testsAppeared, 2);
  assert.equal(naman.totalMarksObtained, 118); // 81 + 37
  assert.equal(naman.totalMaxMarksAppeared, 288); // 144 + 144
  assert.equal(naman.totalMaxMarksScheduled, 288); // 144 + 144
  assert.equal(naman.test1Pct, 56.25);
  assert.equal(naman.test6Pct, 25.69);
  assert.equal(naman.parsedTestAttempts?.length, 2);
  assert.equal(naman.parsedTestAttempts?.[0].appeared, true);
  assert.equal(naman.parsedTestAttempts?.[0].totalMarks, 81);
  // Check exact subject marks in Milestone-2 (Out of 144 -> 48 per subject): 17 + 26 + 38 = 81
  assert.deepEqual(
    naman.parsedTestAttempts?.[0].subjectScores.map((s) => s.marksObtained),
    [17, 26, 38]
  );

  const trisha = grouped.find(
    (r) => r.regNo === '23273302' && r.batchName === 'S1A-LJ21W'
  )!;
  assert.equal(trisha.testsAppeared, 0);
  assert.equal(trisha.attendancePct, 0);

  const lj21wRows = grouped.filter((r) => r.batchName === 'S1A-LJ21W');
  const students = convertUploadedRowsToStudents(lj21wRows, INITIAL_BATCHES[0]);
  const namanRecord = students.find((s) => s.regNo === '23273301')!;
  assert.equal(namanRecord.totalMarksObtained, 118);
  assert.equal(namanRecord.bestOfflineRank, 8);
  assert.equal(namanRecord.bestRegionalRank, 2);
  assert.equal(namanRecord.bestCenterRank, 2);

  const trishaRecord = students.find((s) => s.regNo === '23273302')!;
  assert.equal(trishaRecord.overallAvgPct, 0);
  assert.equal(trishaRecord.interventionStatus, 'Urgent Intervention');
});

test('buildAcademicAgentContextAndFallback resolves student, batch, intervention, and cross-cohort queries accurately', () => {
  // 1. Student query by Name or Reg No
  const studentQuery = buildAcademicAgentContextAndFallback({
    query: 'Give me a complete diagnostic on Aarav Mehta (REG-2027-101)',
    batches: INITIAL_BATCHES,
    activeBatchId: INITIAL_BATCHES[0].id,
  });
  assert.ok(studentQuery.systemContext.includes('Aarav Mehta'));
  assert.equal(studentQuery.fallbackResponse.matchedStudents[0]?.name, 'Aarav Mehta');
  assert.equal(studentQuery.fallbackResponse.matchedStudents[0]?.regNo, 'REG-2027-101');
  assert.ok(studentQuery.fallbackResponse.reply.includes('Student Diagnostic Summary: Aarav Mehta'));
  assert.ok((studentQuery.fallbackResponse.keyMetrics?.length ?? 0) >= 3);

  // 2. Urgent intervention query for a specific batch
  const urgentQuery = buildAcademicAgentContextAndFallback({
    query: 'Which students need urgent intervention in Apex JEE-Adv 2027?',
    batches: INITIAL_BATCHES,
    activeBatchId: INITIAL_BATCHES[0].id,
  });
  assert.ok(urgentQuery.fallbackResponse.reply.includes('Intervention & Risk Triage'));
  assert.ok(urgentQuery.fallbackResponse.matchedStudents.length >= 1);
  assert.equal(
    urgentQuery.fallbackResponse.matchedStudents[0]?.interventionStatus,
    'Urgent Intervention'
  );

  // 3. Cross-batch comparison query
  const compareQuery = buildAcademicAgentContextAndFallback({
    query: 'Compare all batches across the institute',
    batches: INITIAL_BATCHES,
  });
  assert.ok(compareQuery.fallbackResponse.reply.includes('Cross-Cohort Executive Comparison'));
  assert.equal(compareQuery.fallbackResponse.matchedBatches.length, INITIAL_BATCHES.length);
});

test('100% Mathematical Consistency: every student test attempt sums subject marks to totalMarks and never inflates single-test uploads', () => {
  for (const batch of INITIAL_BATCHES) {
    for (const student of batch.students) {
      for (const att of student.testAttempts) {
        if (att.appeared === false) continue;
        const subjectSum = att.subjectScores.reduce((acc, s) => acc + s.marksObtained, 0);
        assert.equal(
          subjectSum,
          att.totalMarks,
          `Subject sum (${subjectSum}) !== totalMarks (${att.totalMarks}) for ${student.name} in ${att.testName}`
        );
        const expectedPct = Number(((att.totalMarks / att.maxMarks) * 100).toFixed(2));
        assert.equal(att.percentage, expectedPct);
      }
    }
  }

  // Verify all 5 students in S1A-LJ21W match image_43ea42d8.png with 100% mathematical accuracy
  const coachingBatch = INITIAL_BATCHES.find((b) => b.id === 'batch-s1a-lj21w')!;
  assert.ok(coachingBatch);
  assert.equal(coachingBatch.students.length, 5);
  assert.equal(coachingBatch.tests.length, 6);

  const naman = coachingBatch.students.find((s) => s.regNo === '23273301')!;
  assert.equal(naman.latestMarksObtained, 37);
  assert.equal(naman.latestMaxMarks, 144);
  assert.equal(naman.bestMarksObtained, 81);
  assert.equal(naman.bestMaxMarks, 144);
  assert.equal(naman.overallAvgPct, 36.34);

  const yash = coachingBatch.students.find((s) => s.regNo === '23291335')!;
  assert.equal(yash.latestMarksObtained, 13);
  assert.equal(yash.latestMaxMarks, 144);
  assert.equal(yash.bestMarksObtained, 90);
  assert.equal(yash.bestMaxMarks, 144);

  const abhyuday = coachingBatch.students.find((s) => s.regNo === '23291336')!;
  assert.equal(abhyuday.latestMarksObtained, 34);
  assert.equal(abhyuday.latestMaxMarks, 144);
  assert.equal(abhyuday.bestMarksObtained, 98);
  assert.equal(abhyuday.bestMaxMarks, 144);

  const aryan = coachingBatch.students.find((s) => s.regNo === '23291337')!;
  assert.equal(aryan.latestMarksObtained, 12);
  assert.equal(aryan.latestMaxMarks, 144);
  assert.equal(aryan.bestMarksObtained, 81);
  assert.equal(aryan.bestMaxMarks, 144);
});

test('Regression: 21-AJ221EA Excel rows with %-formatted Out of (30000%) / Score (24200%) and serial dates (46187) normalize to 242 / 300 and 14 June 2026', () => {
  const aj221Rows = [
    {
      'Reg No': '21AJ001',
      student_name: 'ADITYA VERMA',
      batch: '21-AJ221EA',
      class_stream: '12 JEE',
      test_date: 46187,
      test_name: 'Milestone:1',
      'Test Type': 'Main',
      'Out of': '30000%',
      Score: '24200%',
      'Avg. Score': '80.70%',
      'Avg. Physics': '80.00%',
      'Avg. Chemistry': '86.00%',
      'Avg. Maths': '76.00%',
    },
    {
      'Reg No': '21AJ001',
      student_name: 'ADITYA VERMA',
      batch: '21-AJ221EA',
      class_stream: '12 JEE',
      test_date: 46229,
      test_name: 'VP AIR Part Test: 3',
      'Test Type': 'Main',
      'Out of': 30000,
      Score: 16100,
      'Avg. Score': '53.70%',
      'Avg. Physics': '63.00%',
      'Avg. Chemistry': '52.00%',
      'Avg. Maths': '46.00%',
    },
    {
      'Reg No': '21AJ001',
      student_name: 'ADITYA VERMA',
      batch: '21-AJ221EA',
      class_stream: '12 JEE',
      test_date: '46229',
      test_name: 'VP AIR Part Test: 3 Advanced (Paper1)',
      'Test Type': 'Advanced',
      'Out of': '18000%',
      Score: '3700%',
      'Avg. Score': '20.60%',
      'Avg. Physics': '0.00%',
      'Avg. Chemistry': '45.00%',
      'Avg. Maths': '16.67%',
    },
  ];

  const normalized = normalizeSmartExcelRows(aj221Rows, '21-AJ221EA', 'combined');
  assert.equal(normalized.length, 1);
  const attempts = normalized[0].parsedTestAttempts!;
  assert.equal(attempts.length, 3);

  // Test 1: 242 / 300 (never 24200 / 30000), Physics 80 / 100 (never 8000 / 10000), date 14 June 2026
  assert.equal(attempts[0].totalMarks, 242);
  assert.equal(attempts[0].maxMarks, 300);
  assert.equal(attempts[0].testDate, '14 June 2026');
  assert.equal(attempts[0].subjectScores[0].marksObtained, 80);
  assert.equal(attempts[0].subjectScores[0].maxMarks, 100);

  // Test 2: 161 / 300, date 26 July 2026
  assert.equal(attempts[1].totalMarks, 161);
  assert.equal(attempts[1].maxMarks, 300);
  assert.equal(attempts[1].testDate, '26 July 2026');

  // Test 3: 37 / 180 (never 3700 / 18000), Physics 0 / 60
  assert.equal(attempts[2].totalMarks, 37);
  assert.equal(attempts[2].maxMarks, 180);
  assert.equal(attempts[2].subjectScores[0].marksObtained, 0);
  assert.equal(attempts[2].subjectScores[0].maxMarks, 60);
});

test('Regression: Anansh Kumar (22535651) and Harshit Singh (22594664) in 21-AJ221EA never show 100x inflated scores (12600/30000 -> 126/300) or 100x inflated ranks (#6300/#300/#300 -> #63/#3/#3)', () => {
  const bhuRows = [
    {
      center: 'Varanasi - BHU Vidyapeeth',
      'Reg No': '22594664',
      student_name: 'Harshit Singh',
      batch: '21-AJ221EA',
      test_date: 46187,
      test_name: 'Milestone:1 (Main)',
      'Out of': '30000%',
      Score: '22900%',
      'Avg. Score': '76.33%',
      'Offline Rank': '600%',
      'Regional Rank': '100%',
      'Center Rank': '100%',
    },
    {
      center: 'Varanasi - BHU Vidyapeeth',
      'Reg No': '22535651',
      student_name: 'Anansh Kumar',
      batch: '21-AJ221EA',
      test_date: 46264,
      test_name: 'Milestone:6 (Main)',
      'Out of': 30000,
      Score: 12600,
      'Avg. Score': '42.00%',
      'Offline Rank': 6300,
      'Regional Rank': 300,
      'Center Rank': 300,
    },
  ];

  const normalized = normalizeSmartExcelRows(bhuRows, '21-AJ221EA', 'combined');
  assert.equal(normalized.length, 2);

  const harshit = normalized.find((r) => r.regNo === '22594664')!;
  assert.equal(harshit.totalMarksObtained, 229);
  assert.equal(harshit.totalMaxMarksAppeared, 300);
  assert.equal(harshit.offlineRank, 6);
  assert.equal(harshit.regionalRank, 1);
  assert.equal(harshit.centerRank, 1);

  const anansh = normalized.find((r) => r.regNo === '22535651')!;
  assert.equal(anansh.totalMarksObtained, 126);
  assert.equal(anansh.totalMaxMarksAppeared, 300);
  assert.equal(anansh.offlineRank, 63);
  assert.equal(anansh.regionalRank, 3);
  assert.equal(anansh.centerRank, 3);

  // Also verify seeded batch-21-aj221ea has all 6 students with exact uninflated marks and ranks
  const ajBatch = INITIAL_BATCHES.find((b) => b.id === 'batch-21-aj221ea')!;
  assert.ok(ajBatch);
  assert.equal(ajBatch.students.length, 6);

  const seededHarshit = ajBatch.students.find((s) => s.regNo === '22594664')!;
  assert.equal(seededHarshit.latestMarksObtained, 229);
  assert.equal(seededHarshit.latestMaxMarks, 300);
  assert.equal(seededHarshit.bestMarksObtained, 242);
  assert.equal(seededHarshit.bestMaxMarks, 300);
  assert.equal(seededHarshit.bestOfflineRank, 6);
  assert.equal(seededHarshit.bestRegionalRank, 1);
  assert.equal(seededHarshit.bestCenterRank, 1);

  const seededAnansh = ajBatch.students.find((s) => s.regNo === '22535651')!;
  assert.equal(seededAnansh.latestMarksObtained, 126);
  assert.equal(seededAnansh.latestMaxMarks, 300);
  assert.equal(seededAnansh.bestOfflineRank, 63);
  assert.equal(seededAnansh.bestRegionalRank, 3);
  assert.equal(seededAnansh.bestCenterRank, 3);
});

test('Regression: Multi-batch Excel upload with LJ121 and AJ221EA rows strictly isolates LJ121 students into LJ121 and AJ221EA students into AJ221EA without mixing', () => {
  const mixedBatchExcelRows = [
    {
      'Reg No': 'LJ001',
      student_name: 'KARTIK SHARMA',
      batch: 'LJ121',
      class_stream: '11 JEE',
      test_date: 46187,
      test_name: 'Milestone:1 (Main)',
      'Out of': 300,
      Score: 210,
      'Avg. Physics': '70%',
      'Avg. Chemistry': '70%',
      'Avg. Maths': '70%',
    },
    {
      'Reg No': 'LJ002',
      student_name: 'PRIYA PATEL',
      batch: 'LJ121',
      class_stream: '11 JEE',
      test_date: 46187,
      test_name: 'Milestone:1 (Main)',
      'Out of': 300,
      Score: 240,
      'Avg. Physics': '80%',
      'Avg. Chemistry': '80%',
      'Avg. Maths': '80%',
    },
    {
      'Reg No': 'AJ001',
      student_name: 'HARSHIT SINGH',
      batch: 'AJ221EA',
      class_stream: '12 JEE',
      test_date: 46187,
      test_name: 'Milestone:1 (Main)',
      'Out of': 300,
      Score: 242,
      'Avg. Physics': '80%',
      'Avg. Chemistry': '86%',
      'Avg. Maths': '76%',
    },
    // Same Reg No appearing in two different batches (e.g., batch transfer) must NOT merge LJ121 into AJ221EA
    {
      'Reg No': 'SHARED99',
      student_name: 'ROHIT VERMA',
      batch: 'LJ121',
      class_stream: '11 JEE',
      test_date: 46187,
      test_name: 'Milestone:1 (Main)',
      'Out of': 300,
      Score: 150,
    },
    {
      'Reg No': 'SHARED99',
      student_name: 'ROHIT VERMA',
      batch: 'AJ221EA',
      class_stream: '12 JEE',
      test_date: 46229,
      test_name: 'VP AIR Part Test: 3 (Main)',
      'Out of': 300,
      Score: 195,
    },
  ];

  // Even if fallbackBatchName is AJ221EA, each row's explicit batch column must be respected
  const normalized = normalizeSmartExcelRows(mixedBatchExcelRows, 'AJ221EA', 'combined');
  assert.equal(normalized.length, 5);

  // Apply on a completely empty database ([]), even when targetBatchId is 'batch-aj221ea'
  const result = applyImportedRowsLocally([], 'batch-aj221ea', normalized, 'combined');
  assert.equal(result.batches.length, 2);

  const ljBatch = result.batches.find((b) => b.name === 'LJ121')!;
  const ajBatch = result.batches.find((b) => b.name === 'AJ221EA')!;
  assert.ok(ljBatch, 'LJ121 batch must be created');
  assert.ok(ajBatch, 'AJ221EA batch must be created');

  // LJ121 must contain ONLY LJ001, LJ002, and SHARED99 (with score 150/300)
  assert.equal(ljBatch.students.length, 3);
  assert.ok(ljBatch.students.some((s) => s.regNo === 'LJ001'));
  assert.ok(ljBatch.students.some((s) => s.regNo === 'LJ002'));
  assert.ok(!ljBatch.students.some((s) => s.regNo === 'AJ001'));
  const sharedInLj = ljBatch.students.find((s) => s.regNo === 'SHARED99')!;
  assert.equal(sharedInLj.totalMarksObtained, 150);
  assert.equal(sharedInLj.batchName, 'LJ121');

  // AJ221EA must contain ONLY AJ001 and SHARED99 (with score 195/300), and zero LJ001/LJ002 students
  assert.equal(ajBatch.students.length, 2);
  assert.ok(ajBatch.students.some((s) => s.regNo === 'AJ001'));
  assert.ok(!ajBatch.students.some((s) => s.regNo === 'LJ001'));
  assert.ok(!ajBatch.students.some((s) => s.regNo === 'LJ002'));
  const sharedInAj = ajBatch.students.find((s) => s.regNo === 'SHARED99')!;
  assert.equal(sharedInAj.totalMarksObtained, 195);
  assert.equal(sharedInAj.batchName, 'AJ221EA');
});
