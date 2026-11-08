import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  CandidateQuestion,
  InputSnapshot,
  ParameterSnapshot,
  QuestionTrace,
  TraceL7,
  VersionSnapshots,
} from '../types';
import { usePropositionStore } from '../store/proposition';
import { useReviewStore, type ReviewDecision } from '../store/review';
import { useComposeStore } from '../store/compose';
import { usePaperStore } from '../store';
import { useAuditLogStore } from '../store/audit';
import { useContractStore } from '../store/contract';
import { useKnowledgeStore } from '../store/knowledge';
import {
  buildPropositionContext,
  type PropositionContext,
} from './propositionData';
import { fingerprintOf } from '../store/compose';
import {
  useEventLogStore,
  type RecompileReport,
  type VersionOption,
} from '../store/events';
import '../styles/replay.css';

type ReplayTrace = Omit<QuestionTrace, 'L7'> & { L7?: TraceL7 };

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

const difficultyLevelOf = (coefficient: number): '易' | '中' | '难' =>
  coefficient >= 0.8 ? '易' : coefficient >= 0.6 ? '中' : '难';

const buildReplayTrace = (
  candidate: CandidateQuestion,
  context: PropositionContext,
  decision?: ReviewDecision,
): ReplayTrace => {
  const point = context.knowledgeById.get(candidate.knowledgePointId);
  const contract = context.contractByItem.get(candidate.contractItemId);
  const anchor = point?.sourceAnchors[0];
  return {
    L1: {
      questionNo: candidate.questionNo,
      stem: decision?.revisedStem ?? candidate.stem,
      options: candidate.options?.map((option) => ({ ...option })),
      answer: candidate.answer,
      analysis: candidate.analysis,
      scoringPoints: candidate.scoringPoints.map((item) => ({ ...item })),
    },
    L2: {
      contractItemId: candidate.contractItemId,
      clause: contract?.clause ?? candidate.contractItemId,
      constraintType: contract?.constraintType ?? '—',
      targetValue: contract?.targetValue ?? '—',
      tolerance: contract?.tolerance ?? '—',
    },
    L3: {
      chapter: candidate.chapter,
      questionType: candidate.type,
      score: candidate.score,
      difficultyLevel: difficultyLevelOf(candidate.difficulty),
    },
    L4: {
      knowledgePointId: candidate.knowledgePointId,
      cognitiveLevel: point?.cognitiveLevel ?? candidate.cognitiveLevel,
      weight: point?.weight ?? 0,
      prerequisites: point?.prerequisites ?? [],
    },
    L5: {
      chapter: candidate.chapter,
      anchor: anchor?.anchor ?? '—',
      excerpt: anchor?.excerpt ?? '—',
    },
    L6: { ...candidate.generation },
    L7: decision
      ? {
          teacherAccount: decision.teacher,
          timestamp: decision.timestamp,
          action: decision.action,
          reason: decision.reason,
        }
      : undefined,
  };
};

function TraceRows({ trace }: { trace: ReplayTrace }) {
  return (
    <div className="replay-trace">
      <div className="replay-trace-item">
        <span className="replay-trace-label">L1</span>
        <div>
          <strong>题目</strong>
          <p>{trace.L1.questionNo} · {trace.L1.stem}</p>
          <p>
            答案：{trace.L1.answer}；评分点：
            {trace.L1.scoringPoints.map((point) => `${point.description} ${point.score} 分`).join('；')}
          </p>
        </div>
      </div>
      <div className="replay-trace-item">
        <span className="replay-trace-label">L2</span>
        <div>
          <strong>契约</strong>
          <p>
            {trace.L2.clause} · {trace.L2.constraintType} · 目标 {String(trace.L2.targetValue)} ·
            带宽 {String(trace.L2.tolerance)}
          </p>
        </div>
      </div>
      <div className="replay-trace-item">
        <span className="replay-trace-label">L3</span>
        <div>
          <strong>蓝图</strong>
          <p>
            {trace.L3.chapter} × {trace.L3.questionType} · {trace.L3.score} 分 ·{' '}
            {trace.L3.difficultyLevel}
          </p>
        </div>
      </div>
      <div className="replay-trace-item">
        <span className="replay-trace-label">L4</span>
        <div>
          <strong>知识</strong>
          <p>
            {trace.L4.knowledgePointId} · {trace.L4.cognitiveLevel} · 权重 {trace.L4.weight} ·
            先修 {trace.L4.prerequisites.join('、') || '无'}
          </p>
        </div>
      </div>
      <div className="replay-trace-item">
        <span className="replay-trace-label">L5</span>
        <div>
          <strong>大纲</strong>
          <p>{trace.L5.chapter} · {trace.L5.anchor}</p>
          <p className="replay-trace-excerpt">{trace.L5.excerpt}</p>
        </div>
      </div>
      <div className="replay-trace-item">
        <span className="replay-trace-label">L6</span>
        <div>
          <strong>调用</strong>
          <p>
            {trace.L6.modelName} {trace.L6.modelVersion} · {trace.L6.promptTemplate}{' '}
            {trace.L6.promptTemplateVersion} · 种子 {trace.L6.randomSeed}
          </p>
          <p>{trace.L6.inputSummary} → {trace.L6.outputSummary}</p>
        </div>
      </div>
      <div className="replay-trace-item">
        <span className="replay-trace-label">L7</span>
        <div>
          <strong>决策</strong>
          {trace.L7 ? (
            <p>
              {trace.L7.teacherAccount} · {formatTime(trace.L7.timestamp)} · {trace.L7.action} ·{' '}
              {trace.L7.reason}
            </p>
          ) : (
            <p>待教师终审。</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface FieldDiff {
  label: string;
  left: string;
  right: string;
  changed: boolean;
}

interface QuestionDiff {
  questionNo: string;
  fields: FieldDiff[];
}

interface VersionDiff {
  scope: string;
  leftLabel: string;
  rightLabel: string;
  summary: string[];
  questions: QuestionDiff[];
}

const fieldDiff = (label: string, left: unknown, right: unknown): FieldDiff => ({
  label,
  left: String(left ?? '—'),
  right: String(right ?? '—'),
  changed: String(left ?? '') !== String(right ?? ''),
});

const buildVersionDiff = (
  left?: VersionOption,
  right?: VersionOption,
): VersionDiff | null => {
  if (!left || !right) return null;
  if (left.scope !== right.scope) {
    return {
      scope: '跨范围',
      leftLabel: left.label,
      rightLabel: right.label,
      summary: ['请选择同一范围的版本进行对比。'],
      questions: [],
    };
  }
  if (left.scope === '整卷') {
    const leftQuestions = left.questions ?? [];
    const rightQuestions = right.questions ?? [];
    const leftByNo = new Map(leftQuestions.map((question) => [question.questionNo, question]));
    const rightByNo = new Map(rightQuestions.map((question) => [question.questionNo, question]));
    const orderChanges =
      right.order
        ?.map((number, index) =>
          left.order?.[index] !== number
            ? `第 ${index + 1} 题：${left.order?.[index] ?? '—'} → ${number}`
            : null,
        )
        .filter((item): item is string => Boolean(item)) ?? [];
    const added = rightQuestions.filter((question) => !leftByNo.has(question.questionNo));
    const removed = leftQuestions.filter((question) => !rightByNo.has(question.questionNo));
    const questions: QuestionDiff[] = [];
    rightQuestions.forEach((question) => {
      const previous = leftByNo.get(question.questionNo);
      if (!previous) {
        questions.push({
          questionNo: question.questionNo,
          fields: [fieldDiff('题目', '—', question.questionNo)],
        });
        return;
      }
      const fields = [
        fieldDiff('题干', previous.stem, question.stem),
        fieldDiff('答案', previous.answer, question.answer),
        fieldDiff('分值', previous.score, question.score),
        fieldDiff('知识点', previous.knowledgePointId, question.knowledgePointId),
      ];
      if (fields.some((field) => field.changed)) {
        questions.push({ questionNo: question.questionNo, fields });
      }
    });
    const summary = [
      `题量 ${leftQuestions.length} → ${rightQuestions.length}`,
      `题序差异 ${orderChanges.length} 处`,
      `题目内容差异 ${questions.length} 题`,
      `新增 ${added.length} 题 · 移除 ${removed.length} 题`,
      `合计 ${leftQuestions.reduce((total, question) => total + question.score, 0)} → ${rightQuestions.reduce((total, question) => total + question.score, 0)} 分`,
      ...orderChanges,
    ];
    return {
      scope: '整卷',
      leftLabel: left.label,
      rightLabel: right.label,
      summary,
      questions,
    };
  }

  if (left.scope === '单题' && left.question && right.question) {
    const fields = [
      fieldDiff('题干', left.question.stem, right.question.stem),
      fieldDiff('答案', left.question.answer, right.question.answer),
      fieldDiff('分值', left.question.score, right.question.score),
      fieldDiff('知识点', left.question.knowledgePointId, right.question.knowledgePointId),
      fieldDiff('题型', left.question.type, right.question.type),
      fieldDiff('版本', left.version, right.version),
    ];
    return {
      scope: '单题',
      leftLabel: left.label,
      rightLabel: right.label,
      summary: [
        `题干差异：${fields[0].changed ? '有' : '无'}`,
        `答案/分值/考点：${fields.slice(1, 4).some((field) => field.changed) ? '有差异' : '等价'}`,
      ],
      questions: [{ questionNo: left.question.questionNo, fields }],
    };
  }

  return {
    scope: left.scope,
    leftLabel: left.label,
    rightLabel: right.label,
    summary: ['当前选择没有可比较的题目内容。'],
    questions: [],
  };
};

function SnapshotTabs({
  snapshots,
  tab,
  onTab,
  report,
  onRecompile,
  canRecompile,
}: {
  snapshots: VersionSnapshots;
  tab: 'input' | 'parameter' | 'decision' | 'process';
  onTab: (tab: 'input' | 'parameter' | 'decision' | 'process') => void;
  report: RecompileReport | null;
  onRecompile: () => void;
  canRecompile: boolean;
}) {
  return (
    <section className="replay-card">
      <div className="replay-card-head">
        <h2>四类快照</h2>
        <span>输入 / 参数 / 决策 / 过程</span>
      </div>
      <div className="replay-tabs" role="tablist" aria-label="四类快照">
        {[
          ['input', '输入快照'],
          ['parameter', '参数快照'],
          ['decision', '决策快照'],
          ['process', '过程快照'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'is-active' : ''}
            onClick={() => onTab(key as typeof tab)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="replay-snapshot-body">
        {tab === 'input' && (
          <dl className="replay-kv">
            <div><dt>大纲哈希</dt><dd>{snapshots.input.syllabusHash}</dd></div>
            <div><dt>知识点库哈希</dt><dd>{snapshots.input.knowledgeBaseHash}</dd></div>
            <div><dt>历史题库哈希</dt><dd>{snapshots.input.historyBankHash}</dd></div>
            <div><dt>用途</dt><dd>锁定“用什么算的”</dd></div>
          </dl>
        )}
        {tab === 'parameter' && (
          <dl className="replay-kv">
            <div><dt>模型</dt><dd>{snapshots.parameter.modelName}</dd></div>
            <div><dt>模型版本</dt><dd>{snapshots.parameter.modelVersion}</dd></div>
            <div><dt>温度</dt><dd>{snapshots.parameter.temperature}</dd></div>
            <div><dt>随机种子</dt><dd>{String(snapshots.parameter.randomSeed)}</dd></div>
            <div><dt>提示词模板</dt><dd>{snapshots.parameter.promptTemplateVersion}</dd></div>
            <div><dt>用途</dt><dd>锁定“怎么算的”</dd></div>
          </dl>
        )}
        {tab === 'decision' && (
          <div className="replay-decision-list">
            <p className="replay-muted">
              教师决策记录 {snapshots.decision.modifications.length} 项，锁定“人改了什么”。
            </p>
            {snapshots.decision.modifications.map((modification, index) => (
              <div className="replay-decision-item" key={`${modification.location}-${index}`}>
                <div>
                  <strong>{modification.location}</strong>
                  <span>{modification.content}</span>
                </div>
                <p>{modification.reason}</p>
              </div>
            ))}
          </div>
        )}
        {tab === 'process' && (
          <dl className="replay-kv">
            <div><dt>调用日志</dt><dd>{snapshots.process.callLogs.length} 条</dd></div>
            <div><dt>工具结果</dt><dd>{snapshots.process.toolResults.length} 条</dd></div>
            <div><dt>过程事件</dt><dd>{snapshots.process.events.length} 条</dd></div>
            <div><dt>用途</dt><dd>锁定“中间发生了什么”</dd></div>
          </dl>
        )}
      </div>

      <div className="replay-recompile-row">
        <button type="button" className="replay-btn is-primary" onClick={onRecompile} disabled={!canRecompile}>
          同参数重编译
        </button>
        <span>输入快照与参数快照不变；按考点 / 答案 / 分值判定等价，不要求文字一致。</span>
      </div>

      {report && (
        <div className="replay-recompile-report">
          <div className="replay-recompile-head">
            <strong>同参数重编译结果</strong>
            <span className={report.equivalent === report.total ? 'is-pass' : 'is-hint'}>
              {report.equivalent === report.total ? '等价' : '部分等价'}
            </span>
          </div>
          <div className="replay-recompile-counts">
            <span>考点 {report.samePoint}/{report.total}</span>
            <span>答案 {report.sameAnswer}/{report.total}</span>
            <span>分值 {report.sameScore}/{report.total}</span>
            <span>文字差异 {report.textChanged}/{report.total}</span>
            <span>等价率 {report.equivalenceRate.toFixed(0)}%</span>
          </div>
          <p>{report.note}</p>
          <small>
            同参数：输入快照 {report.sameInput ? '一致' : '不一致'} · 参数快照{' '}
            {report.sameParameter ? '一致' : '不一致'} · 输入快照组合 {report.inputHash} ·
            参数快照组合 {report.parameterHash} · {report.modelName}
          </small>
          <div className="replay-recompile-samples">
            {report.samples.map((sample) => (
              <div key={sample.questionNo}>
                <strong>{sample.questionNo}</strong>
                <p>原：{sample.before}</p>
                <p>重编译：{sample.after}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function ReplayPage() {
  const candidates = usePropositionStore((state) => state.candidates);
  const tasks = usePropositionStore((state) => state.tasks);
  const logs = usePropositionStore((state) => state.logs);
  const draft = usePropositionStore((state) => state.draft);
  const audit = useReviewStore((state) => state.audit);
  const decisions = useReviewStore((state) => state.decisions);
  const snapshots = useComposeStore((state) => state.snapshots);
  const derivedFrom = useComposeStore((state) => state.derivedFrom);
  const workingVersion = useComposeStore((state) => state.workingVersion);
  const paperStatus = usePaperStore((state) => state.status);
  const statusAuditLog = useAuditLogStore((state) => state.entries);
  const contract = useContractStore((state) => state.contract);
  const points = useKnowledgeStore((state) => state.points);

  const events = useEventLogStore((state) => state.events);
  const filters = useEventLogStore((state) => state.filters);
  const selectedId = useEventLogStore((state) => state.selectedId);
  const versionSnapshots = useEventLogStore((state) => state.snapshots);
  const versions = useEventLogStore((state) => state.versions);
  const recompileReport = useEventLogStore((state) => state.recompileReport);
  const ingest = useEventLogStore((state) => state.ingest);
  const setKind = useEventLogStore((state) => state.setKind);
  const setActor = useEventLogStore((state) => state.setActor);
  const setQuery = useEventLogStore((state) => state.setQuery);
  const setOrder = useEventLogStore((state) => state.setOrder);
  const select = useEventLogStore((state) => state.select);
  const recompile = useEventLogStore((state) => state.recompile);

  const [snapshotTab, setSnapshotTab] = useState<'input' | 'parameter' | 'decision' | 'process'>('input');
  const [traceOpen, setTraceOpen] = useState(false);
  const [diffLeft, setDiffLeft] = useState('');
  const [diffRight, setDiffRight] = useState('');

  const context = useMemo(
    () => buildPropositionContext(contract, points),
    [contract, points],
  );
  const inputSnapshot = useMemo<InputSnapshot>(
    () => ({
      syllabusHash: fingerprintOf(context.syllabus),
      knowledgeBaseHash: fingerprintOf(context.knowledgeBase),
      historyBankHash: fingerprintOf(context.historyBank),
    }),
    [context],
  );
  const parameterSnapshot = useMemo<ParameterSnapshot>(() => {
    const generation = candidates[0]?.candidate.generation;
    return {
      modelName: generation?.modelName ?? 'mock-papercompile',
      modelVersion: generation?.modelVersion ?? 'mock-1.0',
      temperature: 0.2,
      randomSeed: generation?.randomSeed ?? 'seed-1',
      promptTemplateVersion: generation?.promptTemplateVersion ?? 'v1',
    };
  }, [candidates]);
  const componentVersions = useMemo(
    () => ({
      knowledge: 'v1',
      blueprint: context.blueprint.version,
      contract: contract?.version ?? 'v1',
    }),
    [context, contract],
  );

  useEffect(() => {
    ingest({
      taskCount: tasks.length,
      candidates,
      logs,
      draft,
      audit,
      auditLog: statusAuditLog,
      snapshots,
      derivedFrom,
      workingVersion,
      input: inputSnapshot,
      parameter: parameterSnapshot,
      componentVersions,
    });
  }, [
    ingest,
    tasks.length,
    candidates,
    logs,
    draft,
    audit,
    statusAuditLog,
    snapshots,
    derivedFrom,
    workingVersion,
    inputSnapshot,
    parameterSnapshot,
    componentVersions,
  ]);

  const actors = useMemo(
    () => ['全部来源', ...Array.from(new Set(events.map((event) => event.actor)))],
    [events],
  );
  const filteredEvents = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return events
      .filter(
        (event) =>
          (filters.kind === '全部' || event.kind === filters.kind) &&
          (filters.actor === '全部来源' || event.actor === filters.actor) &&
          (!query ||
            [event.title, event.summary, event.actor, event.questionNo ?? '', event.reason ?? '', event.input, event.output]
              .join(' ')
              .toLowerCase()
              .includes(query)),
      )
      .sort((left, right) =>
        filters.order === 'desc'
          ? new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
          : new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
      );
  }, [events, filters]);

  const selected =
    events.find((event) => event.id === selectedId) ??
    filteredEvents[0] ??
    events[events.length - 1] ??
    null;
  const selectedCandidate = selected?.questionNo
    ? candidates.find((record) => record.candidate.questionNo === selected.questionNo)?.candidate ?? null
    : null;
  const selectedDecision = selectedCandidate ? decisions[selectedCandidate.id] : undefined;
  const trace = selectedCandidate
    ? buildReplayTrace(selectedCandidate, context, selectedDecision)
    : null;

  useEffect(() => {
    setTraceOpen(false);
  }, [selected?.id]);

  useEffect(() => {
    if (!selected?.id) return;
    document.getElementById(`replay-event-${selected.id}`)?.scrollIntoView({
      inline: 'nearest',
      block: 'nearest',
    });
  }, [selected?.id]);

  useEffect(() => {
    const whole = versions.filter((version) => version.scope === '整卷');
    if (whole.length >= 2) {
      setDiffLeft(whole[whole.length - 2].id);
      setDiffRight(whole[whole.length - 1].id);
      return;
    }
    const single = versions.filter((version) => version.scope === '单题');
    const groups = new Map<string, VersionOption[]>();
    single.forEach((version) => {
      const number = version.question?.questionNo;
      if (!number) return;
      groups.set(number, [...(groups.get(number) ?? []), version]);
    });
    const pair = [...groups.values()].find((group) => group.length >= 2);
    if (pair) {
      setDiffLeft(pair[pair.length - 2].id);
      setDiffRight(pair[pair.length - 1].id);
    }
  }, [versions]);

  const diffLeftVersion = versions.find((version) => version.id === diffLeft);
  const diffRightVersion = versions.find((version) => version.id === diffRight);
  const diff = useMemo(
    () => buildVersionDiff(diffLeftVersion, diffRightVersion),
    [diffLeftVersion, diffRightVersion],
  );
  const components = versions.filter((version) =>
    ['知识点基线', '命题蓝图', '命题契约'].includes(version.scope),
  );
  const wholeVersions = versions.filter((version) => version.scope === '整卷');
  const singleVersions = versions.filter((version) => version.scope === '单题');

  const handleRecompile = () => {
    const report = recompile();
    if (!report) return;
    setSnapshotTab('process');
    setTraceOpen(false);
  };

  if (events.length === 0) {
    return (
      <section className="page replay-page">
        <header className="page-header">
          <h1>过程回放</h1>
          <p className="page-duty">复盘</p>
        </header>
        <div className="page-panel replay-panel">
          <div className="replay-empty">
            <span className="replay-kicker">复盘</span>
            <h2>暂无可回放的事件</h2>
            <p>
              请先在命题工作区发起出题，完成 Agent 调用与教师终审，再回到过程回放查看时间轴、版本差异与四类快照。
            </p>
            <div className="replay-empty-links">
              <Link to="/proposition">前往命题工作区</Link>
              <Link to="/review">前往题目审查台</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page replay-page">
      <header className="page-header">
        <h1>过程回放</h1>
        <p className="page-duty">复盘</p>
      </header>

      <div className="page-panel replay-panel">
        <div className="replay-toolbar">
          <div className="replay-toolbar-left">
            <span className="replay-mode">复盘</span>
            <span>事件 <strong>{filteredEvents.length}</strong> / {events.length}</span>
            <span>试卷状态 {paperStatus}</span>
            <span>整卷版本 {wholeVersions[wholeVersions.length - 1]?.version ?? '—'}</span>
          </div>
          <div className="replay-toolbar-right">
            <div className="replay-kinds" role="group" aria-label="事件类型">
              {(['全部', 'Agent 调用', '教师操作', '版本变更'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={filters.kind === kind ? 'is-active' : ''}
                  onClick={() => setKind(kind)}
                >
                  {kind}
                </button>
              ))}
            </div>
            <select
              className="replay-select"
              value={filters.actor}
              onChange={(event) => setActor(event.target.value)}
              aria-label="事件来源"
            >
              {actors.map((actor) => (
                <option key={actor} value={actor}>{actor}</option>
              ))}
            </select>
            <input
              className="replay-search"
              value={filters.query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索题目、理由、输入输出"
              aria-label="搜索事件"
            />
            <button
              type="button"
              className="replay-order"
              onClick={() => setOrder(filters.order === 'desc' ? 'asc' : 'desc')}
              title="切换时间顺序"
            >
              {filters.order === 'desc' ? '最新在前' : '最早在前'}
            </button>
          </div>
        </div>

        <div className="replay-workspace">
          <aside className="replay-timeline">
            <div className="replay-timeline-head">
              <h2>时间轴</h2>
              <span>{filteredEvents.length} 条</span>
            </div>
            <div className="replay-timeline-list">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    id={`replay-event-${event.id}`}
                    type="button"
                    className={`replay-event${selected?.id === event.id ? ' is-active' : ''}`}
                    onClick={() => select(event.id)}
                  >
                    <span className={`replay-event-dot ${event.tone}`} />
                    <div className="replay-event-main">
                      <div className="replay-event-top">
                        <span className={`replay-kind ${event.kind === 'Agent 调用' ? 'is-agent' : event.kind === '教师操作' ? 'is-teacher' : 'is-version'}`}>
                          {event.kind}
                        </span>
                        <time>{formatTime(event.timestamp)}</time>
                        <span className="replay-event-actor">{event.actor}</span>
                      </div>
                      <strong>{event.title}</strong>
                      <p>{event.summary}</p>
                      {event.questionNo && <small>{event.questionNo}</small>}
                    </div>
                  </button>
                ))
              ) : (
                <p className="replay-muted">没有匹配当前筛选条件的事件。</p>
              )}
            </div>
          </aside>

          <section className="replay-content">
            {selected && (
              <section className="replay-card replay-event-detail">
                <div className="replay-card-head">
                  <h2>事件详情</h2>
                  <span>{formatTime(selected.timestamp)}</span>
                </div>
                <div className="replay-event-heading">
                  <div>
                    <span className={`replay-kind ${selected.kind === 'Agent 调用' ? 'is-agent' : selected.kind === '教师操作' ? 'is-teacher' : 'is-version'}`}>
                      {selected.kind}
                    </span>
                    <span className="replay-event-actor">{selected.actor}</span>
                    {selected.questionNo && (
                      <button
                        type="button"
                        className="replay-link-btn"
                        onClick={() => setQuery(selected.questionNo ?? '')}
                      >
                        定位题目 {selected.questionNo}
                      </button>
                    )}
                  </div>
                  <h3>{selected.title}</h3>
                  <p>{selected.summary}</p>
                </div>
                <div className="replay-event-fields">
                  <div>
                    <span>输入</span>
                    <pre>{selected.input}</pre>
                  </div>
                  <div>
                    <span>输出</span>
                    <pre>{selected.output}</pre>
                  </div>
                  {selected.reason && (
                    <div>
                      <span>理由</span>
                      <pre>{selected.reason}</pre>
                    </div>
                  )}
                  {selected.evidence.length > 0 && (
                    <div>
                      <span>证据</span>
                      <ul>
                        {selected.evidence.map((item, index) => (
                          <li key={`${selected.id}-evidence-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {trace && (
                  <div className="replay-trace-toggle">
                    <button
                      type="button"
                      className="replay-btn"
                      onClick={() => setTraceOpen((value) => !value)}
                    >
                      {traceOpen ? '收起' : '展开'} L1–L7 七层溯源
                    </button>
                    <span>证据定位到具体题目，可逐层查看契约、蓝图、知识、大纲、调用与决策。</span>
                  </div>
                )}
                {trace && traceOpen && <TraceRows trace={trace} />}
              </section>
            )}

            {versionSnapshots && (
              <SnapshotTabs
                snapshots={versionSnapshots}
                tab={snapshotTab}
                onTab={setSnapshotTab}
                report={recompileReport}
                onRecompile={handleRecompile}
                canRecompile={wholeVersions.length > 0}
              />
            )}

            <section className="replay-card">
              <div className="replay-card-head">
                <h2>版本 diff</h2>
                <span>整卷与单题版本对比</span>
              </div>
              <div className="replay-levels">
                {components.map((version) => (
                  <span key={version.id}>{version.label}</span>
                ))}
                <span>单题 {singleVersions.length} 个版本</span>
                <span>整卷 {wholeVersions.map((version) => version.version).join(' / ') || '—'}</span>
              </div>
              <div className="replay-diff-selects">
                <select value={diffLeft} onChange={(event) => setDiffLeft(event.target.value)} aria-label="对比左侧版本">
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>{version.label}</option>
                  ))}
                </select>
                <span>→</span>
                <select value={diffRight} onChange={(event) => setDiffRight(event.target.value)} aria-label="对比右侧版本">
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>{version.label}</option>
                  ))}
                </select>
              </div>
              {diff ? (
                <div className="replay-diff">
                  <div className="replay-diff-head">
                    <strong>{diff.leftLabel} → {diff.rightLabel}</strong>
                    <span>{diff.scope}</span>
                  </div>
                  <ul className="replay-diff-summary">
                    {diff.summary.map((item, index) => (
                      <li key={`${diff.leftLabel}-summary-${index}`}>{item}</li>
                    ))}
                  </ul>
                  {diff.questions.length > 0 && (
                    <div className="replay-diff-questions">
                      {diff.questions.map((question) => (
                        <div className="replay-diff-question" key={`${question.questionNo}-${question.fields[0]?.label}`}>
                          <strong>{question.questionNo}</strong>
                          {question.fields
                            .filter((field) => field.changed)
                            .map((field) => (
                              <p key={`${question.questionNo}-${field.label}`}>
                                {field.label}：{field.left} → {field.right}
                              </p>
                            ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="replay-muted">暂无同范围版本可对比。</p>
              )}
            </section>
          </section>
        </div>
      </div>
    </section>
  );
}
