# Aetheris Academic Intelligence — Full-Stack Cloud SQL & Real PDF/Excel Ingestion Plan

An enterprise full-stack academic intelligence platform powered by **Cloud SQL (PostgreSQL + Drizzle ORM)**, **Firebase Authentication**, **Smart Excel (`.xlsx`/`.csv`) Column Mapping**, and **Server-Side Gemini AI (`gemini-3.8-flash`) PDF Table Extraction**. Every batch, student profile, chronological test result, monthly attendance record, weak-topic practice question, and admin-governed parent report is stored in and fetched automatically from the PostgreSQL database.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been finalized from your selections and govern our full-stack upgrade:

- **Confirmed Decision 1 — Cloud SQL PostgreSQL (Built-in Supabase SQL Equivalent)**: All student, batch, test result, attendance, weak-topic question bank, and report governance records will be persisted in a relational **PostgreSQL** database managed via **Drizzle ORM** (`src/db/schema.ts`), with automatic initial database seeding so the dashboard is immediately populated on first boot.
- **Confirmed Decision 2 — Separate or Combined Result & Attendance File Merging by Registration Number (`reg_no`)**: You can upload a **Student Result Sheet** (Excel or PDF), an **Attendance Report** (Excel or PDF), or a **Combined Master Sheet** in any order. The backend performs an intelligent relational `UPSERT` keyed on `(reg_no, batch_id)`—automatically joining new test scores onto existing student attendance records or updating attendance on existing test profiles without duplicating students.
- **Confirmed Decision 3 — Server-Side Gemini AI (`gemini-3.8-flash`) PDF Extractor + Smart Excel Mapper**:
  - **Real PDF Files**: Uploaded `.pdf` result sheets or attendance registers are sent to a server-side Express route (`POST /api/ingest/extract-pdf`) using `@google/genai` (`gemini-3.8-flash`) with a strict `responseSchema` to extract student registration numbers, names, batch names, test scores, subject marks, weak topics, and attendance percentages from any tabular or multi-page PDF layout.
  - **Real Excel/CSV Files**: Uploaded `.xlsx`, `.xls`, and `.csv` files use a fuzzy header normalizer that recognizes real-world column variations (e.g., `Roll No` / `Reg No` / `Enrollment ID`, `Student Name` / `Candidate`, `Present %` / `Attendance`, `Phy` / `Physics`, `T1` / `Test 1`) and maps them cleanly before upserting into PostgreSQL.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. **Database-Backed Universal Lookup**: When a parent, student, or teacher enters a **Student Name** or **Registration Number** + **Batch Name**, or selects a **Batch Name**, the frontend queries the PostgreSQL backend (`/api/batches`, `/api/lookup`, `/api/students/:regNo`) to fetch live relational records.
  2. **Multi-File Excel & PDF Ingestion Studio**: Teachers or admins can upload:
     - **Result-Only Files** (Excel/CSV/PDF containing marks, subject scores, or test series results)
     - **Attendance-Only Files** (Excel/CSV/PDF containing lecture counts or monthly/overall attendance percentages)
     - **Combined Master Files** (Excel/CSV/PDF containing both marks and attendance)
     The system previews all extracted rows, shows whether each `reg_no` will **Update Existing Student (Merge)** or **Insert New Student**, and commits them to PostgreSQL in a single transaction.
  3. **Live Cohort Analytics & Topic Remediation**: Computes Top 10, Bottom 10, Intervention Required flags, and longitudinal growth directly from the database records, and serves targeted practice questions from the database's `practice_questions` table for every diagnosed weak topic.
  4. **Database-Persisted Report Governance Queue**: Drafted parent/teacher progress reports and admin approvals (`Pending Approval` -> `Approved & Sent` / `Revision Requested`) are persisted in the PostgreSQL `queued_reports` table.

---

### 2. User Experience & Visual Design

- **Phased Implementation Roadmap**:
  - **Phase 1 — Cloud SQL Provisioning & Relational Schema (`src/db/schema.ts`)**: Provision Cloud SQL PostgreSQL and Firebase Auth, define Drizzle ORM tables (`users`, `batches`, `students`, `practice_questions`, `queued_reports`), push schema migrations, and auto-seed initial institute data if tables are empty.
  - **Phase 2 — Full-Stack Express API & Gemini PDF Extraction Engine (`server.ts`)**: Build REST endpoints for fetching batches/students, upserting merged Result & Attendance records by `reg_no`, managing admin report approvals, and extracting structured rows from uploaded PDF files via `gemini-3.8-flash`.
  - **Phase 3 — Smart Excel/PDF Ingestion Modal & Live Database Sync UI**: Upgrade the Import Modal with upload mode selector (`Result Sheet`, `Attendance Sheet`, or `Combined Sheet`), Gemini PDF extraction progress indicator, smart Excel column auto-mapper, merge status preview (`Merging by Reg No` vs `New Student`), and live database refresh across all views.

- **Visual Identity & Theme**:
  - Preserves the **Dark Obsidian Executive Analytics** aesthetic (`#090D16` canvas, `#111827` structural surfaces, `Plus Jakarta Sans` + `DM Sans` + `JetBrains Mono` tabular numerals) and strict 3-zone Top Bar Contract.
  - Adheres strictly to UI isolation rules: no raw SQL logs or database connection strings exposed in the UI; clean loading skeletons, error recovery banners, and instant state updates after every database mutation.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Relational Upsert by Registration Number (`reg_no`) for Separate Result & Attendance Files**
  - *Chosen Approach*: Use `reg_no` (normalized uppercase, e.g., `REG-2027-101`) as the natural business key across files. If a teacher uploads `JEE_Test6_Marks.pdf` first and `October_Attendance.xlsx` second, the backend matches rows by `reg_no`, preserving the student's test history while updating their `attendance_pct` and `monthly_attendance` JSONB ledger, then recalculates batch ranks and intervention status automatically.
  - *Why*: Real schools and coaching institutes almost always maintain attendance registers separately from exam cell result sheets.

- **Decision 2: Server-Side Multimodal Gemini (`gemini-3.8-flash`) for PDF Parsing**
  - *Chosen Approach*: Send the base64-encoded PDF buffer (`application/pdf`) to `ai.models.generateContent` on the Express server using `gemini-3.8-flash` and a strict `Type.ARRAY` `responseSchema`.
  - *Why*: Native PDF understanding in Gemini accurately reads multi-column mark sheets, subject headers, and attendance tables from real PDFs without brittle regex failures, while keeping `GEMINI_API_KEY` strictly on the server.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Full-Stack Architecture & Data Flow Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                   REACT FRONTEND (Dark Obsidian Executive Portal)                   │
│  [Lookup Portal]   [Batch Command Center]   [Student Profile]   [Report Governance] │
└──────────────┬────────────────────────────────────────────────────┬─────────────────┘
               │ REST JSON (/api/batches, /api/reports, /api/ingest) │ PDF / XLSX Upload
               ▼                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        EXPRESS BACKEND SERVER (server.ts)                           │
│  • GET  /api/bootstrap         -> Fetches all batches, students, questions, reports │
│  • POST /api/ingest/extract-pdf-> Calls Gemini (gemini-3.8-flash) on PDF buffer     │
│  • POST /api/ingest/commit     -> Merges Result / Attendance rows by reg_no         │
│  • POST /api/reports           -> Creates & updates Admin-Approved Parent Reports   │
└──────────────┬────────────────────────────────────────────────────┬─────────────────┘
               │ Drizzle ORM (pg.Pool Object Method)                │ @google/genai SDK
               ▼                                                    ▼
┌─────────────────────────────────────────────┐   ┌───────────────────────────────────┐
│   CLOUD SQL POSTGRESQL (src/db/schema.ts)   │   │   GEMINI API (gemini-3.8-flash)   │
│  • users              (Firebase Auth UID)   │   │  • Multimodal PDF Document Reader │
│  • batches            (Batch metadata/tests)│   │  • Structured JSON Schema Output  │
│  • students           (Scores & Attendance) │   │    for Marks & Attendance Tables  │
│  • practice_questions (Weak-topic bank)     │   └───────────────────────────────────┘
│  • queued_reports     (Admin approval queue)│
└─────────────────────────────────────────────┘
```

- **PostgreSQL Relational Schema (`src/db/schema.ts`)**:
  - `users`: `id` (serial PK), `uid` (text unique, Firebase UID), `email` (text), `role` (text: `'admin' | 'teacher' | 'parent'`), `createdAt` (timestamp).
  - `batches`: `id` (text PK), `name` (text), `code` (text), `stream` (text), `academicYear` (text), `leadFaculty` (text), `subjectsJson` (text/JSON), `testsJson` (text/JSON), `createdAt` (timestamp).
  - `students`: `id` (text PK), `regNo` (text unique), `name` (text), `batchId` (text FK -> `batches.id`), `batchName` (text), `stream` (text), `parentName` (text), `parentEmail` (text), `parentPhone` (text), `classTeacherName` (text), `classTeacherEmail` (text), `attendancePct` (real), `monthlyAttendanceJson` (text/JSON), `testAttemptsJson` (text/JSON), `topicScoresJson` (text/JSON), `overallAvgPct` (real), `latestTestPct` (real), `growthDeltaPct` (real), `rankInBatch` (integer), `batchPercentile` (real), `interventionStatus` (text), `interventionReasonsJson` (text/JSON), `updatedAt` (timestamp).
  - `practiceQuestions`: `id` (text PK), `topicName` (text), `subject` (text), `difficulty` (text), `expectedMinutes` (integer), `questionText` (text), `optionsJson` (text/JSON), `correctIndex` (integer), `hint` (text), `solutionStepsJson` (text/JSON).
  - `queuedReports`: `id` (text PK), `studentId` (text), `studentName` (text), `regNo` (text), `batchId` (text), `batchName` (text), `recipientType` (text), `recipientName` (text), `recipientEmail` (text), `recipientPhone` (text), `overallAvgPct` (real), `attendancePct` (real), `rankInBatch` (integer), `weakTopicsJson` (text/JSON), `recommendedQuestionsCount` (integer), `teacherRemarks` (text), `requestedBy` (text), `createdAt` (text), `status` (text), `approvedBy` (text), `dispatchedAt` (text), `adminNote` (text).
