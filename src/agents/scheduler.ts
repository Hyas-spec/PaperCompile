import type {
  AgentName,
  ArbitrationAgentOutput,
  CandidateQuestion,
  ComposeAgentOutput,
  PaperDraft,
  PropositionTask,
  QuestionType,
  ReviewAgentOutput,
  ThreeStateConclusion,
  ValidationReport,
} from '../types';
import type { PropositionContext } from '../pages/propositionData';
import {
  AgentSchemaError,
  validateArbitrationInput,
  validateArbitrationOutput,
  validateComposeInput,
  validateComposeOutput,
  validatePlanningInput,
  validatePlanningOutput,
  validatePropositionInput,
  validatePropositionOutput,
  validateReviewInput,
  validateReviewOutput,
  validateValidationInput,
  validateValidationOutput,
} from './schema';
import {
  arbitrationAgent,
  composeAgent,
  planAgent,
  propositionAgent,
  reviewAgent,
  toTraceL1,
  validationAgent,
  type MockPlanningInput,
  type MockPropositionInput,
} from './mockAgents';

export type RunStatus =
  | '未开始'
  | '规划中'
  | '运行中'
  | '组卷中'
  | '已完成'
  | '失败';

export type TaskPhase =
  | '待调度'
  | '命题'
  | '审题'
  | '校验'
  | '仲裁'
  | '完成'
  | '失败';

export interface TaskStats {
  pass: number;
  review: number;
  blocked: number;
}

export interface PlannedTask extends PropositionTask {
  score: number;
  expectedDifficulty: number;
  knowledgePointNames: string[];
  contractClauses: string[];
  variantCount: number;
}

export interface CandidateRun {
  id: string;
  taskId: string;
  variant: 'A' | 'B';
  round: number;
  candidate: CandidateQuestion;
  review: ReviewAgentOutput;
  validation: ValidationReport;
  arbitration?: ArbitrationAgentOutput;
  finalConclusion: ThreeStateConclusion;
  finalReason: string;
}

export interface TaskPatch {
  status?: TaskPhase;
  candidateCount?: number;
  attempt?: number;
  round?: number;
  error?: string;
  stats?: TaskStats;
}

export interface RunLog {
  id: string;
  time: string;
  source: string;
  message: string;
  tone: 'info' | 'pass' | 'hint' | 'block';
}

export interface RunSummary {
  tasks: number;
  candidates: number;
  pass: number;
  review: number;
  blocked: number;
  reviewNeeds: number;
  escalated: number;
  retries: number;
  failed: number;
}

export interface RegenerateFilter {
  chapter?: string;
  questionType?: QuestionType;
}

export interface SchedulerHooks {
  onStatus: (status: RunStatus) => void;
  onTasksPlanned: (tasks: PlannedTask[]) => void;
  onTaskUpdate: (taskId: string, patch: TaskPatch) => void;
  onTasksReset: (taskIds: string[], round: number) => void;
  onCandidates: (taskId: string, records: CandidateRun[]) => void;
  onDraft: (draft: PaperDraft | null) => void;
  onLog: (log: RunLog) => void;
  onSummary: (summary: RunSummary) => void;
}

const CONCURRENCY = 3;
const RETRY_LIMIT = 2;
const FIRST_TWO_CANDIDATE_TASK = 11;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const statsOf = (records: CandidateRun[]): TaskStats => ({
  pass: records.filter((record) => record.finalConclusion === '通过').length,
  review: records.filter((record) => record.finalConclusion === '需复核').length,
  blocked: records.filter((record) => record.finalConclusion === '拦截').length,
});

/**
 * 纯前端调度器：不依赖 React，按“规划 → 命题 → 审题 → 校验 → 仲裁 → 组卷”
 * 推进任务；审题只接收 TraceL1，不接收命题说明。
 */
export class PropositionScheduler {
  private readonly context: PropositionContext;
  private readonly hooks: SchedulerHooks;

  private tasks: PlannedTask[] = [];
  private records = new Map<string, CandidateRun[]>();
  private failed = new Set<string>();
  private round = 1;
  private logSeq = 0;
  private retries = 0;
  private running = false;

  constructor(context: PropositionContext, hooks: SchedulerHooks) {
    this.context = context;
    this.hooks = hooks;
  }

  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.round = 1;
    this.logSeq = 0;
    this.retries = 0;
    this.tasks = [];
    this.records.clear();
    this.failed.clear();
    this.hooks.onStatus('规划中');

    try {
      this.log('规划 Agent', '读取命题蓝图 v1 与命题契约 v1，开始拆分任务单', 'info');
      const planInput: MockPlanningInput = {
        blueprint: this.context.blueprint,
        contract: this.context.contract,
        knowledgeBase: this.context.knowledgeBase,
      };
      validatePlanningInput(planInput);
      const plan = planAgent(planInput);
      validatePlanningOutput(plan);
      this.tasks = this.enrich(plan.tasks);
      this.hooks.onTasksPlanned(this.tasks);

      const difficultyScore = this.tasks.reduce(
        (result, task) => {
          result[task.difficulty] += task.score;
          return result;
        },
        { 易: 0, 中: 0, 难: 0 },
      );
      this.log(
        '规划 Agent',
        `拆分 ${this.tasks.length} 个任务单；难度按分值：易 ${difficultyScore.易} / 中 ${difficultyScore.中} / 难 ${difficultyScore.难}`,
        'pass',
      );

      this.hooks.onStatus('运行中');
      await this.runTasks(this.tasks, this.round);

      this.hooks.onStatus('组卷中');
      await this.compose();
      this.hooks.onStatus('已完成');
      this.summary();
    } catch (error) {
      this.hooks.onStatus('失败');
      this.log('调度队列', `运行失败：${errorMessage(error)}`, 'block');
    } finally {
      this.running = false;
    }
  }

  async regenerate(filter: RegenerateFilter): Promise<void> {
    if (this.running || this.tasks.length === 0) return;
    const selected = this.tasks.filter(
      (task) =>
        (!filter.chapter || task.chapter === filter.chapter) &&
        (!filter.questionType || task.questionType === filter.questionType),
    );
    if (selected.length === 0) {
      this.log('调度队列', '局部重出未找到匹配任务', 'hint');
      return;
    }

    this.running = true;
    this.round += 1;
    this.hooks.onStatus('运行中');
    const taskIds = selected.map((task) => task.id);
    this.hooks.onTasksReset(taskIds, this.round);
    taskIds.forEach((taskId) => {
      this.records.delete(taskId);
      this.failed.delete(taskId);
    });
    this.log(
      '调度队列',
      `局部重出：${filter.chapter ?? '全部章节'} × ${filter.questionType ?? '全部题型'}，${selected.length} 个任务；其余任务与候选保持不变`,
      'info',
    );

    try {
      await this.runTasks(selected, this.round);
      this.hooks.onStatus('组卷中');
      await this.compose();
      this.hooks.onStatus('已完成');
      this.summary();
    } catch (error) {
      this.hooks.onStatus('失败');
      this.log('调度队列', `局部重出失败：${errorMessage(error)}`, 'block');
    } finally {
      this.running = false;
    }
  }

  async retryFailed(): Promise<void> {
    if (this.running) return;
    const failedTasks = this.tasks.filter((task) => this.failed.has(task.id));
    if (failedTasks.length === 0) return;

    this.running = true;
    this.hooks.onStatus('运行中');
    this.hooks.onTasksReset(
      failedTasks.map((task) => task.id),
      this.round,
    );
    this.log('调度队列', `失败重试：${failedTasks.length} 个任务重新入队`, 'info');

    try {
      await this.runTasks(failedTasks, this.round);
      this.hooks.onStatus('组卷中');
      await this.compose();
      this.hooks.onStatus('已完成');
      this.summary();
    } catch (error) {
      this.hooks.onStatus('失败');
      this.log('调度队列', `失败重试失败：${errorMessage(error)}`, 'block');
    } finally {
      this.running = false;
    }
  }

  private enrich(tasks: PropositionTask[]): PlannedTask[] {
    return tasks.map((task, index) => {
      const cell = this.context.blueprint.cells.find(
        (candidate) =>
          candidate.chapter === task.chapter &&
          candidate.questionType === task.questionType,
      );
      const knowledgePointNames = task.context.knowledgePointIds.map(
        (id) => this.context.knowledgeById.get(id)?.name ?? id,
      );
      const contractClauses = task.context.contractItemIds.map(
        (id) => this.context.contractByItem.get(id)?.clause ?? id,
      );
      return {
        ...task,
        score: cell ? cell.score / cell.questionCount : 0,
        expectedDifficulty:
          cell?.difficulty ?? this.context.blueprint.difficultyPlan.expected,
        knowledgePointNames,
        contractClauses,
        variantCount: index >= FIRST_TWO_CANDIDATE_TASK ? 2 : 1,
      };
    });
  }

  private async runTasks(tasks: PlannedTask[], round: number): Promise<void> {
    const queue = [...tasks];
    const workers = Array.from(
      { length: Math.min(CONCURRENCY, queue.length) },
      async () => {
        while (queue.length > 0) {
          const task = queue.shift();
          if (!task) break;
          try {
            const records = await this.runTask(task, round);
            this.records.set(task.id, records);
            this.failed.delete(task.id);
            const stats = statsOf(records);
            this.hooks.onTaskUpdate(task.id, {
              status: '完成',
              candidateCount: records.length,
              stats,
            });
            this.log(
              '调度队列',
              `${task.id} 完成：候选 ${records.length} · 通过 ${stats.pass} · 需复核 ${stats.review} · 拦截 ${stats.blocked}`,
              stats.blocked > 0
                ? 'block'
                : stats.review > 0
                  ? 'hint'
                  : 'pass',
            );
            await delay(35);
          } catch (error) {
            this.failed.add(task.id);
            const message = errorMessage(error);
            this.hooks.onTaskUpdate(task.id, { status: '失败', error: message });
            this.log('调度队列', `${task.id} 失败：${message}`, 'block');
          }
        }
      },
    );
    await Promise.all(workers);
  }

  private async runTask(
    task: PlannedTask,
    round: number,
  ): Promise<CandidateRun[]> {
    this.hooks.onTaskUpdate(task.id, {
      status: '命题',
      candidateCount: 0,
      attempt: 0,
      round,
      error: undefined,
      stats: { pass: 0, review: 0, blocked: 0 },
    });

    const variants: Array<'A' | 'B'> =
      task.variantCount === 2 ? ['A', 'B'] : ['A'];
    const generated: Array<{
      candidate: CandidateQuestion;
      variant: 'A' | 'B';
    }> = [];

    for (const variant of variants) {
      await delay(60);
      validatePropositionInput({ task });
      const output = await this.invoke(
        '命题 Agent',
        (attempt) =>
          propositionAgent({
            task,
            variant,
            attempt,
            round,
            knowledgeBase: this.context.knowledgeBase,
          } satisfies MockPropositionInput),
        validatePropositionOutput,
        (attempt) => this.hooks.onTaskUpdate(task.id, { attempt }),
      );
      generated.push({ candidate: output.candidate, variant });
      this.hooks.onTaskUpdate(task.id, {
        candidateCount: generated.length,
      });
    }

    this.hooks.onTaskUpdate(task.id, { status: '审题' });
    const reviews: ReviewAgentOutput[] = [];
    for (const item of generated) {
      await delay(45);
      const reviewInput = { question: toTraceL1(item.candidate) };
      validateReviewInput(reviewInput);
      const review = await this.invoke(
        '审题 Agent',
        () => reviewAgent(reviewInput),
        validateReviewOutput,
      );
      reviews.push(review);
      if (review.conclusion !== '通过') {
        this.log(
          '审题 Agent',
          `${item.candidate.questionNo}：需复核（${review.issues.length} 项疑点；输入仅 L1 题目，不含命题说明）`,
          'hint',
        );
      }
    }

    this.hooks.onTaskUpdate(task.id, { status: '校验' });
    const validations: ValidationReport[] = [];
    for (const item of generated) {
      await delay(45);
      const validationInput = {
        question: item.candidate,
        blueprint: this.context.blueprint,
        contract: this.context.contract,
        syllabus: this.context.syllabus,
        knowledgeBase: this.context.knowledgeBase,
        historyBank: this.context.historyBank,
      };
      validateValidationInput(validationInput);
      const validation = await this.invoke(
        '校验 Agent',
        () => validationAgent(validationInput),
        validateValidationOutput,
      );
      validations.push(validation);
      if (validation.overall !== '通过') {
        const gate = validation.results.find(
          (result) => result.conclusion === validation.overall,
        );
        this.log(
          '校验 Agent',
          `${item.candidate.questionNo}：${validation.overall} · ${gate?.gate ?? '七道闸门'}`,
          validation.overall === '拦截' ? 'block' : 'hint',
        );
      }
    }

    const arbitrations: Array<ArbitrationAgentOutput | undefined> = [];
    let arbitrationStarted = false;
    for (let index = 0; index < generated.length; index += 1) {
      const review = reviews[index];
      const validation = validations[index];
      if (review.conclusion === '通过' || validation.overall === '拦截') {
        arbitrations.push(undefined);
        continue;
      }
      if (!arbitrationStarted) {
        this.hooks.onTaskUpdate(task.id, { status: '仲裁' });
        arbitrationStarted = true;
      }
      const item = generated[index];
      const arbitrationInput = {
        question: item.candidate,
        propositionNote: item.candidate.propositionNote,
        review,
      };
      validateArbitrationInput(arbitrationInput);
      const arbitration = await this.invoke(
        '仲裁 Agent',
        () => arbitrationAgent(arbitrationInput),
        validateArbitrationOutput,
      );
      arbitrations.push(arbitration);
      this.log(
        '仲裁 Agent',
        arbitration.escalatedToHuman
          ? `${item.candidate.questionNo}：需复核，升级人工`
          : `${item.candidate.questionNo}：${arbitration.conclusion}（${arbitration.reason}）`,
        arbitration.escalatedToHuman
          ? 'hint'
          : arbitration.conclusion === '拦截'
            ? 'block'
            : 'pass',
      );
    }

    const records = generated.map((item, index): CandidateRun => {
      const review = reviews[index];
      const validation = validations[index];
      const arbitration = arbitrations[index];
      const final = this.finalConclusion(
        review,
        validation,
        arbitration,
      );
      return {
        id: item.candidate.id,
        taskId: task.id,
        variant: item.variant,
        round,
        candidate: item.candidate,
        review,
        validation,
        arbitration,
        finalConclusion: final.conclusion,
        finalReason: final.reason,
      };
    });

    this.hooks.onCandidates(task.id, records);
    return records;
  }

  private finalConclusion(
    review: ReviewAgentOutput,
    validation: ValidationReport,
    arbitration?: ArbitrationAgentOutput,
  ): { conclusion: ThreeStateConclusion; reason: string } {
    if (validation.overall === '拦截') {
      const gate = validation.results.find(
        (result) => result.conclusion === '拦截',
      );
      return {
        conclusion: '拦截',
        reason: gate?.evidence[0] ?? '七道闸门拦截',
      };
    }
    if (review.conclusion === '通过') {
      return {
        conclusion: validation.overall,
        reason:
          validation.overall === '通过'
            ? '审题与七道闸门均通过'
            : '校验 Agent 提示需复核',
      };
    }
    if (arbitration) {
      if (arbitration.conclusion === '拦截') {
        return { conclusion: '拦截', reason: arbitration.reason };
      }
      if (arbitration.conclusion === '通过' && validation.overall === '通过') {
        return { conclusion: '通过', reason: arbitration.reason };
      }
      return { conclusion: '需复核', reason: arbitration.reason };
    }
    return { conclusion: '需复核', reason: '审题结论需复核' };
  }

  private async compose(): Promise<void> {
    const finalQuestions = this.tasks
      .map((task) =>
        this.records
          .get(task.id)
          ?.find((record) => record.finalConclusion === '通过'),
      )
      .filter((record): record is CandidateRun => Boolean(record))
      .map((record) => record.candidate);

    if (finalQuestions.length === 0) {
      this.hooks.onDraft(null);
      this.log('组卷 Agent', '暂无可进入草案的通过题，未生成试卷草案', 'hint');
      return;
    }

    const composeInput = {
      finalQuestions,
      blueprint: this.context.blueprint,
    };
    validateComposeInput(composeInput);
    const output: ComposeAgentOutput = await this.invoke(
      '组卷 Agent',
      () => composeAgent(composeInput),
      validateComposeOutput,
    );
    this.hooks.onDraft(output.draft);
    const weightedDifficulty =
      output.draft.totalScore > 0
        ? output.draft.questions.reduce(
            (total, question) => total + question.difficulty * question.score,
            0,
          ) / output.draft.totalScore
        : 0;
    const target = this.context.blueprint.difficultyPlan;
    this.log(
      '组卷 Agent',
      `生成试卷草案：${output.draft.questions.length} 题 / ${output.draft.totalScore} 分 / ${output.draft.durationMinutes} 分钟 · 整卷期望难度 ${weightedDifficulty.toFixed(2)}（目标 ${target.expected.toFixed(2)} ± ${target.tolerance.toFixed(2)}），待教师终审`,
      'pass',
    );
  }

  private summary(): void {
    const all = [...this.records.values()].flat();
    const pass = all.filter(
      (record) => record.finalConclusion === '通过',
    ).length;
    const review = all.filter(
      (record) => record.finalConclusion === '需复核',
    ).length;
    const blocked = all.filter(
      (record) => record.finalConclusion === '拦截',
    ).length;
    const reviewNeeds = all.filter(
      (record) => record.review.conclusion !== '通过',
    ).length;
    const escalated = all.filter(
      (record) => record.arbitration?.escalatedToHuman,
    ).length;

    const summary: RunSummary = {
      tasks: this.tasks.length,
      candidates: all.length,
      pass,
      review,
      blocked,
      reviewNeeds,
      escalated,
      retries: this.retries,
      failed: this.failed.size,
    };
    this.hooks.onSummary(summary);
    this.log(
      '调度队列',
      `运行完成：生成 ${summary.candidates} 候选（入池 ${summary.candidates - summary.blocked}）· 通过 ${pass} · 需复核 ${review} · 拦截 ${blocked}；审题需复核 ${reviewNeeds}，仲裁升级 ${escalated}`,
      blocked > 0 || review > 0 ? 'hint' : 'pass',
    );
  }

  private async invoke<T>(
    agent: AgentName,
    fn: (attempt: number) => T | Promise<T>,
    validate: (value: T) => void,
    onRetry?: (attempt: number) => void,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_LIMIT; attempt += 1) {
      try {
        const value = await fn(attempt);
        validate(value);
        return value;
      } catch (error) {
        lastError = error;
        if (!(error instanceof AgentSchemaError) || attempt === RETRY_LIMIT) {
          throw error;
        }
        this.retries += 1;
        onRetry?.(attempt + 1);
        this.log(
          '调度队列',
          `${agent} schema 校验失败：${error.message}；第 ${attempt + 1} 次重试`,
          'hint',
        );
        await delay(120);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`${agent} 调用失败`);
  }

  private log(
    source: string,
    message: string,
    tone: RunLog['tone'],
  ): void {
    this.logSeq += 1;
    this.hooks.onLog({
      id: `log-${this.logSeq}`,
      time: new Date().toISOString(),
      source,
      message,
      tone,
    });
  }
}
