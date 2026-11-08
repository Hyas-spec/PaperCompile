import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  CandidateQuestion,
  DifficultyLevel,
  QuestionTrace,
  ReviewAction,
  ThreeStateConclusion,
  TraceL7,
} from '../types';
import type { CandidateRun } from '../agents/scheduler';
import { usePropositionStore } from '../store/proposition';
import {
  useReviewStore,
  type ReviewDecision,
} from '../store/review';
import { usePaperStore } from '../store';
import { useAuditLogStore } from '../store/audit';
import { assertPermission } from '../hooks/usePermission';
import {
  DEMO_COURSE_ID,
  DEMO_PAPER_ID,
  DEMO_USER,
} from '../store/session';
import { useContractStore } from '../store/contract';
import { useKnowledgeStore } from '../store/knowledge';
import {
  buildPropositionContext,
  type PropositionContext,
} from './propositionData';
import '../styles/review.css';

type ReviewTrace = Omit<QuestionTrace, 'L7'> & { L7?: TraceL7 };

const ACTION_ORDER: ReviewAction[] = ['通过', '改写', '换题', '退回'];

const ACTION_META: Record<
  ReviewAction,
  { label: string; confirm: string; note: string; tone: string }
> = {
  通过: {
    label: '通过',
    confirm: '确认通过',
    note: '逐题确认，不代表整卷签发；通过后仍需在成卷与导出页完成签发。',
    tone: 'is-pass',
  },
  改写: {
    label: '改写',
    confirm: '保存改写',
    note: '改写内容与理由写入审计日志；单题版本递增，其余题目保持不变。',
    tone: 'is-accent',
  },
  换题: {
    label: '换题',
    confirm: '确认换题并重出',
    note: '仅重出本题，其余题目与版本保持不变；新题进入待审，单题版本递增。',
    tone: 'is-hint',
  },
  退回: {
    label: '退回',
    confirm: '确认退回',
    note: '题目进入退回池，不静默删除；理由写入审计日志。',
    tone: 'is-block',
  },
};

const conclusionTone = (value: ThreeStateConclusion): string =>
  value === '通过' ? 'is-pass' : value === '需复核' ? 'is-hint' : 'is-block';

const actionTone = (action?: ReviewAction): string => {
  if (!action) return 'is-muted';
  if (action === '通过') return 'is-pass';
  if (action === '改写') return 'is-accent';
  if (action === '换题') return 'is-hint';
  return 'is-block';
};

const difficultyLevelOf = (coefficient: number): DifficultyLevel =>
  coefficient >= 0.8 ? '易' : coefficient >= 0.6 ? '中' : '难';

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const answerLineCount = (question: CandidateQuestion): number => {
  if (question.type === '填空题') return 2;
  if (question.type === '算法设计与分析题') return 9;
  return 4;
};

function ConclusionBadge({ value }: { value: ThreeStateConclusion }) {
  return (
    <span className={`review-badge ${conclusionTone(value)}`}>{value}</span>
  );
}

function buildTrace(
  record: CandidateRun,
  context: PropositionContext,
  decision: ReviewDecision | undefined,
  effectiveStem: string,
): ReviewTrace {
  const question = record.candidate;
  const point = context.knowledgeById.get(question.knowledgePointId);
  const contract = context.contractByItem.get(question.contractItemId);
  const anchor = point?.sourceAnchors[0];

  return {
    L1: {
      questionNo: question.questionNo,
      stem: effectiveStem,
      options: question.options?.map((option) => ({ ...option })),
      answer: question.answer,
      analysis: question.analysis,
      scoringPoints: question.scoringPoints.map((item) => ({ ...item })),
    },
    L2: {
      contractItemId: question.contractItemId,
      clause: contract?.clause ?? question.contractItemId,
      constraintType: contract?.constraintType ?? '—',
      targetValue: contract?.targetValue ?? '—',
      tolerance: contract?.tolerance ?? '—',
    },
    L3: {
      chapter: question.chapter,
      questionType: question.type,
      score: question.score,
      difficultyLevel: difficultyLevelOf(question.difficulty),
    },
    L4: {
      knowledgePointId: question.knowledgePointId,
      cognitiveLevel: point?.cognitiveLevel ?? question.cognitiveLevel,
      weight: point?.weight ?? 0,
      prerequisites: point?.prerequisites ?? [],
    },
    L5: {
      chapter: question.chapter,
      anchor: anchor?.anchor ?? '—',
      excerpt: anchor?.excerpt ?? '—',
    },
    L6: { ...question.generation },
    L7: decision
      ? {
          teacherAccount: decision.teacher,
          timestamp: decision.timestamp,
          action: decision.action,
          reason: decision.reason,
        }
      : undefined,
  };
}

function TraceRows({ trace }: { trace: ReviewTrace }) {
  const optionText =
    trace.L1.options?.map((option) => `${option.label} ${option.content}`).join('；') ??
    '无选项';
  return (
    <div className="review-trace">
      <div className="review-trace-item">
        <span className="review-trace-label">L1</span>
        <div>
          <strong>题目</strong>
          <p>{trace.L1.questionNo} · {trace.L1.stem}</p>
          <p>选项：{optionText}</p>
          <p>答案：{trace.L1.answer}</p>
          <p>解析：{trace.L1.analysis}</p>
          <p>评分点：{trace.L1.scoringPoints.map((item) => `${item.description} ${item.score} 分`).join('；')}</p>
        </div>
      </div>
      <div className="review-trace-item">
        <span className="review-trace-label">L2</span>
        <div>
          <strong>契约</strong>
          <p>{trace.L2.clause} · {trace.L2.constraintType} · 目标 {String(trace.L2.targetValue)} · 带宽 {String(trace.L2.tolerance)}</p>
        </div>
      </div>
      <div className="review-trace-item">
        <span className="review-trace-label">L3</span>
        <div>
          <strong>蓝图</strong>
          <p>{trace.L3.chapter} × {trace.L3.questionType} · {trace.L3.score} 分 · {trace.L3.difficultyLevel}</p>
        </div>
      </div>
      <div className="review-trace-item">
        <span className="review-trace-label">L4</span>
        <div>
          <strong>知识</strong>
          <p>{trace.L4.knowledgePointId} · {trace.L4.cognitiveLevel} · 权重 {trace.L4.weight} · 先修 {trace.L4.prerequisites.join('、') || '无'}</p>
        </div>
      </div>
      <div className="review-trace-item">
        <span className="review-trace-label">L5</span>
        <div>
          <strong>大纲</strong>
          <p>{trace.L5.chapter} · {trace.L5.anchor}</p>
          <p className="review-trace-excerpt">{trace.L5.excerpt}</p>
        </div>
      </div>
      <div className="review-trace-item">
        <span className="review-trace-label">L6</span>
        <div>
          <strong>调用</strong>
          <p>{trace.L6.modelName} {trace.L6.modelVersion} · {trace.L6.promptTemplate} {trace.L6.promptTemplateVersion} · 种子 {trace.L6.randomSeed}</p>
          <p>{trace.L6.inputSummary} → {trace.L6.outputSummary}</p>
        </div>
      </div>
      <div className="review-trace-item">
        <span className="review-trace-label">L7</span>
        <div>
          <strong>决策</strong>
          {trace.L7 ? (
            <p>{trace.L7.teacherAccount} · {formatTime(trace.L7.timestamp)} · {trace.L7.action} · {trace.L7.reason}</p>
          ) : (
            <p>待教师终审。</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const candidates = usePropositionStore((state) => state.candidates);
  const interceptions = usePropositionStore((state) => state.interceptions);
  const tasks = usePropositionStore((state) => state.tasks);
  const propositionStatus = usePropositionStore((state) => state.status);
  const regenerateTask = usePropositionStore((state) => state.regenerateTask);
  const decisions = useReviewStore((state) => state.decisions);
  const audit = useReviewStore((state) => state.audit);
  const decide = useReviewStore((state) => state.decide);
  const appendAudit = useAuditLogStore((state) => state.append);
  const contract = useContractStore((state) => state.contract);
  const points = useKnowledgeStore((state) => state.points);
  const advanceStatus = usePaperStore((state) => state.advanceStatus);
  const returnToReview = usePaperStore((state) => state.returnToReview);
  const advanceStageTo = usePaperStore((state) => state.advanceStageTo);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [reason, setReason] = useState('');
  const [revisedStem, setRevisedStem] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const context = useMemo(
    () => buildPropositionContext(contract, points),
    [contract, points],
  );
  const pool = useMemo(
    () =>
      candidates
        .filter((record) => !record.interception)
        .sort((left, right) =>
          left.candidate.questionNo.localeCompare(right.candidate.questionNo),
        ),
    [candidates],
  );
  const selected =
    pool.find((record) => record.id === selectedId) ??
    pool.find((record) => !decisions[record.id]) ??
    pool[0] ??
    null;
  const decision = selected ? decisions[selected.id] : undefined;
  const effectiveStem = decision?.revisedStem ?? selected?.candidate.stem ?? '';
  const effectiveVersion =
    decision?.revisedVersion ?? selected?.candidate.version ?? '';
  const trace = useMemo(
    () =>
      selected
        ? buildTrace(selected, context, decision, effectiveStem)
        : null,
    [selected, context, decision, effectiveStem],
  );

  const pending = pool.filter((record) => !decisions[record.id]).length;
  const reviewed = pool.length - pending;
  const reviewNeeds = pool.filter(
    (record) => record.review.conclusion !== '通过',
  ).length;
  const returned = pool.filter(
    (record) => decisions[record.id]?.action === '退回',
  ).length;
  const replaced = audit.filter((entry) => entry.action === '换题').length;
  const selectedIndex = selected
    ? pool.findIndex((record) => record.id === selected.id)
    : -1;
  const busy =
    propositionStatus === '规划中' ||
    propositionStatus === '运行中' ||
    propositionStatus === '组卷中';
  const actionMeta = action ? ACTION_META[action] : null;

  useEffect(() => {
    if (pool.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !pool.some((record) => record.id === selectedId)) {
      const next =
        pool.find((record) => !decisions[record.id]) ?? pool[0];
      setSelectedId(next.id);
    }
  }, [pool, decisions, selectedId]);

  useEffect(() => {
    if (!selected) return;
    document
      .getElementById(`review-chip-${selected.id}`)
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [selected?.id]);

  useEffect(() => {
    if (pool.length === 0) return;
    const currentStatus = usePaperStore.getState().status;
    if (currentStatus === '草稿') {
      appendAudit({
        operator: DEMO_USER,
        action: 'review',
        resourceType: '试卷',
        resourceId: DEMO_PAPER_ID,
        courseId: DEMO_COURSE_ID,
        beforeStatus: '草稿',
        afterStatus: '待审',
        reason: '进入逐题终审',
      });
      advanceStatus();
      advanceStageTo('教师终审');
      return;
    }
    if (pending === 0 && currentStatus === '待审') {
      appendAudit({
        operator: DEMO_USER,
        action: 'review',
        resourceType: '试卷',
        resourceId: DEMO_PAPER_ID,
        courseId: DEMO_COURSE_ID,
        beforeStatus: '待审',
        afterStatus: '已审',
        reason: `${reviewed} 题逐题终审完成`,
      });
      advanceStatus();
      advanceStageTo('成卷 / 打印 / 回放');
      return;
    }
    if (pending > 0 && currentStatus === '已审') {
      appendAudit({
        operator: DEMO_USER,
        action: 'review',
        resourceType: '试卷',
        resourceId: DEMO_PAPER_ID,
        courseId: DEMO_COURSE_ID,
        beforeStatus: '已审',
        afterStatus: '待审',
        reason: '换题后出现待审题目，回到待审',
      });
      returnToReview();
    }
  }, [
    pool.length,
    pending,
    reviewed,
    advanceStatus,
    advanceStageTo,
    returnToReview,
    appendAudit,
  ]);

  const toggleTrace = () => {
    const next = !traceOpen;
    setTraceOpen(next);
    if (next) {
      window.requestAnimationFrame(() => {
        document
          .getElementById('review-trace')
          ?.scrollIntoView({ block: 'nearest' });
      });
    }
  };

  const goPrev = () => {
    if (selectedIndex > 0) setSelectedId(pool[selectedIndex - 1].id);
  };
  const goNext = () => {
    if (selectedIndex >= 0 && selectedIndex < pool.length - 1) {
      setSelectedId(pool[selectedIndex + 1].id);
    }
  };

  const openAction = (next: ReviewAction) => {
    if (!selected || busy) return;
    setAction(next);
    setReason('');
    setRevisedStem(next === '改写' ? effectiveStem : '');
  };

  const closeAction = () => {
    if (submitting) return;
    setAction(null);
    setReason('');
    setRevisedStem('');
  };

  const selectNextPending = (currentId: string) => {
    const decisionsNow = useReviewStore.getState().decisions;
    const currentIndex = pool.findIndex((record) => record.id === currentId);
    const ordered =
      currentIndex >= 0
        ? [...pool.slice(currentIndex + 1), ...pool.slice(0, currentIndex)]
        : pool;
    const next = ordered.find((record) => !decisionsNow[record.id]);
    if (next) setSelectedId(next.id);
  };

  const confirmAction = async () => {
    if (!selected || !action || !reason.trim()) return;
    if (action === '改写' && !revisedStem.trim()) return;
    assertPermission(DEMO_USER, 'review', DEMO_COURSE_ID);

    setSubmitting(true);
    const entry = decide(
      selected,
      action,
      reason,
      action === '改写' ? revisedStem : undefined,
    );
    if (!entry) {
      setSubmitting(false);
      return;
    }

    const current = selected;
    setAction(null);
    setReason('');
    setRevisedStem('');
    setSubmitting(false);

    if (action === '换题') {
      setNotice(`正在重出 ${current.candidate.questionNo}；仅影响本题。`);
      await regenerateTask(current.taskId);
      const fresh = usePropositionStore
        .getState()
        .candidates.filter(
          (record) =>
            record.taskId === current.taskId && !record.interception,
        );
      const next = fresh[0];
      if (next) setSelectedId(next.id);
      setNotice(
        next
          ? `本题已重出：${current.candidate.questionNo} → ${next.candidate.questionNo}（${next.candidate.version}）；其余 ${Math.max(tasks.length - 1, 0)} 题保持不变。`
          : `本题重出完成：${current.candidate.questionNo} 已替换。`,
      );
      return;
    }

    if (action === '通过' || action === '退回') {
      setNotice(
        action === '通过'
          ? `已通过 ${current.candidate.questionNo}；可继续逐题审阅。`
          : `已退回 ${current.candidate.questionNo}；题目保留在退回状态，未静默删除。`,
      );
      selectNextPending(current.id);
      return;
    }

    setNotice(
      `已保存改写版本 ${entry.revisedVersion}；改写内容与理由已写入审计日志。`,
    );
  };

  const leftAnchor = selected ? (
    <aside className="review-column review-anchor">
      <div className="review-column-head">
        <h2>锚点</h2>
        <span>L2 · L4 · L5</span>
      </div>
      <div className="review-column-body">
        <section className="review-card">
          <div className="review-card-head">
            <span className="review-layer">L2 契约</span>
            <h3>{context.contractByItem.get(selected.candidate.contractItemId)?.clause ?? selected.candidate.contractItemId}</h3>
          </div>
          <dl className="review-kv">
            <div><dt>约束类型</dt><dd>{context.contractByItem.get(selected.candidate.contractItemId)?.constraintType ?? '—'}</dd></div>
            <div><dt>目标值</dt><dd>{String(context.contractByItem.get(selected.candidate.contractItemId)?.targetValue ?? '—')}</dd></div>
            <div><dt>允许带宽</dt><dd>{String(context.contractByItem.get(selected.candidate.contractItemId)?.tolerance ?? '—')}</dd></div>
            <div><dt>适用范围</dt><dd>{context.contractByItem.get(selected.candidate.contractItemId)?.scope ?? '—'}</dd></div>
          </dl>
          <p className="review-expression">{context.contractByItem.get(selected.candidate.contractItemId)?.expression ?? '未登记规则表达式'}</p>
          <p className="review-basis">依据：{context.contractByItem.get(selected.candidate.contractItemId)?.basis ?? '—'}</p>
        </section>

        <section className="review-card">
          <div className="review-card-head">
            <span className="review-layer">L4 知识</span>
            <h3>{context.knowledgeById.get(selected.candidate.knowledgePointId)?.name ?? selected.candidate.knowledgePointId}</h3>
          </div>
          <dl className="review-kv">
            <div><dt>ID</dt><dd>{selected.candidate.knowledgePointId}</dd></div>
            <div><dt>认知层次</dt><dd>{context.knowledgeById.get(selected.candidate.knowledgePointId)?.cognitiveLevel ?? '—'}</dd></div>
            <div><dt>权重</dt><dd>{context.knowledgeById.get(selected.candidate.knowledgePointId)?.weight ?? '—'}</dd></div>
            <div><dt>先修</dt><dd>{(context.knowledgeById.get(selected.candidate.knowledgePointId)?.prerequisites ?? []).map((id) => context.knowledgeById.get(id)?.name ?? id).join('、') || '无'}</dd></div>
          </dl>
          <p className="review-basis">所属章节：{context.knowledgeById.get(selected.candidate.knowledgePointId)?.chapter ?? selected.candidate.chapter}</p>
        </section>

        <section className="review-card">
          <div className="review-card-head">
            <span className="review-layer">L5 大纲</span>
            <h3>大纲原文锚点</h3>
          </div>
          <p className="review-anchor-label">{context.knowledgeById.get(selected.candidate.knowledgePointId)?.sourceAnchors[0]?.anchor ?? '—'}</p>
          <blockquote className="review-excerpt">
            {context.knowledgeById.get(selected.candidate.knowledgePointId)?.sourceAnchors[0]?.excerpt ?? '未找到大纲原文摘录。'}
          </blockquote>
          <p className="review-basis">
            {selected.candidate.chapter} · {context.syllabus.chapters.find((chapter) => chapter.title === selected.candidate.chapter)?.hours ?? '—'} 学时
          </p>
        </section>
      </div>
    </aside>
  ) : null;

  const middleQuestion = selected ? (
    <section className="review-column review-question">
      <div className="review-column-head">
        <h2>题目</h2>
        <span>题干 · 作答区 · 参考答案</span>
      </div>
      <div className="review-column-body">
        <article className="review-question-card">
          <div className="review-question-top">
            <div className="review-question-meta">
              <span className="review-question-no">{selected.candidate.questionNo}</span>
              <span>{selected.candidate.type}</span>
              <span>{selected.candidate.score} 分</span>
              <span>难度 {selected.candidate.difficulty.toFixed(2)}</span>
              <span>版本 {effectiveVersion}</span>
            </div>
            <button
              type="button"
              className={`review-conclusion ${conclusionTone(selected.review.conclusion)}`}
              onClick={toggleTrace}
              aria-expanded={traceOpen}
              title="点击展开七层溯源"
            >
              <span>{selected.review.conclusion}</span>
              <small>七层溯源{traceOpen ? '收起' : '展开'}</small>
            </button>
          </div>
          <p className="review-final-line">
            终态 <strong className={conclusionTone(selected.finalConclusion)}>{selected.finalConclusion}</strong>
            <span>
              {selected.arbitration
                ? selected.arbitration.escalatedToHuman
                  ? '仲裁无法裁决，升级人工'
                  : `仲裁：${selected.arbitration.conclusion}`
                : '校验闸门通过'}
            </span>
            {decision?.revisedStem && <em>已改写 · {decision.revisedVersion}</em>}
          </p>
          <h2 className="review-stem">{effectiveStem}</h2>
          {selected.candidate.options && selected.candidate.options.length > 0 && (
            <div className="review-options">
              {selected.candidate.options.map((option) => (
                <div className="review-option" key={option.label}>
                  <strong>{option.label}</strong>
                  <span>{option.content}</span>
                </div>
              ))}
            </div>
          )}

          <div className="review-answer-area">
            <div className="review-answer-label">
              <span>作答区</span>
              <small>学生卷预留，不在本页填写</small>
            </div>
            {selected.candidate.type === '单项选择题' ? (
              <div className="review-choice-area">
                {['A', 'B', 'C', 'D'].map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            ) : (
              <div className="review-answer-lines">
                {Array.from(
                  { length: answerLineCount(selected.candidate) },
                  (_, index) => (
                    <span key={index} />
                  ),
                )}
              </div>
            )}
          </div>

          <div className="review-reference">
            <div>
              <span>参考答案</span>
              <p>{selected.candidate.answer}</p>
            </div>
            <div>
              <span>解析</span>
              <p>{selected.candidate.analysis}</p>
            </div>
            <div>
              <span>评分点</span>
              <ul>
                {selected.candidate.scoringPoints.map((point, index) => (
                  <li key={`${point.description}-${index}`}>
                    {point.description} · {point.score} 分
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </div>
    </section>
  ) : null;

  const rightEvidence = selected ? (
    <aside className="review-column review-evidence">
      <div className="review-column-head">
        <h2>审题证据</h2>
        <span>审题结论 · 疑点 · 复算 · 七层溯源</span>
      </div>
      <div className="review-column-body">
        <section className="review-card">
          <div className="review-card-head">
            <h3>审题结论</h3>
            <ConclusionBadge value={selected.review.conclusion} />
          </div>
          <p className="review-isolation">
            输入：L1 题目（题干 / 选项 / 答案 / 解析 / 评分点），不含命题说明。
          </p>
          <p className="review-final-line">
            终态 <strong className={conclusionTone(selected.finalConclusion)}>{selected.finalConclusion}</strong>
            <span>{selected.finalReason}</span>
          </p>
        </section>

        <section className="review-card">
          <div className="review-card-head">
            <h3>疑点清单</h3>
            <span>{selected.review.issues.length} 项</span>
          </div>
          {selected.review.issues.length > 0 ? (
            <ul className="review-issues">
              {selected.review.issues.map((issue, index) => (
                <li key={`${issue.description}-${index}`}>
                  <strong>{issue.description}</strong>
                  <span>{issue.evidence}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="review-muted">未发现疑点。</p>
          )}
        </section>

        <section className="review-card">
          <div className="review-card-head">
            <h3>复算结果</h3>
            <span>L1 独立复算</span>
          </div>
          <p className="review-recomputed">
            {selected.review.recomputedAnswer ?? '—'}
          </p>
        </section>

        <section className="review-card">
          <div className="review-card-head">
            <h3>命题说明</h3>
            <span>不参与审题</span>
          </div>
          <dl className="review-note-list">
            <div><dt>考查意图</dt><dd>{selected.candidate.propositionNote.intent}</dd></div>
            <div><dt>难度依据</dt><dd>{selected.candidate.propositionNote.difficultyBasis}</dd></div>
            {selected.candidate.propositionNote.distractorDesign && (
              <div><dt>干扰项设计</dt><dd>{selected.candidate.propositionNote.distractorDesign}</dd></div>
            )}
            <div><dt>常见错误预判</dt><dd>{selected.candidate.propositionNote.commonErrors}</dd></div>
          </dl>
        </section>

        <section className="review-card">
          <div className="review-card-head">
            <h3>校验 Agent · 七道闸门</h3>
            <ConclusionBadge value={selected.validation.overall} />
          </div>
          <div className="review-gates">
            {selected.validation.results.map((result) => (
              <div className={`review-gate ${conclusionTone(result.conclusion)}`} key={result.gate}>
                <span>{result.gate}</span>
                <ConclusionBadge value={result.conclusion} />
                <p>{result.evidence.join(' ')}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="review-card" id="review-trace">
          <div className="review-card-head">
            <h3>七层溯源</h3>
            <button type="button" className="review-text-btn" onClick={toggleTrace}>
              {traceOpen ? '收起' : '展开'}
            </button>
          </div>
          {traceOpen && trace ? (
            <TraceRows trace={trace} />
          ) : (
            <p className="review-muted">
              点击题目卡右上角审题结论徽标，或此处“展开”，查看 L1–L7 完整证据链。
            </p>
          )}
        </section>
      </div>
    </aside>
  ) : null;

  return (
    <section className="page review-page">
      <header className="page-header">
        <h1>题目审查台</h1>
        <p className="page-duty">逐题终审</p>
      </header>

      <div className="page-panel review-panel">
        <div className="review-toolbar">
          <div className="review-toolbar-left">
            <span
              className="review-mode"
              title="审阅态不提供整卷生成与批量定稿；换题仅重出当前单题"
            >
              审阅态
            </span>
            <span>待审 <strong>{pending}</strong></span>
            <span>已审 <strong>{reviewed}</strong></span>
            <span>需复核 <strong>{reviewNeeds}</strong></span>
            <span>退回 <strong>{returned}</strong></span>
            <span>换题 <strong>{replaced}</strong></span>
            <span>
              拦截 <strong>{interceptions.length}</strong>
              <small>不进入审查列表</small>
            </span>
          </div>
          <div className="review-toolbar-right">
            {busy && <span className="review-busy">单题重出中…</span>}
            {pending === 0 && (
              <Link className="review-audit-btn" to="/compose">
                成卷与导出 →
              </Link>
            )}
            <button
              type="button"
              className="review-audit-btn"
              onClick={() => setAuditOpen(true)}
            >
              审计日志 <strong>{audit.length}</strong>
            </button>
          </div>
        </div>

        <div className="review-queue">
          <span className="review-queue-position">
            {selectedIndex >= 0 ? selectedIndex + 1 : 0}/{pool.length}
          </span>
          <button
            type="button"
            className="review-queue-nav"
            onClick={goPrev}
            disabled={selectedIndex <= 0}
            aria-label="上一题"
          >
            ←
          </button>
          <div className="review-queue-list">
            {pool.map((record) => {
              const itemDecision = decisions[record.id];
              return (
                <button
                  key={record.id}
                  id={`review-chip-${record.id}`}
                  type="button"
                  className={`review-chip${
                    selected?.id === record.id ? ' is-active' : ''
                  } ${actionTone(itemDecision?.action)}`}
                  onClick={() => setSelectedId(record.id)}
                  title={`${record.candidate.type} · ${record.candidate.chapter} · 审题${record.review.conclusion}`}
                >
                  <span>{record.candidate.questionNo}</span>
                  <small>{itemDecision?.action ?? '待审'}</small>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="review-queue-nav"
            onClick={goNext}
            disabled={selectedIndex < 0 || selectedIndex >= pool.length - 1}
            aria-label="下一题"
          >
            →
          </button>
        </div>

        {pool.length === 0 ? (
          <div className="review-empty">
            <span className="review-kicker">审阅态</span>
            <h2>暂无进入审查列表的题目</h2>
            <p>
              请先在命题工作区发起出题并完成七道闸门校验。审阅态不提供整卷生成入口；
              被闸门拦截的题目只保留在拦截记录中。
            </p>
            {interceptions.length > 0 && (
              <p className="review-empty-note">
                当前有 {interceptions.length} 题在拦截记录中，不进入审查列表。
              </p>
            )}
            <Link className="review-empty-link" to="/proposition">
              前往命题工作区
            </Link>
          </div>
        ) : (
          <div className="review-workspace">
            {leftAnchor}
            {middleQuestion}
            {rightEvidence}
          </div>
        )}

        <div className="review-actionbar">
          <div className="review-actionbar-info">
            {selected ? (
              <>
                <div>
                  <strong>{selected.candidate.questionNo}</strong>
                  <span>{selected.candidate.type}</span>
                  <span>版本 {effectiveVersion}</span>
                  <span className={`review-decision ${actionTone(decision?.action)}`}>
                    {decision?.action ?? '待审'}
                  </span>
                </div>
                <p>
                  {busy
                    ? '单题增量重出中，其余题目与版本保持不变。'
                    : notice ||
                      (pending === 0
                        ? `逐题终审完成：已审 ${reviewed} / 退回 ${returned}；等待签发（本页不提供签发）。`
                        : '理由必填；通过、改写、换题、退回均写入审计日志。')}
                </p>
              </>
            ) : (
              <p>选择题目后，在底部完成逐题终审。</p>
            )}
          </div>
          <div className="review-actionbar-actions">
            {ACTION_ORDER.map((item) => (
              <button
                key={item}
                type="button"
                className={`review-action-btn ${ACTION_META[item].tone}${
                  item === '退回' ? ' is-danger' : ''
                }`}
                onClick={() => openAction(item)}
                disabled={!selected || busy}
                title={`${ACTION_META[item].label}：理由必填`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {action && selected && actionMeta && (
        <div className="review-modal-backdrop" role="presentation">
          <div className="review-modal" role="dialog" aria-modal="true" aria-label={`${actionMeta.label}题目`}>
            <header className="review-modal-head">
              <div>
                <span className={`review-modal-tone ${actionMeta.tone}`}>{actionMeta.label}</span>
                <h2>{selected.candidate.questionNo} · {actionMeta.label}</h2>
              </div>
              <button type="button" className="review-icon-btn" onClick={closeAction} aria-label="关闭">
                ×
              </button>
            </header>
            <p className="review-modal-note">{actionMeta.note}</p>

            {action === '改写' && (
              <label className="review-field">
                <span>改写后题干</span>
                <textarea
                  value={revisedStem}
                  onChange={(event) => setRevisedStem(event.target.value)}
                  rows={4}
                />
              </label>
            )}

            <label className="review-field">
              <span>理由（必填）</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="说明本次判断的依据，写入审计日志。"
                rows={3}
                autoFocus
              />
            </label>

            <footer className="review-modal-actions">
              <button type="button" className="review-action-btn" onClick={closeAction} disabled={submitting}>
                取消
              </button>
              <button
                type="button"
                className={`review-action-btn ${actionMeta.tone}`}
                onClick={() => void confirmAction()}
                disabled={
                  submitting ||
                  busy ||
                  !reason.trim() ||
                  (action === '改写' && !revisedStem.trim())
                }
              >
                {submitting ? '提交中…' : actionMeta.confirm}
              </button>
            </footer>
          </div>
        </div>
      )}

      {auditOpen && (
        <div className="review-drawer-backdrop" role="presentation">
          <aside className="review-drawer" role="dialog" aria-modal="true" aria-label="审计日志">
            <header className="review-drawer-head">
              <div>
                <h2>审计日志</h2>
                <span>教师操作理由与单题版本留痕</span>
              </div>
              <button type="button" className="review-icon-btn" onClick={() => setAuditOpen(false)} aria-label="关闭">
                ×
              </button>
            </header>
            <div className="review-audit-list">
              {audit.length > 0 ? (
                audit.map((entry) => (
                  <div className="review-audit-item" key={entry.id}>
                    <div className="review-audit-top">
                      <span className={`review-decision ${actionTone(entry.action)}`}>{entry.action}</span>
                      <strong>{entry.questionNo}</strong>
                      <span>
                        {entry.questionVersion}
                        {entry.revisedVersion ? ` → ${entry.revisedVersion}` : ''}
                      </span>
                      <time>{formatTime(entry.timestamp)}</time>
                    </div>
                    <p>{entry.reason}</p>
                    {entry.revisedStem && (
                      <blockquote>{entry.revisedStem}</blockquote>
                    )}
                    <small>{entry.teacher}</small>
                  </div>
                ))
              ) : (
                <p className="review-muted">
                  尚无审计记录。每次通过、改写、换题、退回都会写入教师账号、时间、动作与理由。
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
