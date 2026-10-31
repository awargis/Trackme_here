import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { optionalAuth, requireAuth } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  approveAllPendingReportsInDb,
  clearAllAcademicDataInDb,
  createQueuedReportInDb,
  ensureSeededAndGetBootstrapData,
  updateQueuedReportStatusInDb,
  upsertStudentsByRegNo,
} from './src/db/academicRepository.ts';
import type {
  AcademicAgentChatTurn,
  BatchRecord,
  QueuedReport,
  UploadCategory,
  UploadedStudentRow,
} from './src/types/academic.ts';
import {
  buildAcademicAgentContextAndFallback,
  normalizeSmartExcelRows,
  parseDelimitedOrPdfTextToRows,
} from './src/utils/analyticsEngine.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // 1. Bootstrap all batches, students, practice questions, and queued reports from Cloud SQL PostgreSQL
  app.get('/api/bootstrap', optionalAuth, async (_req, res) => {
    try {
      const data = await ensureSeededAndGetBootstrapData();
      return res.json(data);
    } catch (error) {
      console.error('Error in GET /api/bootstrap:', error);
      const { PRACTICE_QUESTION_BANK } = await import('./src/data/seedBatches.ts');
      return res.json({
        batches: [],
        questionBank: PRACTICE_QUESTION_BANK,
        reports: [],
      });
    }
  });

  // 1b. Clear all batches, students, and reports from Cloud SQL PostgreSQL so user can upload fresh Excel sheets
  app.post('/api/data/clear', optionalAuth, async (_req, res) => {
    try {
      await clearAllAcademicDataInDb();
      return res.json({ ok: true, batches: [], reports: [] });
    } catch (error) {
      console.error('Error in POST /api/data/clear:', error);
      return res.status(500).json({ error: 'Failed to clear database tables' });
    }
  });

  // 2. Sync authenticated Firebase user with Cloud SQL PostgreSQL users table
  app.post('/api/auth/sync', requireAuth, async (req: any, res) => {
    try {
      const { uid, email } = req.user!;
      const userRecord = await getOrCreateUser(uid, email || '');
      return res.json({ user: userRecord });
    } catch (error) {
      console.error('Error in POST /api/auth/sync:', error);
      return res.status(500).json({ error: 'Failed to sync user profile' });
    }
  });

  // 3. Server-side Gemini AI PDF table extractor for real PDF result & attendance files
  app.post('/api/ingest/extract-pdf', optionalAuth, async (req, res) => {
    try {
      const {
        base64Data,
        rawTextFallback,
        batchName = 'Apex JEE-Adv 2027',
        uploadCategory = 'combined',
      } = req.body as {
        base64Data?: string;
        rawTextFallback?: string;
        batchName?: string;
        uploadCategory?: UploadCategory;
      };

      if (!base64Data && !rawTextFallback) {
        return res.status(400).json({ error: 'Missing PDF content for extraction' });
      }

      const ai = getGeminiClient();
      if (ai && base64Data) {
        try {
          const prompt = `Extract all student academic test result rows and/or attendance rows from this PDF document.
The user selected upload category: "${uploadCategory}" for batch "${batchName}".
For each row in the table:
- Extract "regNo" (Registration Number / Roll Number, e.g., 22535651 or REG-2027-101).
- Extract "name" (Student Full Name).
- Extract "batch" (Batch code if present, e.g. 21-AJ221EA or S1A-LJ21W).
- Extract "center" and "region" if present.
- Extract "test_name" (e.g. Milestone:1 (Main)), "test_date", "Test Type" (e.g. Main / Advanced), "Out of" (exact maximum marks for the test, e.g. 300, 180, 144 — NEVER multiply by 100), and "Score" (exact marks obtained by the student, e.g. 242, 126, 81 — NEVER multiply by 100).
- Extract "Avg. Score", "Avg. Physics", "Avg. Chemistry", "Avg. Maths" as percentages (0-100 scale).
- Extract "Offline Rank", "Regional Rank", and "Center Rank" as exact integer ranks (e.g. 6, 1, 1 — NEVER multiply by 100).
- If attendance data is present, extract "attendancePct" (0-100).`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Data,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    regNo: { type: Type.STRING },
                    name: { type: Type.STRING },
                    batch: { type: Type.STRING },
                    center: { type: Type.STRING },
                    region: { type: Type.STRING },
                    test_name: { type: Type.STRING },
                    test_date: { type: Type.STRING },
                    'Test Type': { type: Type.STRING },
                    'Out of': { type: Type.NUMBER },
                    Score: { type: Type.NUMBER },
                    'Avg. Score': { type: Type.NUMBER },
                    'Avg. Physics': { type: Type.NUMBER },
                    'Avg. Chemistry': { type: Type.NUMBER },
                    'Avg. Maths': { type: Type.NUMBER },
                    'Offline Rank': { type: Type.NUMBER },
                    'Regional Rank': { type: Type.NUMBER },
                    'Center Rank': { type: Type.NUMBER },
                    attendancePct: { type: Type.NUMBER },
                    test1Pct: { type: Type.NUMBER },
                    test2Pct: { type: Type.NUMBER },
                    test3Pct: { type: Type.NUMBER },
                    test4Pct: { type: Type.NUMBER },
                    test5Pct: { type: Type.NUMBER },
                    test6Pct: { type: Type.NUMBER },
                    physicsPct: { type: Type.NUMBER },
                    chemistryPct: { type: Type.NUMBER },
                    mathOrBioPct: { type: Type.NUMBER },
                    weakTopicsRaw: { type: Type.STRING },
                  },
                  required: ['regNo', 'name'],
                },
              },
            },
          });

          const jsonText = response.text?.trim();
          if (jsonText) {
            const parsed = JSON.parse(jsonText) as Record<string, unknown>[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              const normalized = normalizeSmartExcelRows(parsed, batchName, uploadCategory);
              if (normalized.length > 0) {
                return res.json({
                  rows: normalized,
                  engine: 'gemini-3.8-flash',
                });
              }
            }
          }
        } catch (geminiError) {
          console.warn(
            'Gemini PDF extraction encountered an issue; falling back to structured text parser:',
            geminiError
          );
        }
      }

      // Deterministic fallback if rawTextFallback is present or PDF has text streams
      if (rawTextFallback) {
        const rows = parseDelimitedOrPdfTextToRows(
          rawTextFallback,
          batchName,
          uploadCategory
        );
        if (rows.length > 0) {
          return res.json({
            rows,
            engine: 'deterministic-parser',
          });
        }
      }

      // Decode base64 to inspect plain text lines inside the PDF buffer
      if (base64Data) {
        const decodedText = Buffer.from(base64Data, 'base64').toString('utf8');
        const rows = parseDelimitedOrPdfTextToRows(
          decodedText,
          batchName,
          uploadCategory
        );
        if (rows.length > 0) {
          return res.json({
            rows,
            engine: 'pdf-stream-parser',
          });
        }
      }

      return res.json({
        rows: [],
        engine: 'empty',
      });
    } catch (error) {
      console.error('Error in POST /api/ingest/extract-pdf:', error);
      return res.status(500).json({
        error: 'Failed to extract student records from PDF document',
      });
    }
  });

  // 4. Commit and merge uploaded Result / Attendance / Combined rows into Cloud SQL PostgreSQL by reg_no
  app.post('/api/ingest/commit', optionalAuth, async (req, res) => {
    try {
      const {
        batchId,
        rows,
        uploadCategory = 'combined',
      } = req.body as {
        batchId: string;
        rows: UploadedStudentRow[];
        uploadCategory?: UploadCategory;
      };

      if (!batchId || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
          error: 'Target batchId and non-empty student rows are required',
        });
      }

      const result = await upsertStudentsByRegNo(batchId, rows, uploadCategory);
      return res.json(result);
    } catch (error) {
      console.error('Error in POST /api/ingest/commit:', error);
      return res.status(500).json({
        error: 'Failed to commit and merge student records in Cloud SQL PostgreSQL',
      });
    }
  });

  // 5. Create a new student progress report in Cloud SQL PostgreSQL
  app.post('/api/reports', optionalAuth, async (req, res) => {
    try {
      const report = req.body as QueuedReport;
      if (!report || !report.id || !report.studentId) {
        return res.status(400).json({ error: 'Invalid report payload' });
      }
      const saved = await createQueuedReportInDb(report);
      return res.json({ report: saved });
    } catch (error) {
      console.error('Error in POST /api/reports:', error);
      return res.status(500).json({ error: 'Failed to save report in database' });
    }
  });

  // 6. Approve or request revision on a queued report in Cloud SQL PostgreSQL
  app.patch('/api/reports/:id', optionalAuth, async (req, res) => {
    try {
      const reportId = String(req.params.id);
      const patch = req.body as {
        status: QueuedReport['status'];
        approvedBy?: string;
        dispatchedAt?: string;
        adminNote?: string;
      };
      await updateQueuedReportStatusInDb(reportId, patch);
      return res.json({ ok: true });
    } catch (error) {
      console.error('Error in PATCH /api/reports/:id:', error);
      return res.status(500).json({ error: 'Failed to update report status' });
    }
  });

  // 7. Bulk approve all pending reports in Cloud SQL PostgreSQL
  app.post('/api/reports/approve-all', optionalAuth, async (req, res) => {
    try {
      const { approvedBy, dispatchedAt } = req.body as {
        approvedBy: string;
        dispatchedAt: string;
      };
      await approveAllPendingReportsInDb(
        approvedBy || 'Dean Vikramaditya Sen (Bulk Approval)',
        dispatchedAt || new Date().toISOString().slice(0, 16).replace('T', ' ')
      );
      return res.json({ ok: true });
    } catch (error) {
      console.error('Error in POST /api/reports/approve-all:', error);
      return res.status(500).json({ error: 'Failed to bulk-approve reports' });
    }
  });

  // 8. Academic Intelligence AI Agent Chatbot (Gemini 3.8 Flash + Grounded Cohort/Student Telemetry)
  app.post('/api/agent/chat', optionalAuth, async (req, res) => {
    try {
      const {
        query,
        batches: clientBatches,
        activeBatchId,
        activeStudentId,
        history = [],
      } = req.body as {
        query?: string;
        batches?: BatchRecord[];
        activeBatchId?: string;
        activeStudentId?: string;
        history?: AcademicAgentChatTurn[];
      };

      if (!query || !query.trim()) {
        return res.status(400).json({ error: 'Query is required' });
      }

      let batchesToAnalyze =
        Array.isArray(clientBatches) && clientBatches.length > 0 ? clientBatches : [];
      if (batchesToAnalyze.length === 0) {
        const bootstrap = await ensureSeededAndGetBootstrapData();
        batchesToAnalyze = bootstrap.batches;
      }

      const { systemContext, fallbackResponse } = buildAcademicAgentContextAndFallback({
        query,
        batches: batchesToAnalyze,
        activeBatchId,
        activeStudentId,
        history,
      });

      const ai = getGeminiClient();
      if (ai) {
        try {
          const historyTranscript = (history || [])
            .slice(-6)
            .map((turn) => `${turn.role === 'user' ? 'Faculty User' : 'Aetheris AI Agent'}: ${turn.content}`)
            .join('\n\n');

          const prompt = [
            historyTranscript ? `RECENT CONVERSATION HISTORY:\n${historyTranscript}\n` : '',
            `FACULTY / ADMIN QUESTION:\n${query.trim()}`,
          ]
            .filter(Boolean)
            .join('\n');

          const compactSystemContext =
            systemContext.length > 6000
              ? `${systemContext.slice(0, 6000)}\n...[truncated for speed]`
              : systemContext;

          const geminiCallPromise = ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              systemInstruction: `You are the Aetheris Academic Intelligence Agent, an executive AI copilot for coaching institute directors, academic deans, and faculty mentors.
Answer questions accurately and concisely using ONLY the live academic database telemetry provided below.
Formatting rules:
- Cite exact numbers: registration numbers (Reg No), batch ranks, exact marks obtained out of max marks (e.g., 211 / 360 or 1712 / 1800), percentages, attendance rates, test dates, and test difficulty indices.
- Structure your response with clear markdown headings (###) and bullet points (•).
- Highlight specific student names, registration numbers, weak syllabus topics, and concrete remediation steps.
- Never invent student names or scores outside the provided telemetry.

LIVE ACADEMIC TELEMETRY:
${compactSystemContext}`,
            },
          });

          const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 3500)
          );

          const response = await Promise.race([geminiCallPromise, timeoutPromise]);

          const geminiReply = response?.text?.trim();
          if (geminiReply) {
            return res.json({
              ...fallbackResponse,
              reply: geminiReply,
              engine: 'gemini-3.8-flash',
            });
          }
        } catch (geminiErr) {
          console.warn(
            'Gemini AI Agent call encountered an issue; serving deterministic grounded response:',
            geminiErr
          );
        }
      }

      return res.json(fallbackResponse);
    } catch (error) {
      console.error('Error in POST /api/agent/chat:', error);
      return res.status(500).json({
        error: 'Failed to process Academic AI Agent query',
      });
    }
  });

  // Mount Vite dev server in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aetheris Academic server running on http://localhost:${PORT}`);
  });
}

startServer();
