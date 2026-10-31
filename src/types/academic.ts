export type InterventionLevel = 'Optimal' | 'Watch' | 'Urgent Intervention';

export interface PracticeQuestion {
  id: string;
  topicName: string;
  subject: string;
  difficulty: 'Foundation' | 'Conceptual' | 'Advanced';
  expectedMinutes: number;
  questionText: string;
  options: string[];
  correctIndex: number;
  hint: string;
  solutionSteps: string[];
}

export interface TopicScore {
  topicId: string;
  subject: string;
  topicName: string;
  accuracyPct: number;
  questionsAttempted: number;
  questionsCorrect: number;
  status: 'Weak' | 'Moderate' | 'Strong';
}

export interface SubjectScore {
  subject: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
}

export interface TestAttempt {
  testId: string;
  testName: string;
  testDate: string;
  testType?: string;
  appeared?: boolean;
  batchCodeForTest?: string;
  regionName?: string;
  combinedCenterName?: string;
  centerName?: string;
  classStream?: string;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  batchPercentile: number;
  rankInTest: number;
  offlineRank?: number;
  regionalRank?: number;
  centerRank?: number;
  subjectScores: SubjectScore[];
}

export interface MonthlyAttendance {
  month: string;
  classesHeld: number;
  classesAttended: number;
  percentage: number;
}

export interface StudentRecord {
  id: string;
  regNo: string;
  name: string;
  batchId: string;
  batchName: string;
  stream: string;
  regionName?: string;
  combinedCenterName?: string;
  centerName?: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  classTeacherName: string;
  classTeacherEmail: string;
  attendancePct: number;
  monthlyAttendance: MonthlyAttendance[];
  testAttempts: TestAttempt[];
  topicScores: TopicScore[];
  overallAvgPct: number;
  latestTestPct: number;
  growthDeltaPct: number;
  totalMarksObtained?: number;
  totalMaxMarksAppeared?: number;
  totalMaxMarksScheduled?: number;
  latestMarksObtained?: number;
  latestMaxMarks?: number;
  latestTestName?: string;
  latestTestDate?: string;
  bestMarksObtained?: number;
  bestMaxMarks?: number;
  bestTestPct?: number;
  bestTestName?: string;
  testsAppearedCount?: number;
  testsScheduledCount?: number;
  bestOfflineRank?: number;
  bestRegionalRank?: number;
  bestCenterRank?: number;
  rankInBatch: number;
  batchPercentile: number;
  interventionStatus: InterventionLevel;
  interventionReasons: string[];
}

export interface BatchTestMeta {
  testId: string;
  testName: string;
  testDate: string;
  testType?: string;
  maxMarks: number;
  syllabusFocus?: string;
}

export interface BatchRecord {
  id: string;
  name: string;
  code: string;
  stream: string;
  academicYear: string;
  leadFaculty: string;
  subjects: string[];
  tests: BatchTestMeta[];
  students: StudentRecord[];
}

export interface TestStudentOutlier {
  studentId: string;
  name: string;
  regNo: string;
  pct: number;
  marks: number;
  maxMarks: number;
  deltaFromPrevPct?: number;
}

export interface LongitudinalTestPoint {
  testId: string;
  testName: string;
  testDate: string;
  dateLabel?: string;
  maxMarks?: number;
  avgMarksObtained?: number;
  appearedCount?: number;
  totalStudents?: number;
  batchAvgPct: number;
  topTenAvgPct: number;
  bottomTenAvgPct: number;
  physicsAvgPct?: number;
  chemistryAvgPct?: number;
  mathOrBioAvgPct?: number;
  highestPct: number;
  lowestPct: number;
  attendanceAvgPct: number;
  difficultyLabel?: 'High Difficulty' | 'Moderate' | 'Accessible' | 'Scheduled';
  difficultyIndex?: number;
  scoreSpreadStdDev?: number;
  hardestSubject?: {
    name: string;
    avgPct: number;
  };
  topOutlier?: TestStudentOutlier;
  bottomOutlier?: TestStudentOutlier;
  momentumOutlier?: TestStudentOutlier;
}

export interface SubjectBatchSummary {
  subject: string;
  avgPct: number;
  topScorePct: number;
  weakStudentCount: number;
}

export interface BatchAnalyticsSummary {
  batchId: string;
  batchName: string;
  totalStudents: number;
  overallBatchAvgPct: number;
  overallGrowthDeltaPct: number;
  avgAttendancePct: number;
  topTenStudents: StudentRecord[];
  bottomTenStudents: StudentRecord[];
  interventionStudents: StudentRecord[];
  longitudinalSeries: LongitudinalTestPoint[];
  subjectSummaries: SubjectBatchSummary[];
}

export type ReportStatus = 'Pending Approval' | 'Approved & Sent' | 'Revision Requested';

export interface QueuedReport {
  id: string;
  studentId: string;
  studentName: string;
  regNo: string;
  batchId: string;
  batchName: string;
  recipientType: 'Parent / Family' | 'Class Teacher' | 'Both Family & Teacher';
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  overallAvgPct: number;
  attendancePct: number;
  rankInBatch: number;
  weakTopics: string[];
  recommendedQuestionsCount: number;
  teacherRemarks: string;
  requestedBy: string;
  createdAt: string;
  status: ReportStatus;
  approvedBy?: string;
  dispatchedAt?: string;
  adminNote?: string;
}

export type MonthlyAttendanceRecord = MonthlyAttendance;
export type SubjectName = string;
export type UploadCategory = 'combined' | 'results_only' | 'attendance_only';

export interface UploadedStudentRow {
  regNo: string;
  name: string;
  batchName: string;
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
  testsScheduled?: number;
  testsAppeared?: number;
  totalMarksObtained?: number;
  totalMaxMarksAppeared?: number;
  totalMaxMarksScheduled?: number;
  outOfMarks?: number;
  rawScoreMarks?: number;
  test1Pct?: number;
  test2Pct?: number;
  test3Pct?: number;
  test4Pct?: number;
  test5Pct?: number;
  test6Pct?: number;
  physicsPct?: number;
  chemistryPct?: number;
  mathOrBioPct?: number;
  weakTopicsRaw?: string;
  uploadCategory?: UploadCategory;
  parsedTestAttempts?: TestAttempt[];
  offlineRank?: number;
  regionalRank?: number;
  centerRank?: number;
}

export interface AcademicAgentMatchedStudent {
  studentId: string;
  batchId: string;
  batchName: string;
  regNo: string;
  name: string;
  rankInBatch: number;
  overallAvgPct: number;
  attendancePct: number;
  totalMarksObtained?: number;
  totalMaxMarksAppeared?: number;
  latestMarksObtained?: number;
  latestMaxMarks?: number;
  latestTestName?: string;
  bestMarksObtained?: number;
  bestMaxMarks?: number;
  bestTestName?: string;
  bestTestPct?: number;
  testsAppearedCount?: number;
  testsScheduledCount?: number;
  interventionStatus: InterventionLevel;
  weakTopics: string[];
}

export interface AcademicAgentMatchedBatch {
  batchId: string;
  batchName: string;
  code: string;
  totalStudents: number;
  overallBatchAvgPct: number;
  avgAttendancePct: number;
  urgentInterventionCount: number;
  topStudentName?: string;
  hardestTestName?: string;
}

export interface AcademicAgentChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AcademicAgentQueryResponse {
  reply: string;
  engine: 'gemini-3.8-flash' | 'deterministic-intelligence';
  matchedStudents: AcademicAgentMatchedStudent[];
  matchedBatches: AcademicAgentMatchedBatch[];
  suggestedFollowUps: string[];
  keyMetrics?: Array<{
    label: string;
    value: string;
    tone?: 'indigo' | 'emerald' | 'amber' | 'rose';
  }>;
}

