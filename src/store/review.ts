import { create } from 'zustand';
import type { ReviewAction } from '../types';
import type { CandidateRun } from '../agents/scheduler';

export interface ReviewDecision {
  action: ReviewAction;
  reason: string;
  timestamp: string;
  teacher: string;
  questionVersion: string;
  revisedStem?: string;
  revisedVersion?: string;
}

export interface ReviewAuditEntry extends ReviewDecision {
  id: string;
  taskId: string;
  questionNo: string;
}

interface ReviewState {
  decisions: Record<string, ReviewDecision>;
  audit: ReviewAuditEntry[];
  decide: (
    record: CandidateRun,
    action: ReviewAction,
    reason: string,
    revisedStem?: string,
  ) => ReviewAuditEntry | null;
}

const TEACHER = '李老师';
let auditSequence = 0;

const nextVersion = (version: string): string => {
  const match = /^v(\d+)(?:\.(\d+))?$/.exec(version);
  if (!match) return `${version}.1`;
  const major = Number(match[1]);
  const minor = match[2] ? Number(match[2]) : 0;
  return `v${major}.${minor + 1}`;
};

export const useReviewStore = create<ReviewState>((set, get) => ({
  decisions: {},
  audit: [],

  decide: (record, action, reason, revisedStem) => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) return null;
    if (action === '改写' && !revisedStem?.trim()) return null;

    const previous = get().decisions[record.id];
    const baseVersion = previous?.revisedVersion ?? record.candidate.version;
    const nextRevisedStem =
      action === '改写' ? revisedStem?.trim() : previous?.revisedStem;
    const nextRevisedVersion =
      action === '改写'
        ? nextVersion(baseVersion)
        : previous?.revisedVersion;

    const decision: ReviewDecision = {
      action,
      reason: trimmedReason,
      timestamp: new Date().toISOString(),
      teacher: TEACHER,
      questionVersion: record.candidate.version,
      revisedStem: nextRevisedStem,
      revisedVersion: nextRevisedVersion,
    };

    const entry: ReviewAuditEntry = {
      id: `A-${Date.now()}-${auditSequence++}`,
      taskId: record.taskId,
      questionNo: record.candidate.questionNo,
      ...decision,
    };

    set((state) => ({
      decisions: {
        ...state.decisions,
        [record.id]: decision,
      },
      audit: [entry, ...state.audit],
    }));

    return entry;
  },
}));
