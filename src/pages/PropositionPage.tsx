import { useEffect, useMemo, useState } from 'react';
import type { QuestionType, ThreeStateConclusion } from '../types';
import type {
  CandidateRun,
  RunStatus,
  TaskPhase,
} from '../agents/scheduler';
import {
  usePropositionStore,
  type PropositionTaskRun,
} from '../store/proposition';
import {
  CHAPTER_DEFS,
  QUESTION_TYPE_DEFS,
} from './propositionData';
import '../styles/proposition.css';

const RUN_STATUS_TONE: Record<RunStatus, string> = {
  未开始: 'is-muted',
  规划中: 'is-accent',
  运行中: 'is-accent',
  组卷中: 'is-accent',
  已完成: 'is-pass',
  失败: 'is-block',
};

const PHASE_TONE: Record<TaskPhase, string> = {
  待调度: 'is-muted',
  命题: 'is-accent',
  审题: 'is-accent',
  校验: 'is-accent',
  仲裁: 'is-accent',
  完成: 'is-pass',
  失败: 'is-block',
};

const STAGE_ORDER: TaskPhase[] = ['命题', '审题', '校验', '仲裁', '完成'];

const conclusionTone = (value: ThreeStateConclusion): string =>
  value === '通过' ? 'is-pass' : value === '需复核' ? 'is-hint' : 'is-block';

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('zh-CN', { hour12: false });

function ConclusionBadge({ value }: { value: ThreeStateConclusion }) {
  return (
    <span className={`proposition-badge ${conclusionTone(value)}`}>
      {value}
    </span>
  );
}

function TaskContext({ task }: { task: PropositionTaskRun }) {
  return (
    <div className="proposition-context">
      <div>
        <span>知识点</span>
        <strong>{task.task.knowledgePointNames.join('、')}</strong>
      </div>
      <div>
        <span>契约项</span>
        <strong>{task.task.contractClauses.join('、')}</strong>
      </div>
      <div>
        <span>蓝图期望难度</span>
        <strong>{task.task.expectedDifficulty.toFixed(2)}</strong>
      </div>
    </div>
  );
}

function RunningDetail({ task }: { task: PropositionTaskRun }) {
  const activeIndex = STAGE_ORDER.indexOf(task.status);
  const note =
    task.status === '待调度'
      ? '任务已进入调度队列，等待并行 Worker。'
      : task.status === '命题'
        ? '命题 Agent 正在按任务单生成候选；命题说明随题保留。'
        : task.status === '审题'
          ? '审题 Agent 只看 L1 题目，不接收命题说明。'
          : task.status === '校验'
            ? '校验 Agent 正在执行七道闸门。'
            : task.status === '仲裁'
              ? '命题与审题存在冲突，仲裁 Agent 正在裁决。'
              : task.status === '失败'
                ? `任务失败：${task.error ?? '未知错误'}`
                : '任务完成，候选结果已写入候选池。';

  return (
    <div className="proposition-running">
      <div className="proposition-running-head">
        <span className={`proposition-phase ${PHASE_TONE[task.status]}`}>
          <i />
          {task.status}
        </span>
        <span>
          {task.candidateCount}/{task.task.variantCount} 候选
        </span>
      </div>

      <div className="proposition-stage-chain" aria-label="任务阶段">
        {STAGE_ORDER.map((stage, index) => (
          <span
            key={stage}
            className={`proposition-stage${
              activeIndex >= 0 && index < activeIndex
                ? ' is-done'
                : index === activeIndex
                  ? ' is-active'
                  : ''
            }`}
          >
            {stage}
          </span>
        ))}
      </div>

      <p
        className={`proposition-running-note${
          task.status === '失败' ? ' is-block' : ''
        }`}
      >
        {note}
      </p>
      <p className="proposition-running-hint">
        候选完成后，此处显示题目、审题疑点、七道闸门证据与仲裁记录。
      </p>
    </div>
  );
}

function CandidateDetail({ record }: { record: CandidateRun }) {
  const { candidate, review, validation, arbitration } = record;
  const options = candidate.options ?? [];

  return (
    <>
      <div
        className={`proposition-final ${conclusionTone(record.finalConclusion)}`}
      >
        <div className="proposition-final-head">
          <span>最终结论</span>
          <strong>{record.finalConclusion}</strong>
          <small>{candidate.questionNo} · {candidate.version}</small>
        </div>
        <p>{record.finalReason}</p>
      </div>

      <section className="proposition-card">
        <div className="proposition-card-head">
          <h3>题目</h3>
          <span>
            {candidate.type} · {candidate.score} 分 · 难度 {candidate.difficulty.toFixed(2)}
          </span>
        </div>
        <p className="proposition-stem">{candidate.stem}</p>

        {options.length > 0 && (
          <div className="proposition-options">
            {options.map((option) => (
              <div className="proposition-option" key={option.label}>
                <strong>{option.label}</strong>
                <span>{option.content}</span>
              </div>
            ))}
          </div>
        )}

        <div className="proposition-answer-block">
          <span>参考答案</span>
          <p>{candidate.answer}</p>
        </div>
        <div className="proposition-answer-block">
          <span>解析</span>
          <p>{candidate.analysis}</p>
        </div>
        <div className="proposition-scoring">
          <span>评分点</span>
          <ul>
            {candidate.scoringPoints.map((point, index) => (
              <li key={`${point.description}-${index}`}>
                {point.description} · {point.score} 分
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="proposition-card">
        <div className="proposition-card-head">
          <h3>命题说明</h3>
          <span>随题附出</span>
        </div>
        <div className="proposition-note-grid">
          <div>
            <span>考查意图</span>
            <p>{candidate.propositionNote.intent}</p>
          </div>
          <div>
            <span>难度依据</span>
            <p>{candidate.propositionNote.difficultyBasis}</p>
          </div>
          {candidate.propositionNote.distractorDesign && (
            <div>
              <span>干扰项设计</span>
              <p>{candidate.propositionNote.distractorDesign}</p>
            </div>
          )}
          <div>
            <span>常见错误预判</span>
            <p>{candidate.propositionNote.commonErrors}</p>
          </div>
        </div>
      </section>

      <section className="proposition-card">
        <div className="proposition-card-head">
          <h3>审题 Agent</h3>
          <ConclusionBadge value={review.conclusion} />
        </div>
        <p className="proposition-isolation">
          输入：L1 题目（题干 / 选项 / 答案 / 解析 / 评分点），不含命题说明。
        </p>
        {review.issues.length > 0 ? (
          <ul className="proposition-issues">
            {review.issues.map((issue, index) => (
              <li key={`${issue.description}-${index}`}>
                <strong>{issue.description}</strong>
                <span>{issue.evidence}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="proposition-muted">未发现疑点。</p>
        )}
        <p className="proposition-recomputed">
          独立复算：{review.recomputedAnswer ?? '—'}
        </p>
      </section>

      <section className="proposition-card">
        <div className="proposition-card-head">
          <h3>校验 Agent · 七道闸门</h3>
          <ConclusionBadge value={validation.overall} />
        </div>
        <div className="proposition-gates">
          {validation.results.map((result) => (
            <div
              className={`proposition-gate ${conclusionTone(result.conclusion)}`}
              key={result.gate}
            >
              <span className="proposition-gate-name">{result.gate}</span>
              <ConclusionBadge value={result.conclusion} />
              <div className="proposition-gate-body">
                <ul>
                  {result.evidence.map((line, index) => (
                    <li key={`${result.gate}-evidence-${index}`}>{line}</li>
                  ))}
                </ul>
                {result.suggestion && (
                  <p className="proposition-gate-suggestion">
                    调整建议：{result.suggestion}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {arbitration ? (
        <section className="proposition-card">
          <div className="proposition-card-head">
            <h3>仲裁 Agent</h3>
            <ConclusionBadge value={arbitration.conclusion} />
          </div>
          <p className="proposition-arb-reason">{arbitration.reason}</p>
          <ul className="proposition-evidence">
            {arbitration.evidence.map((line, index) => (
              <li key={`arbitration-${index}`}>{line}</li>
            ))}
          </ul>
          {arbitration.escalatedToHuman && (
            <p className="proposition-escalated">
              无法裁决，已升级人工复核。
            </p>
          )}
        </section>
      ) : validation.overall === '拦截' ? (
        <p className="proposition-no-arb">
          校验闸门拦截，未进入仲裁；该候选仅保留在拦截记录中。
        </p>
      ) : null}

      <p className="proposition-generation">
        生成来源：{candidate.generation.modelName} {candidate.generation.modelVersion} ·
        提示词 {candidate.generation.promptTemplate}{' '}
        {candidate.generation.promptTemplateVersion} · 随机种子{' '}
        {candidate.generation.randomSeed}
      </p>
    </>
  );
}

export default function PropositionPage() {
  const status = usePropositionStore((state) => state.status);
  const tasks = usePropositionStore((state) => state.tasks);
  const candidates = usePropositionStore((state) => state.candidates);
  const draft = usePropositionStore((state) => state.draft);
  const logs = usePropositionStore((state) => state.logs);
  const selectedTaskId = usePropositionStore((state) => state.selectedTaskId);
  const overview = usePropositionStore((state) => state.overview);
  const start = usePropositionStore((state) => state.start);
  const regenerate = usePropositionStore((state) => state.regenerate);
  const retryFailed = usePropositionStore((state) => state.retryFailed);
  const selectTask = usePropositionStore((state) => state.selectTask);

  const [chapterFilter, setChapterFilter] = useState('全部章节');
  const [typeFilter, setTypeFilter] = useState('全部题型');
  const [candidateId, setCandidateId] = useState<string | null>(null);

  const selectedTask =
    tasks.find((task) => task.task.id === selectedTaskId) ?? tasks[0] ?? null;
  const taskCandidates = useMemo(
    () =>
      selectedTask
        ? candidates.filter(
            (candidate) => candidate.taskId === selectedTask.task.id,
          )
        : [],
    [candidates, selectedTask],
  );
  const selectedCandidate =
    taskCandidates.find((candidate) => candidate.id === candidateId) ??
    taskCandidates[0] ??
    null;

  useEffect(() => {
    setCandidateId(null);
  }, [selectedTask?.task.id]);

  useEffect(() => {
    if (!selectedTask) return;
    document
      .getElementById(`proposition-task-${selectedTask.task.id}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedTask?.task.id]);

  const total = tasks.length || overview.questionCount;
  const completed = tasks.filter(
    (task) => task.status === '完成' || task.status === '失败',
  ).length;
  const running = tasks.filter((task) =>
    ['命题', '审题', '校验', '仲裁'].includes(task.status),
  ).length;
  const queued = tasks.filter((task) => task.status === '待调度').length;
  const failed = tasks.filter((task) => task.status === '失败').length;
  const targetCandidates =
    tasks.reduce((sum, task) => sum + task.task.variantCount, 0) || 41;
  const reviewNeeds = candidates.filter(
    (candidate) => candidate.review.conclusion !== '通过',
  ).length;
  const blocked = candidates.filter(
    (candidate) => candidate.validation.overall === '拦截',
  ).length;
  const poolCount = candidates.length - blocked;
  const escalated = candidates.filter(
    (candidate) => candidate.arbitration?.escalatedToHuman,
  ).length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const draftDifficulty =
    draft && draft.questions.length > 0 && draft.totalScore > 0
      ? draft.questions.reduce(
          (sum, question) => sum + question.difficulty * question.score,
          0,
        ) / draft.totalScore
      : null;
  const isRunning =
    status === '规划中' || status === '运行中' || status === '组卷中';
  const canStart = status === '未开始' || status === '失败';
  const canRegenerate =
    !isRunning &&
    tasks.length > 0 &&
    (chapterFilter !== '全部章节' || typeFilter !== '全部题型');
  const canRetry = !isRunning && failed > 0;

  const startLabel =
    status === '规划中'
      ? '规划中'
      : status === '运行中'
        ? '运行中'
        : status === '组卷中'
          ? '组卷中'
          : status === '已完成'
            ? '已完成'
            : status === '失败'
              ? '重新发起'
              : '发起出题';

  const idleTitle =
    status === '规划中'
      ? '规划 Agent 正在拆分任务单'
      : status === '失败'
        ? '本次运行失败'
        : '尚未发起出题';
  const idleText =
    status === '规划中'
      ? '读取命题蓝图与命题契约，按章节 × 题型 × 难度拆分任务单。'
      : status === '失败'
        ? '请查看运行记录后重新发起；已完成的候选不会自动定稿。'
        : '教师发起后，规划、命题、审题、校验、仲裁、组卷六个 Agent 按队列协同推进。';

  const overallOf = (task: PropositionTaskRun) => {
    if (task.stats.blocked > 0) return { label: '含拦截', tone: 'is-block' };
    if (task.stats.review > 0) return { label: '含复核', tone: 'is-hint' };
    if (task.stats.pass > 0) return { label: '通过', tone: 'is-pass' };
    return { label: '—', tone: 'is-muted' };
  };

  return (
    <section className="page proposition-page">
      <header className="page-header">
        <h1>命题工作区</h1>
        <p className="page-duty">发起与监控出题</p>
      </header>

      <div className="page-panel proposition-panel">
        <div className="proposition-toolbar">
          <div className="proposition-toolbar-left">
            <span className="proposition-version">命题任务单</span>
            <span className="proposition-meta">
              《数据结构》期中考试 · 命题蓝图 {overview.blueprintVersion} · 命题契约 v1
            </span>
            <span
              className={`proposition-run-status ${
                RUN_STATUS_TONE[status]
              }`}
            >
              <i />
              {status}
            </span>
          </div>

          <div className="proposition-toolbar-actions">
            <span className="proposition-progress-text">
              {completed}/{total} · {progress}%
            </span>
            <button
              type="button"
              className="proposition-btn"
              onClick={() => void retryFailed()}
              disabled={!canRetry}
              title={
                canRetry
                  ? '重试失败任务'
                  : isRunning
                    ? '当前任务运行中'
                    : '当前没有失败任务'
              }
            >
              失败重试{failed > 0 ? ` ${failed}` : ''}
            </button>
            <button
              type="button"
              className="proposition-btn is-primary"
              onClick={() => void start()}
              disabled={!canStart}
              title={canStart ? '按命题蓝图与契约发起出题' : '当前运行已完成或正在运行'}
            >
              {startLabel}
            </button>
          </div>
        </div>

        <div className="proposition-regen">
          <span className="proposition-regen-label">局部重出</span>
          <select
            className="proposition-select"
            value={chapterFilter}
            onChange={(event) => setChapterFilter(event.target.value)}
            disabled={isRunning || tasks.length === 0}
            aria-label="局部重出章节"
          >
            <option>全部章节</option>
            {CHAPTER_DEFS.map((chapter) => (
              <option key={chapter.title}>{chapter.title}</option>
            ))}
          </select>
          <select
            className="proposition-select"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            disabled={isRunning || tasks.length === 0}
            aria-label="局部重出题型"
          >
            <option>全部题型</option>
            {QUESTION_TYPE_DEFS.map((type) => (
              <option key={type.label}>{type.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="proposition-btn"
            onClick={() =>
              void regenerate({
                chapter:
                  chapterFilter === '全部章节' ? undefined : chapterFilter,
                questionType:
                  typeFilter === '全部题型'
                    ? undefined
                    : (typeFilter as QuestionType),
              })
            }
            disabled={!canRegenerate}
            title={
              canRegenerate
                ? '仅重出所选章节 / 题型对应的任务'
                : '请选择章节或题型，并等待当前运行结束'
            }
          >
            重出所选任务
          </button>
          <span className="proposition-regen-hint">
            {canRegenerate
              ? '仅替换所选任务的候选，其余任务与版本保持不变'
              : '选择章节或题型后，按增量方式局部重出'}
          </span>
        </div>

        <div className="proposition-kpis">
          <div className="proposition-kpi is-accent">
            <div className="proposition-kpi-head">
              <span>任务进度</span>
              <span>并行 3</span>
            </div>
            <strong>
              {completed}
              <small>/{total}</small>
            </strong>
            <div className="proposition-progress">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p>
              {running} 运行 · {queued} 排队 · {failed} 失败
            </p>
          </div>
          <div className="proposition-kpi">
            <div className="proposition-kpi-head">
              <span>候选池</span>
              <span>目标 {targetCandidates}</span>
            </div>
            <strong>{poolCount}</strong>
            <p>
              生成 {candidates.length} · 拦截 {blocked}
            </p>
          </div>
          <div className="proposition-kpi is-hint">
            <div className="proposition-kpi-head">
              <span>审题需复核</span>
              <span>三态</span>
            </div>
            <strong>{reviewNeeds}</strong>
            <p>仲裁升级 {escalated}</p>
          </div>
          <div className="proposition-kpi is-block">
            <div className="proposition-kpi-head">
              <span>闸门拦截</span>
              <span>七道闸门</span>
            </div>
            <strong>{blocked}</strong>
            <p>超纲校验 · 拦截记录</p>
          </div>
          <div className="proposition-kpi is-pass">
            <div className="proposition-kpi-head">
              <span>试卷草案</span>
              <span>待终审</span>
            </div>
            <strong>{draft ? `${draft.questions.length} 题` : '—'}</strong>
            <p>
              {draft
                ? `${draft.totalScore} 分 · ${draft.durationMinutes} 分钟${
                    draftDifficulty !== null
                      ? ` · 难度 ${draftDifficulty.toFixed(2)}`
                      : ''
                  }`
                : '组卷 Agent 待运行'}
            </p>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="proposition-idle">
            <div className="proposition-idle-head">
              <span className="proposition-kicker">协同层 · 六 Agent</span>
              <h2>{idleTitle}</h2>
              <p>{idleText}</p>
              {status === '失败' && logs[0] && (
                <p className="proposition-idle-error">{logs[0].message}</p>
              )}
            </div>

            <div className="proposition-idle-grid">
              <div>
                <span>命题蓝图 {overview.blueprintVersion}</span>
                <strong>
                  {overview.questionCount} 题 / {overview.totalScore} 分
                </strong>
                <p>{overview.durationMinutes} 分钟 · 8 章</p>
              </div>
              <div>
                <span>命题契约 v1</span>
                <strong>{overview.contractItems} 条</strong>
                <p>可校验条款</p>
              </div>
              <div>
                <span>知识点基线 v1</span>
                <strong>{overview.knowledgePoints} 个</strong>
                <p>含超纲禁区</p>
              </div>
              <div>
                <span>历史题库</span>
                <strong>{overview.historyCount} 题</strong>
                <p>查重与难度基线</p>
              </div>
            </div>

            <div className="proposition-chain" aria-label="六 Agent 协同顺序">
              {[
                ['规划', '蓝图 + 契约'],
                ['命题', '按任务生成'],
                ['审题', '只看题目'],
                ['校验', '七道闸门'],
                ['仲裁', '冲突裁决'],
                ['组卷', '题序 + 时间'],
              ].map(([name, detail], index) => (
                <span className="proposition-chain-item" key={name}>
                  {index > 0 && <i className="proposition-chain-arrow">→</i>}
                  <span>
                    <strong>{name}</strong>
                    <small>{detail}</small>
                  </span>
                </span>
              ))}
            </div>

            <p className="proposition-idle-note">
              结构化 schema 传参 · 结论必须携带证据 · 审题不读命题理由 · 支持增量局部重出
            </p>

            <div className="proposition-idle-actions">
              <button
                type="button"
                className="proposition-btn is-primary"
                onClick={() => void start()}
                disabled={!canStart}
              >
                {startLabel}
              </button>
              <span>不会自动定稿；组卷仅生成草案，签发权归教师。</span>
            </div>
          </div>
        ) : (
          <div className="proposition-workspace">
            <section className="proposition-queue">
              <div className="proposition-section-head">
                <div>
                  <h2>任务队列</h2>
                  <p>
                    {tasks.length} 个任务 · 并行 3 · 失败 {failed}
                  </p>
                </div>
                <span>章节 × 题型 × 难度</span>
              </div>

              <div className="proposition-task-head">
                <span>任务</span>
                <span>状态</span>
                <span>候选</span>
                <span>结论</span>
                <span>重试</span>
              </div>

              <div className="proposition-task-list">
                {tasks.map((task) => {
                  const overall = overallOf(task);
                  return (
                    <button
                      key={task.task.id}
                      id={`proposition-task-${task.task.id}`}
                      type="button"
                      className={`proposition-task${
                        selectedTask?.task.id === task.task.id ? ' is-active' : ''
                      }`}
                      onClick={() => selectTask(task.task.id)}
                      aria-current={
                        selectedTask?.task.id === task.task.id
                          ? 'true'
                          : undefined
                      }
                    >
                      <span className="proposition-task-main">
                        <span className="proposition-task-title">
                          {task.task.id} · {task.task.chapter}
                        </span>
                        <span className="proposition-task-meta">
                          {task.task.questionType} · {task.task.difficulty} ·{' '}
                          {task.task.score} 分
                        </span>
                      </span>
                      <span
                        className={`proposition-phase ${
                          PHASE_TONE[task.status]
                        }`}
                      >
                        <i />
                        {task.status}
                      </span>
                      <span className="proposition-task-count">
                        {task.candidateCount > 0
                          ? `${task.candidateCount}/${task.task.variantCount}`
                          : '—'}
                      </span>
                      <span className={`proposition-task-conclusion ${overall.tone}`}>
                        {overall.label}
                      </span>
                      <span className="proposition-task-retry">
                        {task.attempt > 0 ? `×${task.attempt}` : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="proposition-log">
                <div className="proposition-log-head">
                  <h2>运行记录</h2>
                  <span>{logs.length} 条</span>
                </div>
                <div className="proposition-log-list">
                  {logs.length > 0 ? (
                    logs.slice(0, 30).map((log) => (
                      <div
                        className={`proposition-log-item is-${log.tone}`}
                        key={log.id}
                      >
                        <span className="proposition-log-time">
                          {formatTime(log.time)}
                        </span>
                        <span className="proposition-log-source">
                          {log.source}
                        </span>
                        <span className="proposition-log-message">
                          {log.message}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="proposition-log-empty">
                      发起出题后，此处显示 Agent 调用与调度事件。
                    </p>
                  )}
                </div>
              </div>
            </section>

            <aside className="proposition-detail">
              {selectedTask ? (
                <>
                  <div className="proposition-detail-head">
                    <div>
                      <span className="proposition-detail-kicker">
                        {selectedTask.task.id} · {selectedTask.task.questionType} ·{' '}
                        {selectedTask.task.difficulty}
                      </span>
                      <h2>{selectedTask.task.chapter}</h2>
                      <p>
                        {selectedTask.task.score} 分 · 蓝图期望{' '}
                        {selectedTask.task.expectedDifficulty.toFixed(2)} · 重试{' '}
                        {selectedTask.attempt > 0 ? selectedTask.attempt : '—'}
                      </p>
                    </div>
                    <span
                      className={`proposition-phase ${
                        PHASE_TONE[selectedTask.status]
                      }`}
                    >
                      <i />
                      {selectedTask.status}
                    </span>
                  </div>

                  {taskCandidates.length > 0 && (
                    <div className="proposition-candidate-tabs">
                      {taskCandidates.map((record) => (
                        <button
                          key={record.id}
                          type="button"
                          className={`proposition-candidate-tab${
                            selectedCandidate?.id === record.id
                              ? ' is-active'
                              : ''
                          }`}
                          onClick={() => setCandidateId(record.id)}
                        >
                          <span>{record.candidate.questionNo}</span>
                          <ConclusionBadge value={record.finalConclusion} />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="proposition-detail-body">
                    <TaskContext task={selectedTask} />
                    {selectedCandidate ? (
                      <CandidateDetail record={selectedCandidate} />
                    ) : (
                      <RunningDetail task={selectedTask} />
                    )}
                  </div>
                </>
              ) : (
                <div className="proposition-detail-empty">
                  <p>选择左侧任务，查看任务单上下文与候选结果。</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
