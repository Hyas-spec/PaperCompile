import { create } from 'zustand';
import type { PaperDraft } from '../types';
import {
  PROPOSITION_OVERVIEW,
  buildPropositionContext,
} from '../pages/propositionData';
import type {
  CandidateRun,
  PlannedTask,
  RegenerateFilter,
  RunLog,
  RunStatus,
  RunSummary,
  SchedulerHooks,
  TaskPatch,
  TaskPhase,
} from '../agents/scheduler';
import { PropositionScheduler } from '../agents/scheduler';
import type { InterceptionRecord } from '../agents/validator';
import { useContractStore } from './contract';
import { useKnowledgeStore } from './knowledge';

export interface PropositionTaskRun {
  task: PlannedTask;
  status: TaskPhase;
  candidateCount: number;
  attempt: number;
  round: number;
  error?: string;
  stats: {
    pass: number;
    review: number;
    blocked: number;
  };
}

interface PropositionState {
  status: RunStatus;
  tasks: PropositionTaskRun[];
  candidates: CandidateRun[];
  interceptions: InterceptionRecord[];
  draft: PaperDraft | null;
  logs: RunLog[];
  summary: RunSummary | null;
  selectedTaskId: string | null;
  overview: typeof PROPOSITION_OVERVIEW;
  start: () => Promise<void>;
  regenerate: (filter: RegenerateFilter) => Promise<void>;
  retryFailed: () => Promise<void>;
  selectTask: (taskId: string) => void;
}

let scheduler: PropositionScheduler | null = null;

const INITIAL: Pick<
  PropositionState,
  | 'status'
  | 'tasks'
  | 'candidates'
  | 'interceptions'
  | 'draft'
  | 'logs'
  | 'summary'
  | 'selectedTaskId'
  | 'overview'
> = {
  status: '未开始',
  tasks: [],
  candidates: [],
  interceptions: [],
  draft: null,
  logs: [],
  summary: null,
  selectedTaskId: null,
  overview: PROPOSITION_OVERVIEW,
};

export const usePropositionStore = create<PropositionState>((set, get) => ({
  ...INITIAL,

  start: async () => {
    const status = get().status;
    if (status === '规划中' || status === '运行中' || status === '组卷中') {
      return;
    }
    if (status === '已完成') return;

    const contract = useContractStore.getState().contract;
    const points = useKnowledgeStore.getState().points;
    const context = buildPropositionContext(contract, points);

    set({
      ...INITIAL,
      status: '规划中',
      overview: {
        ...PROPOSITION_OVERVIEW,
        contractItems: context.contract.items.length,
        knowledgePoints: context.knowledgeBase.length,
      },
    });

    const hooks: SchedulerHooks = {
      onStatus: (next) => set({ status: next }),
      onTasksPlanned: (planned) => {
        const tasks = planned.map((task) => ({
          task,
          status: '待调度' as TaskPhase,
          candidateCount: 0,
          attempt: 0,
          round: 1,
          stats: { pass: 0, review: 0, blocked: 0 },
        }));
        set((state) => ({
          tasks,
          selectedTaskId: state.selectedTaskId ?? tasks[0]?.task.id ?? null,
        }));
      },
      onTaskUpdate: (taskId, patch: TaskPatch) =>
        set((state) => ({
          tasks: state.tasks.map((run) =>
            run.task.id === taskId
              ? {
                  ...run,
                  ...patch,
                  stats: patch.stats ?? run.stats,
                }
              : run,
          ),
        })),
      onTasksReset: (taskIds, round) =>
        set((state) => ({
          candidates: state.candidates.filter(
            (candidate) => !taskIds.includes(candidate.taskId),
          ),
          interceptions: state.interceptions.filter(
            (interception) =>
              !interception.taskId || !taskIds.includes(interception.taskId),
          ),
          tasks: state.tasks.map((run) =>
            taskIds.includes(run.task.id)
              ? {
                  ...run,
                  status: '待调度',
                  candidateCount: 0,
                  attempt: 0,
                  round,
                  error: undefined,
                  stats: { pass: 0, review: 0, blocked: 0 },
                }
              : run,
          ),
        })),
      onCandidates: (taskId, records: CandidateRun[]) =>
        set((state) => ({
          candidates: [
            ...state.candidates.filter(
              (candidate) => candidate.taskId !== taskId,
            ),
            ...records,
          ],
          interceptions: [
            ...state.interceptions.filter(
              (interception) => interception.taskId !== taskId,
            ),
            ...records.flatMap((record) =>
              record.interception ? [record.interception] : [],
            ),
          ],
        })),
      onDraft: (draft) => set({ draft }),
      onLog: (log) =>
        set((state) => ({
          logs: [log, ...state.logs].slice(0, 120),
        })),
      onSummary: (summary) => set({ summary }),
    };

    scheduler = new PropositionScheduler(context, hooks);
    await scheduler.run();
  },

  regenerate: async (filter) => {
    if (!scheduler) return;
    await scheduler.regenerate(filter);
  },

  retryFailed: async () => {
    if (!scheduler) return;
    await scheduler.retryFailed();
  },

  selectTask: (taskId) => set({ selectedTaskId: taskId }),
}));
