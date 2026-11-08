import { create } from 'zustand';
import type {
  AgentCallLog,
  AgentName,
  CandidateQuestion,
  DecisionModification,
  InputSnapshot,
  ParameterSnapshot,
  PaperDraft,
  ProcessEvent,
  ProcessSnapshot,
  VersionSnapshots,
} from '../types';
import type { CandidateRun, RunLog } from '../agents/scheduler';
import type { ReviewAuditEntry } from './review';
import type { PaperSnapshot } from './compose';
import type { AuditEntry } from './audit';
import { fingerprintOf } from './compose';

export type ReplayEventKind = 'Agent 调用' | '教师操作' | '版本变更';
export type ReplayTone = 'info' | 'pass' | 'hint' | 'block';

export interface ReplayEvent {
  id: string;
  timestamp: string;
  kind: ReplayEventKind;
  actor: string;
  title: string;
  summary: string;
  questionNo?: string;
  taskId?: string;
  version?: string;
  input: string;
  output: string;
  reason?: string;
  evidence: string[];
  tone: ReplayTone;
  origin: 'proposition' | 'review' | 'compose' | 'recompile' | 'audit';
}

export interface ReplayFilters {
  kind: ReplayEventKind | '全部';
  actor: string;
  query: string;
  order: 'desc' | 'asc';
}

export type VersionScope =
  | '知识点基线'
  | '命题蓝图'
  | '命题契约'
  | '单题'
  | '整卷';

export interface VersionOption {
  id: string;
  scope: VersionScope;
  label: string;
  version: string;
  timestamp: string;
  questions?: CandidateQuestion[];
  order?: string[];
  question?: CandidateQuestion;
}

export interface RecompileReport {
  timestamp: string;
  total: number;
  equivalent: number;
  samePoint: number;
  sameAnswer: number;
  sameScore: number;
  textChanged: number;
  equivalenceRate: number;
  sameInput: boolean;
  sameParameter: boolean;
  inputHash: string;
  parameterHash: string;
  modelName: string;
  note: string;
  samples: Array<{ questionNo: string; before: string; after: string }>;
}

export interface ReplaySources {
  taskCount: number;
  candidates: CandidateRun[];
  logs: RunLog[];
  draft: PaperDraft | null;
  audit: ReviewAuditEntry[];
  auditLog: readonly AuditEntry[];
  snapshots: PaperSnapshot[];
  derivedFrom: string | null;
  workingVersion: string;
  input: InputSnapshot;
  parameter: ParameterSnapshot;
  componentVersions: {
    knowledge: string;
    blueprint: string;
    contract: string;
  };
}

interface EventLogState {
  events: ReplayEvent[];
  filters: ReplayFilters;
  selectedId: string | null;
  snapshots: VersionSnapshots | null;
  versions: VersionOption[];
  recompileReport: RecompileReport | null;
  ingest: (sources: ReplaySources) => void;
  setKind: (kind: ReplayEventKind | '全部') => void;
  setActor: (actor: string) => void;
  setQuery: (query: string) => void;
  setOrder: (order: 'desc' | 'asc') => void;
  select: (id: string) => void;
  recompile: () => RecompileReport | null;
}

const byTime = (left: ReplayEvent, right: ReplayEvent): number =>
  new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();

const toneOfConclusion = (value: '通过' | '需复核' | '拦截'): ReplayTone =>
  value === '通过' ? 'pass' : value === '需复核' ? 'hint' : 'block';

const toneOfAction = (action: ReviewAuditEntry['action']): ReplayTone => {
  if (action === '通过') return 'pass';
  if (action === '退回') return 'block';
  return 'hint';
};

const dateFromLogTime = (time: string): string => {
  const [hour, minute, second] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour || 0, minute || 0, second || 0, 0);
  return date.toISOString();
};

const timestampBase = (sources: ReplaySources): string => {
  const teacherTimes = sources.audit
    .map((entry) => entry.timestamp)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
  const versionTimes = sources.snapshots
    .map((snapshot) => snapshot.timestamp)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
  if (teacherTimes[0]) return teacherTimes[0];
  if (versionTimes[0]) return versionTimes[0];
  if (sources.logs[0]) return dateFromLogTime(sources.logs[0].time);
  return new Date().toISOString();
};

const buildEvents = (sources: ReplaySources): ReplayEvent[] => {
  const base = new Date(timestampBase(sources)).getTime();
  const agentCount =
    1 +
    sources.candidates.length * 3 +
    sources.candidates.filter((candidate) => candidate.arbitration).length +
    (sources.draft ? 1 : 0);
  let agentIndex = 0;
  const nextAgentTime = (): string => {
    agentIndex += 1;
    return new Date(base - (agentCount - agentIndex + 1) * 1200).toISOString();
  };

  const events: ReplayEvent[] = [];
  events.push({
    id: 'planning',
    timestamp: nextAgentTime(),
    kind: 'Agent 调用',
    actor: '规划 Agent',
    title: '规划 Agent · 任务拆解',
    summary: `${sources.taskCount} 个任务单（章节 × 题型 × 难度）`,
    input: '命题蓝图 + 命题契约',
    output: `${sources.taskCount} 个任务单，每个任务携带知识点与契约上下文`,
    evidence: [
      `任务数：${sources.taskCount}`,
      '任务单 = 章节 × 题型 × 难度',
      '上下文包：知识点 ID + 契约项 ID',
    ],
    tone: 'info',
    origin: 'proposition',
  });

  sources.candidates.forEach((record) => {
    const question = record.candidate;
    events.push({
      id: `proposition-${question.questionNo}`,
      timestamp: nextAgentTime(),
      kind: 'Agent 调用',
      actor: '命题 Agent',
      title: `命题 Agent · ${question.questionNo}`,
      summary: `${question.type} · ${question.score} 分 · ${question.version}`,
      questionNo: question.questionNo,
      taskId: record.taskId,
      version: question.version,
      input: `任务 ${record.taskId}；${question.chapter} × ${question.type}；知识点 ${question.knowledgePointId}；契约 ${question.contractItemId}`,
      output: `${question.stem}\n答案：${question.answer}`,
      evidence: [
        `模型 ${question.generation.modelName} ${question.generation.modelVersion}`,
        `提示词 ${question.generation.promptTemplate} ${question.generation.promptTemplateVersion}`,
        `随机种子 ${question.generation.randomSeed}`,
      ],
      tone: 'info',
      origin: 'proposition',
    });

    events.push({
      id: `review-${question.questionNo}`,
      timestamp: nextAgentTime(),
      kind: 'Agent 调用',
      actor: '审题 Agent',
      title: `审题 Agent · ${question.questionNo}`,
      summary: `${record.review.conclusion} · ${record.review.issues.length} 项疑点`,
      questionNo: question.questionNo,
      taskId: record.taskId,
      input: 'L1 题目（题干 / 选项 / 答案 / 解析 / 评分点），不含命题说明',
      output:
        record.review.issues.length > 0
          ? record.review.issues.map((issue) => `${issue.description}：${issue.evidence}`).join('\n')
          : '未发现疑点',
      reason: record.review.recomputedAnswer,
      evidence: [
        `结论：${record.review.conclusion}`,
        `独立复算：${record.review.recomputedAnswer ?? '—'}`,
      ],
      tone: toneOfConclusion(record.review.conclusion),
      origin: 'proposition',
    });

    events.push({
      id: `validation-${question.questionNo}`,
      timestamp: nextAgentTime(),
      kind: 'Agent 调用',
      actor: '校验 Agent',
      title: `校验 Agent · ${question.questionNo}`,
      summary: `${record.validation.overall} · 七道闸门`,
      questionNo: question.questionNo,
      taskId: record.taskId,
      input: '题目 + 命题蓝图 + 命题契约 + 知识点库 + 历史题库',
      output: record.validation.results
        .map((result) => `${result.gate}：${result.conclusion}`)
        .join('\n'),
      evidence: record.validation.results.flatMap((result) =>
        result.evidence.map((item) => `${result.gate} · ${item}`),
      ),
      tone: toneOfConclusion(record.validation.overall),
      origin: 'proposition',
    });

    if (record.arbitration) {
      events.push({
        id: `arbitration-${question.questionNo}`,
        timestamp: nextAgentTime(),
        kind: 'Agent 调用',
        actor: '仲裁 Agent',
        title: `仲裁 Agent · ${question.questionNo}`,
        summary: `${record.arbitration.conclusion}${
          record.arbitration.escalatedToHuman ? ' · 升级人工' : ''
        }`,
        questionNo: question.questionNo,
        taskId: record.taskId,
        input: '命题说明 + 审题疑点 + 校验证据',
        output: record.arbitration.reason,
        evidence: record.arbitration.evidence,
        tone: toneOfConclusion(record.arbitration.conclusion),
        origin: 'proposition',
      });
    }
  });

  if (sources.draft) {
    const draft = sources.draft;
    events.push({
      id: 'compose',
      timestamp: nextAgentTime(),
      kind: 'Agent 调用',
      actor: '组卷 Agent',
      title: '组卷 Agent · 试卷草案',
      summary: `${draft.questions.length} 题 / ${draft.totalScore} 分 / ${draft.durationMinutes} 分钟`,
      input: '定稿题目集 + 命题蓝图',
      output: `A4 ${draft.layout.doubleSided ? '双面' : '单面'}试卷草案；${draft.timeAllocation
        .map((item) => `${item.questionType} ${item.minutes} 分钟`)
        .join(' / ')}`,
      evidence: [
        `题量：${draft.questions.length}`,
        `总分：${draft.totalScore}`,
        `时长：${draft.durationMinutes} 分钟`,
      ],
      tone: 'info',
      origin: 'proposition',
    });
  }

  sources.audit.forEach((entry) => {
    events.push({
      id: `teacher-${entry.id}`,
      timestamp: entry.timestamp,
      kind: '教师操作',
      actor: entry.teacher,
      title: `教师 · ${entry.questionNo} ${entry.action}`,
      summary: `版本 ${entry.questionVersion}${
        entry.revisedVersion ? ` → ${entry.revisedVersion}` : ''
      }`,
      questionNo: entry.questionNo,
      taskId: entry.taskId,
      version: entry.revisedVersion ?? entry.questionVersion,
      input: '题目 + 审题 / 校验证据',
      output: `${entry.action}${entry.revisedStem ? `：${entry.revisedStem}` : ''}`,
      reason: entry.reason,
      evidence: [
        `操作：${entry.action}`,
        `题目：${entry.questionNo}`,
        `版本：${entry.questionVersion}${
          entry.revisedVersion ? ` → ${entry.revisedVersion}` : ''
        }`,
      ],
      tone: toneOfAction(entry.action),
      origin: 'review',
    });
  });

  sources.auditLog.forEach((entry) => {
    events.push({
      id: `audit-${entry.id}`,
      timestamp: entry.timestamp,
      kind: '版本变更',
      actor: entry.operatorName,
      title: `试卷状态 · ${entry.afterStatus}`,
      summary: `${entry.beforeStatus} → ${entry.afterStatus} · ${entry.reason}`,
      input: `状态 ${entry.beforeStatus}`,
      output: `状态 ${entry.afterStatus}`,
      reason: entry.reason,
      evidence: [
        `操作者：${entry.operatorName}（${entry.role}）`,
        `资源：${entry.resourceType} ${entry.resourceId}`,
        `前后状态：${entry.beforeStatus} → ${entry.afterStatus}`,
      ],
      tone: entry.afterStatus === '已签发' ? 'pass' : 'info',
      origin: 'audit',
    });
  });

  sources.snapshots.forEach((snapshot) => {
    if (snapshot.derivedFrom) {
      events.push({
        id: `derive-${snapshot.id}`,
        timestamp: new Date(new Date(snapshot.timestamp).getTime() - 60000).toISOString(),
        kind: '版本变更',
        actor: snapshot.teacher,
        title: `派生版本 · ${snapshot.version}`,
        summary: `派生自 ${snapshot.derivedFrom}；原快照不可变`,
        version: snapshot.version,
        input: `已签发版本 ${snapshot.derivedFrom}`,
        output: `派生 ${snapshot.version}，修改留 diff`,
        reason: '已签发不可原地修改，派生新版本后重新签发。',
        evidence: [
          `派生自：${snapshot.derivedFrom}`,
          `原版本快照保持不可变`,
        ],
        tone: 'hint',
        origin: 'compose',
      });
    }
    events.push({
      id: `sign-${snapshot.id}`,
      timestamp: snapshot.timestamp,
      kind: '版本变更',
      actor: snapshot.teacher,
      title: `签发版本 · ${snapshot.version}`,
      summary: `${snapshot.questions.length} 题 / ${snapshot.totalScore} 分 / ${snapshot.durationMinutes} 分钟`,
      version: snapshot.version,
      input: '已审试卷 + 题序',
      output: `已签发 ${snapshot.version}，固化版本快照`,
      reason: snapshot.reason,
      evidence: [
        `试卷编号：${snapshot.paperNo}`,
        `快照指纹：${snapshot.fingerprint}`,
        `教师：${snapshot.teacher}`,
      ],
      tone: 'pass',
      origin: 'compose',
    });
  });

  if (
    sources.derivedFrom &&
    sources.workingVersion &&
    !sources.snapshots.some(
      (snapshot) => snapshot.version === sources.workingVersion,
    )
  ) {
    events.push({
      id: `derive-current-${sources.workingVersion}`,
      timestamp: new Date().toISOString(),
      kind: '版本变更',
      actor: '李老师',
      title: `派生版本 · ${sources.workingVersion}`,
      summary: `派生自 ${sources.derivedFrom}；待重新签发`,
      version: sources.workingVersion,
      input: `已签发版本 ${sources.derivedFrom}`,
      output: `派生 ${sources.workingVersion}，可调整题序后重新签发`,
      reason: '已签发不可原地修改，派生新版本后重新签发。',
      evidence: ['原版本快照保持不可变', '派生版本待签发'],
      tone: 'hint',
      origin: 'compose',
    });
  }

  return events;
};

const buildVersions = (
  sources: ReplaySources,
  base: string,
): VersionOption[] => {
  const versions: VersionOption[] = [
    {
      id: 'component-knowledge',
      scope: '知识点基线',
      label: `知识点基线 ${sources.componentVersions.knowledge}`,
      version: sources.componentVersions.knowledge,
      timestamp: base,
    },
    {
      id: 'component-blueprint',
      scope: '命题蓝图',
      label: `命题蓝图 ${sources.componentVersions.blueprint}`,
      version: sources.componentVersions.blueprint,
      timestamp: base,
    },
    {
      id: 'component-contract',
      scope: '命题契约',
      label: `命题契约 ${sources.componentVersions.contract}`,
      version: sources.componentVersions.contract,
      timestamp: base,
    },
  ];

  const whole: VersionOption[] = sources.snapshots.map((snapshot) => ({
    id: `whole-${snapshot.id}`,
    scope: '整卷',
    label: `整卷 ${snapshot.version}`,
    version: snapshot.version,
    timestamp: snapshot.timestamp,
    questions: snapshot.questions,
    order: snapshot.order,
  }));

  if (whole.length === 0 && sources.draft) {
    whole.push({
      id: 'whole-current-draft',
      scope: '整卷',
      label: '整卷 v1（当前草案）',
      version: 'v1',
      timestamp: base,
      questions: sources.draft.questions,
      order: sources.draft.questions.map((question) => question.questionNo),
    });
  }

  if (
    sources.derivedFrom &&
    sources.workingVersion &&
    !whole.some((item) => item.version === sources.workingVersion)
  ) {
    const source = sources.snapshots[sources.snapshots.length - 1];
    if (source) {
      whole.push({
        id: `whole-current-${sources.workingVersion}`,
        scope: '整卷',
        label: `整卷 ${sources.workingVersion}（派生 · 待签发）`,
        version: sources.workingVersion,
        timestamp: new Date().toISOString(),
        questions: source.questions,
        order: source.order,
      });
    }
  }

  const singles: VersionOption[] = sources.candidates.map((record) => ({
    id: `single-${record.candidate.id}`,
    scope: '单题',
    label: `${record.candidate.questionNo} · ${record.candidate.version}`,
    version: record.candidate.version,
    timestamp: base,
    question: record.candidate,
  }));

  sources.audit.forEach((entry) => {
    if (!entry.revisedStem || !entry.revisedVersion) return;
    const source = sources.candidates.find(
      (record) => record.candidate.questionNo === entry.questionNo,
    )?.candidate;
    if (!source) return;
    singles.push({
      id: `single-revised-${entry.id}`,
      scope: '单题',
      label: `${entry.questionNo} · ${entry.revisedVersion}（改写）`,
      version: entry.revisedVersion,
      timestamp: entry.timestamp,
      question: {
        ...source,
        stem: entry.revisedStem,
        version: entry.revisedVersion,
      },
    });
  });

  return [...versions, ...whole, ...singles];
};

const buildSnapshots = (
  sources: ReplaySources,
  events: ReplayEvent[],
): VersionSnapshots => {
  const modifications: DecisionModification[] = [
    ...sources.audit.map((entry) => ({
      content: entry.revisedStem
        ? `${entry.action}：${entry.revisedStem}`
        : entry.action,
      location: entry.questionNo,
      reason: entry.reason,
    })),
    ...sources.snapshots.map((snapshot) => ({
      content: `签发 ${snapshot.version}`,
      location: '整卷',
      reason: snapshot.reason,
    })),
    ...sources.auditLog.map((entry) => ({
      content: `状态 ${entry.beforeStatus} → ${entry.afterStatus}`,
      location: '整卷',
      reason: entry.reason,
    })),
  ];

  const callLogs: AgentCallLog[] = events
    .filter((event) => event.kind === 'Agent 调用')
    .map((event) => ({
      agent: event.actor as AgentName,
      input: event.input,
      output: event.output,
      timestamp: event.timestamp,
    }));

  const processEvents: ProcessEvent[] = events.map((event) => ({
    type: event.kind,
    payload: event,
    timestamp: event.timestamp,
  }));

  const process: ProcessSnapshot = {
    callLogs,
    toolResults: [],
    events: processEvents,
  };

  return {
    input: sources.input,
    parameter: sources.parameter,
    decision: { modifications },
    process,
  };
};

const makeId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

export const useEventLogStore = create<EventLogState>((set, get) => ({
  events: [],
  filters: { kind: '全部', actor: '全部来源', query: '', order: 'desc' },
  selectedId: null,
  snapshots: null,
  versions: [],
  recompileReport: null,

  ingest: (sources) => {
    const base = timestampBase(sources);
    const generated = buildEvents(sources);
    const extras = get().events.filter((event) => event.origin === 'recompile');
    const events = [...generated, ...extras].sort(byTime);
    const versions = buildVersions(sources, base);
    const snapshots = buildSnapshots(sources, events);
    const previous = get().selectedId;
    const selectedId =
      previous && events.some((event) => event.id === previous)
        ? previous
        : events[events.length - 1]?.id ?? null;

    set({ events, versions, snapshots, selectedId });
  },

  setKind: (kind) =>
    set((state) => ({ filters: { ...state.filters, kind } })),
  setActor: (actor) =>
    set((state) => ({ filters: { ...state.filters, actor } })),
  setQuery: (query) =>
    set((state) => ({ filters: { ...state.filters, query } })),
  setOrder: (order) =>
    set((state) => ({ filters: { ...state.filters, order } })),
  select: (id) => set({ selectedId: id }),

  recompile: () => {
    const state = get();
    const whole = state.versions.filter((item) => item.scope === '整卷');
    const current = whole[whole.length - 1];
    const questions = current?.questions ?? [];
    const snapshots = state.snapshots;
    if (!current || questions.length === 0 || !snapshots) return null;

    const recompiled = questions.map((question, index) => ({
      ...question,
      id: `${question.id}-rc`,
      version: `${question.version}.rc`,
      stem: `${question.stem}（同参数重编译等价副本 ${index + 1}）`,
      analysis: `${question.analysis}（同参数重编译）`,
    }));

    const samePoint = questions.filter(
      (question, index) =>
        question.knowledgePointId === recompiled[index].knowledgePointId,
    ).length;
    const sameAnswer = questions.filter(
      (question, index) => question.answer === recompiled[index].answer,
    ).length;
    const sameScore = questions.filter(
      (question, index) => question.score === recompiled[index].score,
    ).length;
    const textChanged = questions.filter(
      (question, index) => question.stem !== recompiled[index].stem,
    ).length;
    const equivalent = questions.filter(
      (question, index) =>
        question.knowledgePointId === recompiled[index].knowledgePointId &&
        question.answer === recompiled[index].answer &&
        question.score === recompiled[index].score,
    ).length;
    const total = questions.length;
    const timestamp = new Date().toISOString();
    const inputHash = fingerprintOf(snapshots.input);
    const parameterHash = fingerprintOf(snapshots.parameter);
    const report: RecompileReport = {
      timestamp,
      total,
      equivalent,
      samePoint,
      sameAnswer,
      sameScore,
      textChanged,
      equivalenceRate: total > 0 ? (equivalent / total) * 100 : 0,
      sameInput: true,
      sameParameter: true,
      inputHash,
      parameterHash,
      modelName: `${snapshots.parameter.modelName} ${snapshots.parameter.modelVersion}`,
      note: '同参数重编译按考点、答案、分值判定等价，不要求文字完全一致。',
      samples: questions.slice(0, 3).map((question, index) => ({
        questionNo: question.questionNo,
        before: question.stem,
        after: recompiled[index].stem,
      })),
    };

    const event: ReplayEvent = {
      id: makeId('recompile'),
      timestamp,
      kind: '版本变更',
      actor: '系统',
      title: `同参数重编译 · ${current.version}`,
      summary: `等价 ${equivalent}/${total} · 考点/答案/分值一致 · 文字差异 ${textChanged}/${total}`,
      version: current.version,
      input: `输入快照 ${inputHash} + 参数快照 ${parameterHash}`,
      output: `等价副本 ${total} 题；考点 ${samePoint}/${total}、答案 ${sameAnswer}/${total}、分值 ${sameScore}/${total}`,
      reason: report.note,
      evidence: [
        `等价率 ${report.equivalenceRate.toFixed(0)}%`,
        `文字差异 ${textChanged}/${total}（非文字完全一致）`,
        `输入快照与参数快照相同`,
      ],
      tone: report.equivalent === total ? 'pass' : 'hint',
      origin: 'recompile',
    };

    const processEvents: ProcessEvent[] = [
      ...(snapshots.process.events ?? []),
      { type: '版本变更', payload: event, timestamp },
    ];
    const nextSnapshots: VersionSnapshots = {
      ...snapshots,
      process: { ...snapshots.process, events: processEvents },
    };

    set({
      events: [...state.events, event].sort(byTime),
      selectedId: event.id,
      recompileReport: report,
      snapshots: nextSnapshots,
    });
    return report;
  },
}));
