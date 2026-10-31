import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  Bot,
  ChevronRight,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  RotateCcw,
  Send,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AcademicAgentChatTurn,
  AcademicAgentMatchedBatch,
  AcademicAgentMatchedStudent,
  AcademicAgentQueryResponse,
  BatchRecord,
  StudentRecord,
} from '../types/academic.ts';
import { buildAcademicAgentContextAndFallback } from '../utils/analyticsEngine.ts';

interface AcademicAiAgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  batches: BatchRecord[];
  activeBatch?: BatchRecord;
  activeStudent?: StudentRecord;
  onSelectStudent: (student: StudentRecord, batch: BatchRecord) => void;
  onSelectBatch: (batch: BatchRecord) => void;
  onQueueReportForStudent: (student: StudentRecord, batch: BatchRecord) => void;
}

interface AgentMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  engine?: 'gemini-3.8-flash' | 'deterministic-intelligence';
  matchedStudents?: AcademicAgentMatchedStudent[];
  matchedBatches?: AcademicAgentMatchedBatch[];
  suggestedFollowUps?: string[];
  keyMetrics?: AcademicAgentQueryResponse['keyMetrics'];
}

function renderFormattedLine(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedAgentReply({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-300">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={index} className="h-1" />;
        }
        if (line.startsWith('### ')) {
          return (
            <h4
              key={index}
              className="text-sm font-bold text-slate-100 tracking-tight pt-1 border-b border-slate-800/80 pb-1.5 font-display"
            >
              {line.replace(/^###\s+/, '')}
            </h4>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h4
              key={index}
              className="text-sm font-bold text-slate-100 tracking-tight pt-1 font-display"
            >
              {line.replace(/^##\s+/, '')}
            </h4>
          );
        }
        if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
          const body = line.replace(/^[•\-*]\s+/, '');
          return (
            <div key={index} className="flex items-start gap-2 pl-1">
              <span className="text-indigo-400 font-bold select-none mt-0.5">•</span>
              <p className="flex-1 text-slate-300">{renderFormattedLine(body)}</p>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(line)) {
          const match = line.match(/^(\d+\.)\s+(.*)$/);
          if (match) {
            return (
              <div key={index} className="flex items-start gap-2 pl-1">
                <span className="text-indigo-400 font-mono-tabular font-semibold select-none">
                  {match[1]}
                </span>
                <p className="flex-1 text-slate-300">{renderFormattedLine(match[2])}</p>
              </div>
            );
          }
        }
        return (
          <p key={index} className="text-slate-300">
            {renderFormattedLine(line)}
          </p>
        );
      })}
    </div>
  );
}

export const AcademicAiAgentDrawer: React.FC<AcademicAiAgentDrawerProps> = ({
  isOpen,
  onClose,
  batches,
  activeBatch,
  activeStudent,
  onSelectStudent,
  onSelectBatch,
  onQueueReportForStudent,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<AgentMessageItem[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Build initial welcome message grounded in the active batch & student
  useEffect(() => {
    if (messages.length === 0 && batches.length > 0 && activeBatch) {
      const batchRef = activeBatch;
      const initialResult = buildAcademicAgentContextAndFallback({
        query: `Summarize ${batchRef.name}`,
        batches,
        activeBatchId: batchRef.id,
        activeStudentId: activeStudent?.id,
      });

      setMessages([
        {
          id: 'welcome-agent-msg',
          role: 'assistant',
          content: `### Aetheris Academic Intelligence Agent Ready\nI have live access to **${batches.length} academic cohorts** (${batches.reduce((acc, b) => acc + b.students.length, 0)} student ledgers, exact test marks, subject accuracy, and attendance records).\n\n• **Active Cohort**: **${batchRef.name}** (${batchRef.code} · ${batchRef.students.length} students)\n• **Selected Student**: **${activeStudent?.name}** (${activeStudent?.regNo} · Rank #${activeStudent?.rankInBatch} · ${activeStudent?.overallAvgPct}%)\n\nAsk me about any **batch summary**, **Top 10 / Bottom 10 students**, **urgent intervention alerts**, **test difficulty**, or look up **any student by Name or Registration Number**.`,
          timestamp: 'Live Context',
          engine: 'gemini-3.8-flash',
          matchedStudents: initialResult.fallbackResponse.matchedStudents.slice(0, 3),
          matchedBatches: initialResult.fallbackResponse.matchedBatches,
          keyMetrics: initialResult.fallbackResponse.keyMetrics,
          suggestedFollowUps: [
            `Summarize ${batchRef.name} performance & test difficulty`,
            `Give me a full diagnostic on ${activeStudent?.name} (${activeStudent?.regNo})`,
            `Who needs urgent intervention in ${batchRef.name}?`,
            `Compare all batches across the institute`,
          ],
        },
      ]);
    }
  }, [batches, activeBatch, activeStudent, messages.length]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 120);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendQuery = async (rawQuery?: string) => {
    const queryText = (rawQuery ?? inputQuery).trim();
    if (!queryText || isLoading) return;

    if (!rawQuery) {
      setInputQuery('');
    }

    const userMsg: AgentMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory: AcademicAgentChatTurn[] = messages
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          batches,
          activeBatchId: activeBatch?.id,
          activeStudentId: activeStudent?.id,
          history: nextHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as AcademicAgentQueryResponse;
      const assistantMsg: AgentMessageItem = {
        id: `agent-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        engine: data.engine,
        matchedStudents: data.matchedStudents,
        matchedBatches: data.matchedBatches,
        suggestedFollowUps: data.suggestedFollowUps,
        keyMetrics: data.keyMetrics,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      // Deterministic client-side fallback if offline or request fails
      const { fallbackResponse } = buildAcademicAgentContextAndFallback({
        query: queryText,
        batches,
        activeBatchId: activeBatch?.id,
        activeStudentId: activeStudent?.id,
        history: nextHistory,
      });

      const assistantMsg: AgentMessageItem = {
        id: `agent-${Date.now()}`,
        role: 'assistant',
        content: fallbackResponse.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        engine: fallbackResponse.engine,
        matchedStudents: fallbackResponse.matchedStudents,
        matchedBatches: fallbackResponse.matchedBatches,
        suggestedFollowUps: fallbackResponse.suggestedFollowUps,
        keyMetrics: fallbackResponse.keyMetrics,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetConversation = () => {
    setMessages([]);
  };

  const handleOpenMatchedStudent = (card: AcademicAgentMatchedStudent) => {
    const foundBatch = batches.find((b) => b.id === card.batchId) || activeBatch;
    if (!foundBatch) return;
    const foundStudent = foundBatch.students.find(
      (s) => s.id === card.studentId || s.regNo === card.regNo
    );
    if (foundStudent) {
      onSelectStudent(foundStudent, foundBatch);
      onClose();
    }
  };

  const handleQueueMatchedStudentReport = (card: AcademicAgentMatchedStudent) => {
    const foundBatch = batches.find((b) => b.id === card.batchId) || activeBatch;
    if (!foundBatch) return;
    const foundStudent = foundBatch.students.find(
      (s) => s.id === card.studentId || s.regNo === card.regNo
    );
    if (foundStudent) {
      onQueueReportForStudent(foundStudent, foundBatch);
      onClose();
    }
  };

  const handleOpenMatchedBatch = (card: AcademicAgentMatchedBatch) => {
    const foundBatch = batches.find((b) => b.id === card.batchId);
    if (foundBatch) {
      onSelectBatch(foundBatch);
      onClose();
    }
  };

  const quickPrompts = [
    {
      label: `Active Batch Overview`,
      query: `Summarize ${activeBatch?.name || 'active batch'} performance, subject averages, and hardest test`,
    },
    {
      label: `Urgent Intervention List`,
      query: `Which students need urgent intervention in ${activeBatch?.name || 'the batch'}?`,
    },
    {
      label: `Top 5 Rankers`,
      query: `Who are the Top 5 students in ${activeBatch?.name || 'the batch'} with exact marks?`,
    },
    {
      label: `Inspect ${activeStudent?.name?.split(' ')[0] || 'Student'}`,
      query: `Give me a complete diagnostic on ${activeStudent?.name || 'top student'} (${activeStudent?.regNo || ''})`,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ai-agent-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs no-print"
          />

          {/* Slide-over Command Drawer */}
          <motion.aside
            key="ai-agent-drawer"
            aria-label="Academic AI Agent Copilot"
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[560px] bg-[#0B1120] border-l border-slate-800 shadow-2xl flex flex-col no-print"
          >
            {/* Header */}
            <div className="px-5 py-4 bg-[#090D16] border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-md bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-100 tracking-tight font-display truncate">
                      Academic Intelligence AI Agent
                    </h2>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono-tabular uppercase tracking-wider bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded">
                      LIVE TELEMETRY
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    Ask about any batch, test difficulty, or student by Name / Reg No
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleResetConversation}
                  title="Reset conversation"
                  className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 rounded-md transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close AI Agent drawer"
                  className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 rounded-md transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active Context Strip + Quick Prompt Buttons */}
            <div className="px-5 py-2.5 bg-slate-900/80 border-b border-slate-800/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 text-slate-400 truncate">
                  <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">
                    Context:{' '}
                    <strong className="text-slate-200">
                      {activeBatch?.name || 'All Cohorts (Ready for Upload)'}
                    </strong>
                  </span>
                </div>
                {activeStudent && (
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono-tabular">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate max-w-[200px]">{activeStudent.name}</span>
                    <span className="text-slate-500">({activeStudent.regNo})</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {quickPrompts.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSendQuery(item.query)}
                    disabled={isLoading}
                    className="px-2.5 py-1 text-[11px] font-medium bg-slate-950/90 hover:bg-indigo-950/60 text-slate-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/40 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation Feed */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
            >
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`w-full rounded-lg p-4 border ${
                      msg.role === 'user'
                        ? 'max-w-[88%] bg-indigo-600/20 border-indigo-500/40 text-slate-100'
                        : 'bg-slate-900/90 border-slate-800 text-slate-200'
                    }`}
                  >
                    {/* Role Header */}
                    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800/70">
                      <div className="flex items-center gap-1.5">
                        {msg.role === 'assistant' ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                              Aetheris Academic Agent
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                            Faculty Query
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono-tabular text-slate-500">
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* Key Metrics Strip (if present) */}
                    {msg.role === 'assistant' &&
                      msg.keyMetrics &&
                      msg.keyMetrics.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                          {msg.keyMetrics.map((metric, mIdx) => {
                            const toneClasses =
                              metric.tone === 'emerald'
                                ? 'bg-emerald-950/35 border-emerald-500/30 text-emerald-300'
                                : metric.tone === 'rose'
                                  ? 'bg-rose-950/35 border-rose-500/30 text-rose-300'
                                  : metric.tone === 'amber'
                                    ? 'bg-amber-950/35 border-amber-500/30 text-amber-300'
                                    : 'bg-indigo-950/35 border-indigo-500/30 text-indigo-300';
                            return (
                              <div
                                key={`${metric.label}-${mIdx}`}
                                className={`px-2.5 py-1.5 rounded border ${toneClasses}`}
                              >
                                <div className="text-[10px] uppercase tracking-wider opacity-75 truncate">
                                  {metric.label}
                                </div>
                                <div className="text-xs font-bold font-mono-tabular mt-0.5 truncate">
                                  {metric.value}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    {/* Message Body */}
                    {msg.role === 'user' ? (
                      <p className="text-xs leading-relaxed text-slate-100">{msg.content}</p>
                    ) : (
                      <FormattedAgentReply content={msg.content} />
                    )}

                    {/* Matched Student Action Cards */}
                    {msg.role === 'assistant' &&
                      msg.matchedStudents &&
                      msg.matchedStudents.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-slate-800/80">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                            Referenced Students — Direct Actions
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {msg.matchedStudents.map((st) => {
                              const statusBadge =
                                st.interventionStatus === 'Optimal'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : st.interventionStatus === 'Watch'
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30';
                              return (
                                <div
                                  key={`${st.batchId}-${st.regNo}`}
                                  className="p-2.5 rounded-md bg-slate-950/90 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-semibold text-slate-100 truncate">
                                        {st.name}
                                      </span>
                                      <span className="text-[10px] font-mono-tabular text-slate-400 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded">
                                        {st.regNo}
                                      </span>
                                      <span
                                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusBadge}`}
                                      >
                                        {st.interventionStatus}
                                      </span>
                                    </div>
                                    <div className="text-[11px] font-mono-tabular text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                      <span>Rank #{st.rankInBatch}</span>
                                      <span>Mean: {st.overallAvgPct.toFixed(2)}%</span>
                                      {st.latestMaxMarks ? (
                                        <span className="text-indigo-300 font-semibold">
                                          Latest: {st.latestMarksObtained ?? 0}/{st.latestMaxMarks}
                                        </span>
                                      ) : null}
                                      {st.bestMaxMarks && st.bestMarksObtained !== undefined ? (
                                        <span className="text-emerald-400">
                                          Best: {st.bestMarksObtained}/{st.bestMaxMarks}
                                        </span>
                                      ) : null}
                                      <span>Att: {st.attendancePct.toFixed(1)}%</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenMatchedStudent(st)}
                                      className="px-2.5 py-1 text-[11px] font-medium bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 border border-indigo-500/30 rounded flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <UserCheck className="w-3 h-3" />
                                      <span>360° Profile</span>
                                      <ArrowUpRight className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQueueMatchedStudentReport(st)}
                                      className="px-2 py-1 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Queue parent/mentor progress report"
                                    >
                                      <FileSpreadsheet className="w-3 h-3 text-slate-400" />
                                      <span>Report</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {/* Matched Batch Action Cards */}
                    {msg.role === 'assistant' &&
                      msg.matchedBatches &&
                      msg.matchedBatches.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                          {msg.matchedBatches.map((b) => (
                            <button
                              key={b.batchId}
                              type="button"
                              onClick={() => handleOpenMatchedBatch(b)}
                              className="px-2.5 py-1.5 text-[11px] font-medium bg-slate-950 hover:bg-slate-800/90 text-slate-300 border border-slate-800 rounded flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Layers className="w-3.5 h-3.5 text-indigo-400" />
                              <span>
                                Open <strong>{b.batchName}</strong> ({b.overallBatchAvgPct}% Mean ·{' '}
                                {b.totalStudents} Students)
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                          ))}
                        </div>
                      )}

                    {/* Suggested Follow-Ups */}
                    {msg.role === 'assistant' &&
                      msg.suggestedFollowUps &&
                      msg.suggestedFollowUps.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800/60">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                            Suggested Follow-Up Questions
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.suggestedFollowUps.map((followUp) => (
                              <button
                                key={followUp}
                                type="button"
                                onClick={() => handleSendQuery(followUp)}
                                disabled={isLoading}
                                className="px-2.5 py-1 text-[11px] text-left bg-slate-950/80 hover:bg-indigo-950/50 text-slate-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/40 rounded transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {followUp}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-xs bg-indigo-400 animate-ping" />
                  <span>
                    Analyzing batch ledgers, student test attempts, and intervention telemetry...
                  </span>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendQuery();
              }}
              className="p-4 bg-[#090D16] border-t border-slate-800"
            >
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask about a batch, student name, Reg No (e.g. Karanveer Sethi, Lakshya JEE)..."
                  className="flex-1 bg-slate-900 border border-slate-700/90 focus:border-indigo-500 rounded-md px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isLoading}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Ask Agent</span>
                </button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
