import { relations } from 'drizzle-orm';
import {
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  role: text('role').notNull().default('teacher'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const batches = pgTable('batches', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  stream: text('stream').notNull(),
  academicYear: text('academic_year').notNull(),
  leadFaculty: text('lead_faculty').notNull(),
  subjectsJson: text('subjects_json').notNull(),
  testsJson: text('tests_json').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const students = pgTable('students', {
  id: text('id').primaryKey(),
  regNo: text('reg_no').notNull(),
  name: text('name').notNull(),
  batchId: text('batch_id')
    .references(() => batches.id)
    .notNull(),
  batchName: text('batch_name').notNull(),
  stream: text('stream').notNull(),
  parentName: text('parent_name').notNull(),
  parentEmail: text('parent_email').notNull(),
  parentPhone: text('parent_phone').notNull(),
  classTeacherName: text('class_teacher_name').notNull(),
  classTeacherEmail: text('class_teacher_email').notNull(),
  attendancePct: real('attendance_pct').notNull(),
  monthlyAttendanceJson: text('monthly_attendance_json').notNull(),
  testAttemptsJson: text('test_attempts_json').notNull(),
  topicScoresJson: text('topic_scores_json').notNull(),
  overallAvgPct: real('overall_avg_pct').notNull(),
  latestTestPct: real('latest_test_pct').notNull(),
  growthDeltaPct: real('growth_delta_pct').notNull(),
  rankInBatch: integer('rank_in_batch').notNull(),
  batchPercentile: real('batch_percentile').notNull(),
  interventionStatus: text('intervention_status').notNull(),
  interventionReasonsJson: text('intervention_reasons_json').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const practiceQuestions = pgTable('practice_questions', {
  id: text('id').primaryKey(),
  topicName: text('topic_name').notNull(),
  subject: text('subject').notNull(),
  difficulty: text('difficulty').notNull(),
  expectedMinutes: integer('expected_minutes').notNull(),
  questionText: text('question_text').notNull(),
  optionsJson: text('options_json').notNull(),
  correctIndex: integer('correct_index').notNull(),
  hint: text('hint').notNull(),
  solutionStepsJson: text('solution_steps_json').notNull(),
});

export const queuedReports = pgTable('queued_reports', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  studentName: text('student_name').notNull(),
  regNo: text('reg_no').notNull(),
  batchId: text('batch_id').notNull(),
  batchName: text('batch_name').notNull(),
  recipientType: text('recipient_type').notNull(),
  recipientName: text('recipient_name').notNull(),
  recipientEmail: text('recipient_email').notNull(),
  recipientPhone: text('recipient_phone').notNull(),
  overallAvgPct: real('overall_avg_pct').notNull(),
  attendancePct: real('attendance_pct').notNull(),
  rankInBatch: integer('rank_in_batch').notNull(),
  weakTopicsJson: text('weak_topics_json').notNull(),
  recommendedQuestionsCount: integer('recommended_questions_count').notNull(),
  teacherRemarks: text('teacher_remarks').notNull(),
  requestedBy: text('requested_by').notNull(),
  createdAt: text('created_at').notNull(),
  status: text('status').notNull(),
  approvedBy: text('approved_by'),
  dispatchedAt: text('dispatched_at'),
  adminNote: text('admin_note'),
});

export const batchesRelations = relations(batches, ({ many }) => ({
  students: many(students),
}));

export const studentsRelations = relations(students, ({ one }) => ({
  batch: one(batches, {
    fields: [students.batchId],
    references: [batches.id],
  }),
}));
