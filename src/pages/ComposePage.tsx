import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CandidateQuestion, QuestionType } from '../types';
import { usePropositionStore } from '../store/proposition';
import { useReviewStore } from '../store/review';
import { usePaperStore } from '../store';
import { useAuditLogStore } from '../store/audit';
import {
  makeSnapshot,
  nextPaperVersion,
  useComposeStore,
} from '../store/compose';
import { assertPermission } from '../hooks/usePermission';
import {
  DEMO_COURSE_ID,
  DEMO_USER,
} from '../store/session';
import { resolveFinalQuestions } from './finalPaper';
import '../styles/compose.css';

type PaperView = 'student' | 'teacher';

const QUESTION_TYPES: QuestionType[] = [
  '单项选择题',
  '填空题',
  '简答与分析题',
  '算法设计与分析题',
];

const TYPE_MARKS = ['一', '二', '三', '四'];

const PAPER = {
  title: '《数据结构》期中考试试卷',
  course: '数据结构',
  examName: '期中考试',
  paperNo: 'PC-DS-MID-001',
  teacher: '李老师',
};

const FALLBACK_MINUTES: Record<QuestionType, number> = {
  单项选择题: 30,
  填空题: 10,
  简答与分析题: 30,
  算法设计与分析题: 50,
};

const FIRST_PAGE_BUDGET = 640;
const PAGE_BUDGET = 930;
const SECTION_HEIGHT = 34;
const CONTINUED_HEIGHT = 26;
const CHOICE_ANSWER_HEIGHT = 112;

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const textHeight = (text: string, charsPerLine = 38): number =>
  Math.ceil(text.length / charsPerLine) * 9;

const questionHeight = (question: CandidateQuestion, view: PaperView): number => {
  const base: Record<QuestionType, number> = {
    单项选择题: 48,
    填空题: 45,
    简答与分析题: 66,
    算法设计与分析题: 76,
  };
  const studentExtra: Record<QuestionType, number> = {
    单项选择题: 0,
    填空题: 54,
    简答与分析题: 112,
    算法设计与分析题: 238,
  };
  const teacherExtra: Record<QuestionType, number> = {
    单项选择题: 176,
    填空题: 196,
    简答与分析题: 246,
    算法设计与分析题: 338,
  };
  const optionsHeight = question.options?.length ? 54 : 0;
  return (
    base[question.type] +
    textHeight(question.stem) +
    optionsHeight +
    (view === 'student' ? studentExtra[question.type] : teacherExtra[question.type]) +
    8
  );
};

interface SectionItem {
  kind: 'section';
  type: QuestionType;
  continued?: boolean;
  sectionNo: number;
  count: number;
  score: number;
  minutes: number;
}

interface QuestionItem {
  kind: 'question';
  question: CandidateQuestion;
  paperNumber: number;
}

interface ChoiceAnswerItem {
  kind: 'choice-answers';
  numbers: number[];
}

type SheetItem = SectionItem | QuestionItem | ChoiceAnswerItem;

interface PaperSheetData {
  first: boolean;
  items: SheetItem[];
}

const buildSheets = (
  ordered: CandidateQuestion[],
  view: PaperView,
  minutesOf: (type: QuestionType) => number,
): PaperSheetData[] => {
  const sheets: PaperSheetData[] = [];
  let current: SheetItem[] = [];
  let used = 0;
  let first = true;

  const budget = () => (first ? FIRST_PAGE_BUDGET : PAGE_BUDGET);
  const finishPage = (continued?: QuestionType) => {
    if (current.length > 0) {
      sheets.push({ first, items: current });
      first = false;
    }
    current = [];
    used = 0;
    if (continued) {
      const count = ordered.filter((question) => question.type === continued).length;
      const score = ordered
        .filter((question) => question.type === continued)
        .reduce((total, question) => total + question.score, 0);
      current.push({
        kind: 'section',
        type: continued,
        continued: true,
        sectionNo: QUESTION_TYPES.indexOf(continued) + 1,
        count,
        score,
        minutes: minutesOf(continued),
      });
      used += CONTINUED_HEIGHT;
    }
  };

  QUESTION_TYPES.forEach((type) => {
    const group = ordered.filter((question) => question.type === type);
    if (group.length === 0) return;
    const count = group.length;
    const score = group.reduce((total, question) => total + question.score, 0);
    const section: SectionItem = {
      kind: 'section',
      type,
      sectionNo: QUESTION_TYPES.indexOf(type) + 1,
      count,
      score,
      minutes: minutesOf(type),
    };
    if (
      used + SECTION_HEIGHT + questionHeight(group[0], view) >
        budget() &&
      current.length > 0
    ) {
      finishPage();
    }
    current.push(section);
    used += SECTION_HEIGHT;

    group.forEach((question) => {
      const height = questionHeight(question, view);
      if (used + height > budget() && current.length > 0) {
        finishPage(type);
      }
      current.push({
        kind: 'question',
        question,
        paperNumber: ordered.findIndex((item) => item.questionNo === question.questionNo) + 1,
      });
      used += height;
    });

    if (view === 'student' && type === '单项选择题') {
      if (used + CHOICE_ANSWER_HEIGHT > budget() && current.length > 0) {
        finishPage('单项选择题');
      }
      current.push({
        kind: 'choice-answers',
        numbers: ordered
          .filter((question) => question.type === '单项选择题')
          .map(
            (question) =>
              ordered.findIndex((item) => item.questionNo === question.questionNo) + 1,
          ),
      });
      used += CHOICE_ANSWER_HEIGHT;
    }
  });

  if (current.length > 0) {
    sheets.push({ first, items: current });
  }
  return sheets;
};

function SectionHeading({ item }: { item: SectionItem }) {
  return (
    <h2 className={`paper-section-head${item.continued ? ' is-continued' : ''}`}>
      <span>
        {TYPE_MARKS[item.sectionNo - 1]}、{item.type}
        {item.continued ? '（续）' : ''}
      </span>
      <span>
        共 {item.count} 题，{item.score} 分；建议 {item.minutes} 分钟
      </span>
    </h2>
  );
}

function AnswerLines({ count }: { count: number }) {
  return (
    <div className="paper-answer-lines">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

function ChoiceAnswerGrid({ numbers }: { numbers: number[] }) {
  return (
    <section className="paper-choice-answers">
      <div className="paper-choice-answers-head">
        <strong>单项选择题答题区</strong>
        <span>请将答案填写在对应题号后的方框内</span>
      </div>
      <div className="paper-choice-grid">
        {numbers.map((number) => (
          <span key={number}>
            <b>{number}</b>
            <i aria-hidden="true" />
          </span>
        ))}
      </div>
    </section>
  );
}

function StudentAnswer({ question }: { question: CandidateQuestion }) {
  if (question.type === '单项选择题') return null;
  if (question.type === '填空题') {
    return (
      <div className="paper-student-answer">
        <span className="paper-answer-label">答：</span>
        <AnswerLines count={2} />
      </div>
    );
  }
  if (question.type === '简答与分析题') {
    return (
      <div className="paper-student-answer">
        <span className="paper-answer-label">答：</span>
        <AnswerLines count={5} />
      </div>
    );
  }
  return (
    <div className="paper-code-area">
      <div className="paper-code-head">
        <span>代码 / 算法书写区</span>
        <small>按行预留，不压缩</small>
      </div>
      <AnswerLines count={12} />
    </div>
  );
}

function TeacherAnswer({ question }: { question: CandidateQuestion }) {
  return (
    <div className="paper-teacher-block">
      <div>
        <span>标准答案</span>
        <p>{question.answer}</p>
      </div>
      <div>
        <span>解析</span>
        <p>{question.analysis}</p>
      </div>
      <div>
        <span>分步评分点</span>
        <ul>
          {question.scoringPoints.map((point, index) => (
            <li key={`${point.description}-${index}`}>
              {point.description} · {point.score} 分
            </li>
          ))}
        </ul>
      </div>
      <div>
        <span>常见错误与扣分说明</span>
        <p>{question.propositionNote.commonErrors}</p>
      </div>
      <div>
        <span>命题说明</span>
        <p>
          {question.propositionNote.intent}；{question.propositionNote.difficultyBasis}
          {question.propositionNote.distractorDesign
            ? `；${question.propositionNote.distractorDesign}`
            : ''}
        </p>
      </div>
    </div>
  );
}

function PaperQuestion({
  question,
  paperNumber,
  view,
}: {
  question: CandidateQuestion;
  paperNumber: number;
  view: PaperView;
}) {
  return (
    <article className="paper-question">
      <div className="paper-question-head">
        <span className="paper-question-no">{paperNumber}.</span>
        <span className="paper-question-score">
          {question.type} · {question.score} 分
        </span>
      </div>
      <p className="paper-stem">{question.stem}</p>
      {question.options && question.options.length > 0 && (
        <div className="paper-options">
          {question.options.map((option) => (
            <span key={option.label}>
              <b>{option.label}</b>
              {option.content}
            </span>
          ))}
        </div>
      )}
      {view === 'student' ? (
        <StudentAnswer question={question} />
      ) : (
        <TeacherAnswer question={question} />
      )}
    </article>
  );
}

function PaperSheet({
  sheet,
  index,
  total,
  view,
  paperNo,
  version,
  questionCount,
  totalScore,
  duration,
}: {
  sheet: PaperSheetData;
  index: number;
  total: number;
  view: PaperView;
  paperNo: string;
  version: string;
  questionCount: number;
  totalScore: number;
  duration: number;
}) {
  return (
    <article className="paper-sheet">
      {sheet.first ? (
        <header className="paper-cover">
          <div className="paper-cover-top">
            <span>{view === 'teacher' ? '教师卷' : '学生卷'}</span>
            <span>闭卷</span>
          </div>
          <h1>{PAPER.title}</h1>
          <p className="paper-subtitle">
            {view === 'teacher'
              ? '教师卷（含标准答案、分步评分点、常见错误与命题说明）'
              : '请按题号在指定区域作答'}
          </p>
          <div className="paper-meta">
            <span>考试时间：{duration} 分钟</span>
            <span>满分：{totalScore} 分</span>
            <span>共 {questionCount} 题</span>
          </div>
          <div className="paper-candidate">
            学院：________　专业：________　班级：________　姓名：________　学号：________
          </div>
        </header>
      ) : (
        <div className="paper-running-head">
          {PAPER.title} · {view === 'teacher' ? '教师卷' : '学生卷'} · {version}
        </div>
      )}

      {sheet.first && (
        <section className="paper-instructions">
          <h2>考试说明</h2>
          <ol>
            <li>
              本试卷共四道大题，{questionCount} 道小题，满分 {totalScore} 分，考试时间 {duration} 分钟。
            </li>
            <li>答题前，请将学院、专业、班级、姓名、学号填写在试卷指定位置。</li>
            <li>
              单项选择题、填空题的答案填写在答题区；简答与分析题、算法设计与分析题按题号在指定区域作答，算法题请按行书写代码或算法过程。
            </li>
            <li>闭卷考试，不得使用手机、计算器等电子设备；请使用黑色签字笔作答，可携带直尺、橡皮。</li>
          </ol>
        </section>
      )}

      <div className="paper-body">
        {sheet.items.map((item, itemIndex) => {
          if (item.kind === 'section') {
            return <SectionHeading item={item} key={`section-${item.type}-${itemIndex}`} />;
          }
          if (item.kind === 'question') {
            return (
              <PaperQuestion
                key={`question-${item.question.questionNo}-${itemIndex}`}
                question={item.question}
                paperNumber={item.paperNumber}
                view={view}
              />
            );
          }
          return <ChoiceAnswerGrid key={`choice-${index}-${itemIndex}`} numbers={item.numbers} />;
        })}
      </div>

      <footer className="paper-footer">
        <span>
          第 {index + 1} 页 共 {total} 页
        </span>
        <span>试卷编号 {paperNo} · 版本 {version}</span>
        <span>{view === 'teacher' ? '教师卷' : '学生卷'}</span>
      </footer>
    </article>
  );
}

function PaperPreview({
  sheets,
  view,
  paperNo,
  version,
  questionCount,
  totalScore,
  duration,
}: {
  sheets: PaperSheetData[];
  view: PaperView;
  paperNo: string;
  version: string;
  questionCount: number;
  totalScore: number;
  duration: number;
}) {
  return (
    <div className="compose-print-area">
      {sheets.map((sheet, index) => (
        <PaperSheet
          key={`${version}-${index}`}
          sheet={sheet}
          index={index}
          total={sheets.length}
          view={view}
          paperNo={paperNo}
          version={version}
          questionCount={questionCount}
          totalScore={totalScore}
          duration={duration}
        />
      ))}
    </div>
  );
}

export default function ComposePage() {
  const draft = usePropositionStore((state) => state.draft);
  const propositionCandidates = usePropositionStore((state) => state.candidates);
  const reviewDecisions = useReviewStore((state) => state.decisions);
  const appendAudit = useAuditLogStore((state) => state.append);
  const paperStatus = usePaperStore((state) => state.status);
  const advanceStatus = usePaperStore((state) => state.advanceStatus);
  const advanceStageTo = usePaperStore((state) => state.advanceStageTo);
  const snapshots = useComposeStore((state) => state.snapshots);
  const workingVersion = useComposeStore((state) => state.workingVersion);
  const derivedFrom = useComposeStore((state) => state.derivedFrom);
  const signSnapshot = useComposeStore((state) => state.sign);
  const deriveVersion = useComposeStore((state) => state.derive);

  const [order, setOrder] = useState<string[]>([]);
  const [view, setView] = useState<PaperView>('student');
  const [signOpen, setSignOpen] = useState(false);
  const [signReason, setSignReason] = useState('');
  const [deriveOpen, setDeriveOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const lastSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const locked = Boolean(lastSnapshot) && derivedFrom === null;
  const baseQuestions = useMemo(() => {
    if (lastSnapshot) return lastSnapshot.questions;
    return resolveFinalQuestions(
      draft?.questions ?? [],
      propositionCandidates,
      reviewDecisions,
    );
  }, [lastSnapshot, draft, propositionCandidates, reviewDecisions]);

  useEffect(() => {
    const numbers = baseQuestions.map((question) => question.questionNo);
    if (numbers.length === 0) {
      setOrder([]);
      return;
    }
    setOrder((previous) => {
      const source =
        derivedFrom && lastSnapshot ? lastSnapshot.order : previous;
      const valid = source.filter((number) => numbers.includes(number));
      const missing = numbers.filter((number) => !valid.includes(number));
      return [...valid, ...missing];
    });
  }, [baseQuestions, derivedFrom, lastSnapshot]);

  const questionByNo = useMemo(
    () => new Map(baseQuestions.map((question) => [question.questionNo, question])),
    [baseQuestions],
  );
  const ordered = useMemo(() => {
    const list = order
      .map((number) => questionByNo.get(number))
      .filter((question): question is CandidateQuestion => Boolean(question));
    return list.length > 0 ? list : baseQuestions;
  }, [order, questionByNo, baseQuestions]);

  const totalScore = ordered.reduce((total, question) => total + question.score, 0);
  const duration = draft?.durationMinutes ?? 120;
  const minutesOf = (type: QuestionType): number =>
    draft?.timeAllocation.find((allocation) => allocation.questionType === type)?.minutes ??
    FALLBACK_MINUTES[type];
  const sheets = useMemo(
    () => buildSheets(ordered, view, minutesOf),
    [ordered, view, draft],
  );

  const currentVersion =
    derivedFrom !== null ? workingVersion : lastSnapshot?.version ?? workingVersion;
  const signable =
    !locked &&
    ordered.length > 0 &&
    (paperStatus === '已审' ||
      (paperStatus === '已签发' && derivedFrom !== null));

  const groups = QUESTION_TYPES.map((type) => {
    const questions = ordered.filter((question) => question.type === type);
    return {
      type,
      questions,
      score: questions.reduce((total, question) => total + question.score, 0),
      minutes: minutesOf(type),
    };
  });

  const paperNumber = (questionNo: string): number =>
    ordered.findIndex((question) => question.questionNo === questionNo) + 1;

  const moveQuestion = (questionNo: string, direction: -1 | 1) => {
    if (locked) return;
    const question = questionByNo.get(questionNo);
    if (!question) return;
    const typeNumbers = order.filter(
      (number) => questionByNo.get(number)?.type === question.type,
    );
    const withinType = typeNumbers.indexOf(questionNo);
    const target = typeNumbers[withinType + direction];
    if (!target) return;
    const next = [...order];
    const from = next.indexOf(questionNo);
    const to = next.indexOf(target);
    [next[from], next[to]] = [next[to], next[from]];
    setOrder(next);
  };

  const signPaper = () => {
    if (!signable || !signReason.trim() || ordered.length === 0) return;
    assertPermission(DEMO_USER, 'sign', DEMO_COURSE_ID);
    const snapshot = makeSnapshot({
      paperNo: PAPER.paperNo,
      version: currentVersion,
      teacher: PAPER.teacher,
      timestamp: new Date().toISOString(),
      reason: signReason.trim(),
      derivedFrom: derivedFrom ?? undefined,
      questions: ordered.map((question) => ({
        ...question,
        options: question.options?.map((option) => ({ ...option })),
        scoringPoints: question.scoringPoints.map((point) => ({ ...point })),
      })),
      order: ordered.map((question) => question.questionNo),
      totalScore,
      durationMinutes: duration,
    });
    appendAudit({
      operator: DEMO_USER,
      action: 'sign',
      resourceType: '试卷',
      resourceId: PAPER.paperNo,
      courseId: DEMO_COURSE_ID,
      beforeStatus: paperStatus,
      afterStatus: paperStatus === '已审' ? '已签发' : paperStatus,
      reason: signReason.trim(),
    });
    signSnapshot(snapshot);
    if (paperStatus === '已审') {
      advanceStatus();
      advanceStageTo('成卷 / 打印 / 回放');
    }
    setSignOpen(false);
    setSignReason('');
    setNotice(`已签发 ${snapshot.version}；快照 ${snapshot.fingerprint} 已固化。`);
  };

  const derivePaper = () => {
    assertPermission(DEMO_USER, 'sign', DEMO_COURSE_ID);
    const version = deriveVersion();
    if (!version) return;
    setDeriveOpen(false);
    setNotice(
      `已派生 ${version}；${lastSnapshot?.version ?? ''} 快照保持不可变，可调整题序后重新签发。`,
    );
  };

  const printPaper = () => {
    assertPermission(DEMO_USER, 'export', DEMO_COURSE_ID);
    window.print();
  };

  const statusText = locked
    ? '已签发 · 快照固化，不可原地修改'
    : derivedFrom
      ? `派生自 ${derivedFrom} · 待重新签发`
      : paperStatus === '已审'
        ? '已审 · 待签发'
        : paperStatus === '待审'
          ? '待审 · 需完成逐题终审'
          : paperStatus;

  const nextVersion = lastSnapshot ? nextPaperVersion(lastSnapshot.version) : 'v1.1';
  const orderDiff =
    derivedFrom && lastSnapshot
      ? order
          .map((number, index) =>
            lastSnapshot.order[index] !== number
              ? `第 ${index + 1} 题：${lastSnapshot.order[index] ?? '—'} → ${number}`
              : null,
          )
          .filter((item): item is string => Boolean(item))
      : [];

  if (!draft || baseQuestions.length === 0) {
    return (
      <section className="page compose-page">
        <header className="page-header">
          <h1>成卷与导出</h1>
          <p className="page-duty">装配与输出</p>
        </header>
        <div className="page-panel compose-panel">
          <div className="compose-empty">
            <span className="compose-kicker">成卷</span>
            <h2>暂无试卷草案</h2>
            <p>
              请先在命题工作区完成出题与七道闸门校验，再在题目审查台逐题终审。本页只做装配、A4
              预览、打印与签发。
            </p>
            <div className="compose-empty-links">
              <Link to="/proposition">前往命题工作区</Link>
              <Link to="/review">前往题目审查台</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page compose-page">
      <header className="page-header">
        <h1>成卷与导出</h1>
        <p className="page-duty">装配与输出</p>
      </header>

      <div className="page-panel compose-panel">
        <div className="compose-toolbar">
          <div className="compose-toolbar-left">
            <span className="compose-mode">成卷</span>
            <span className={`compose-status ${locked ? 'is-signed' : ''}`}>{statusText}</span>
            <span>
              试卷编号 <strong>{PAPER.paperNo}</strong>
            </span>
            <span>
              当前版本 <strong>{currentVersion}</strong>
            </span>
            <span>A4 · 双面 · 共 {sheets.length} 页</span>
          </div>
          <div className="compose-toolbar-right">
            <div className="compose-segment" role="group" aria-label="试卷类型">
              <button
                type="button"
                className={view === 'student' ? 'is-active' : ''}
                onClick={() => setView('student')}
              >
                学生卷
              </button>
              <button
                type="button"
                className={view === 'teacher' ? 'is-active' : ''}
                onClick={() => setView('teacher')}
              >
                教师卷
              </button>
            </div>
            <button
              type="button"
              className="compose-btn"
              onClick={printPaper}
              disabled={ordered.length === 0}
            >
              打印
            </button>
            <Link className="compose-btn" to="/replay">
              过程回放
            </Link>
            {locked ? (
              <button
                type="button"
                className="compose-btn"
                onClick={() => setDeriveOpen(true)}
              >
                派生新版本
              </button>
            ) : (
              <button
                type="button"
                className="compose-btn"
                onClick={() => setDeriveOpen(true)}
                disabled
                title="仅已签发版本可派生新版本"
              >
                派生新版本
              </button>
            )}
            <button
              type="button"
              className="compose-btn is-primary"
              onClick={() => setSignOpen(true)}
              disabled={!signable}
              title={
                locked
                  ? '已签发不可重复签发，请派生新版本'
                  : paperStatus === '待审'
                    ? '请先在题目审查台完成全部逐题终审'
                    : '签发二次确认'
              }
            >
              签发
            </button>
          </div>
        </div>

        <div className="compose-workspace">
          <aside className="compose-aside">
            <section className="compose-card">
              <div className="compose-card-head">
                <h2>版本与签发</h2>
                <span>{locked ? '已固化' : '待签发'}</span>
              </div>
              <dl className="compose-kv">
                <div><dt>试卷编号</dt><dd>{PAPER.paperNo}</dd></div>
                <div><dt>当前版本</dt><dd>{currentVersion}</dd></div>
                <div><dt>状态</dt><dd>{statusText}</dd></div>
                <div><dt>题量 / 总分</dt><dd>{ordered.length} 题 / {totalScore} 分</dd></div>
                <div><dt>考试时长</dt><dd>{duration} 分钟</dd></div>
                <div><dt>版式</dt><dd>A4 · 双面 · {sheets.length} 页</dd></div>
              </dl>
              {derivedFrom && lastSnapshot && (
                <div className="compose-diff">
                  <span>与 {lastSnapshot.version} 的题序差异</span>
                  <p>{orderDiff.length > 0 ? orderDiff.join('；') : '题序一致。'}</p>
                </div>
              )}
              {notice && <p className="compose-notice">{notice}</p>}
              {lastSnapshot && (
                <p className="compose-sign-note">
                  最近签发：{lastSnapshot.version} · {lastSnapshot.teacher} ·{' '}
                  {formatTime(lastSnapshot.timestamp)}
                </p>
              )}
            </section>

            <section className="compose-card">
              <div className="compose-card-head">
                <h2>题序</h2>
                <span>{locked ? '已签发锁定' : '四类题型内调整'}</span>
              </div>
              <div className="compose-order">
                {groups.map((group, groupIndex) => (
                  <div className="compose-order-group" key={group.type}>
                    <div className="compose-order-head">
                      <span>
                        {TYPE_MARKS[groupIndex]}、{group.type}
                      </span>
                      <small>
                        {group.questions.length} 题 · {group.score} 分
                      </small>
                    </div>
                    {group.questions.map((question, index) => (
                      <div className="compose-order-row" key={question.questionNo}>
                        <span className="compose-order-no">{paperNumber(question.questionNo)}</span>
                        <div className="compose-order-info">
                          <strong>{question.chapter}</strong>
                          <small>
                            {question.questionNo} · {question.score} 分
                          </small>
                        </div>
                        <div className="compose-order-actions">
                          <button
                            type="button"
                            onClick={() => moveQuestion(question.questionNo, -1)}
                            disabled={locked || index === 0}
                            aria-label="上移"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveQuestion(question.questionNo, 1)}
                            disabled={locked || index === group.questions.length - 1}
                            aria-label="下移"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section className="compose-card">
              <div className="compose-card-head">
                <h2>版本快照</h2>
                <span>{snapshots.length} 个已签发版本</span>
              </div>
              {snapshots.length > 0 ? (
                <div className="compose-snapshots">
                  {snapshots.map((snapshot) => (
                    <div className="compose-snapshot" key={snapshot.id}>
                      <div className="compose-snapshot-top">
                        <strong>{snapshot.version}</strong>
                        <span>已签发</span>
                        {snapshot.version === lastSnapshot?.version && (
                          <em>最近</em>
                        )}
                      </div>
                      <p>{snapshot.reason}</p>
                      <small>
                        {snapshot.teacher} · {formatTime(snapshot.timestamp)} ·{' '}
                        {snapshot.questions.length} 题 / {snapshot.totalScore} 分
                      </small>
                      <code>快照 {snapshot.fingerprint}</code>
                      {snapshot.derivedFrom && (
                        <small>派生自 {snapshot.derivedFrom}</small>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="compose-muted">尚未签发；签发后固化试卷与版本快照。</p>
              )}
            </section>
          </aside>

          <section className="compose-preview">
            <div className="compose-preview-head">
              <div>
                <h2>
                  {view === 'student' ? '学生卷' : '教师卷'} · A4 版式预览
                </h2>
                <span>
                  {view === 'teacher'
                    ? '含标准答案、分步评分点、常见错误与命题说明'
                    : '答题区按题型预留；算法题按行预留代码书写区'}
                </span>
              </div>
              <span className="compose-page-count">共 {sheets.length} 页</span>
            </div>
            <div className="compose-preview-scroll">
              <PaperPreview
                sheets={sheets}
                view={view}
                paperNo={PAPER.paperNo}
                version={currentVersion}
                questionCount={ordered.length}
                totalScore={totalScore}
                duration={duration}
              />
            </div>
          </section>
        </div>
      </div>

      {signOpen && (
        <div className="compose-modal-backdrop" role="presentation">
          <div className="compose-modal" role="dialog" aria-modal="true" aria-label="签发二次确认">
            <header className="compose-modal-head">
              <div>
                <span className="compose-modal-kicker">签发 · 二次确认</span>
                <h2>确认签发 {currentVersion}</h2>
              </div>
              <button
                type="button"
                className="compose-icon-btn"
                onClick={() => setSignOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </header>
            <p className="compose-modal-note">
              签发后不可原地修改，只能派生新版本；系统将固化试卷内容、题序、试卷编号与版本快照。
            </p>
            <dl className="compose-modal-kv">
              <div><dt>试卷编号</dt><dd>{PAPER.paperNo}</dd></div>
              <div><dt>版本</dt><dd>{currentVersion}</dd></div>
              <div><dt>题量 / 总分</dt><dd>{ordered.length} 题 / {totalScore} 分</dd></div>
              <div><dt>页数</dt><dd>{sheets.length} 页</dd></div>
              <div><dt>签发人</dt><dd>{PAPER.teacher}</dd></div>
            </dl>
            <label className="compose-field">
              <span>签发理由（必填）</span>
              <textarea
                value={signReason}
                onChange={(event) => setSignReason(event.target.value)}
                placeholder="说明本次签发的依据，写入版本快照。"
                rows={3}
                autoFocus
              />
            </label>
            <footer className="compose-modal-actions">
              <button type="button" className="compose-btn" onClick={() => setSignOpen(false)}>
                取消
              </button>
              <button
                type="button"
                className="compose-btn is-primary"
                onClick={signPaper}
                disabled={!signReason.trim()}
              >
                确认签发
              </button>
            </footer>
          </div>
        </div>
      )}

      {deriveOpen && (
        <div className="compose-modal-backdrop" role="presentation">
          <div className="compose-modal" role="dialog" aria-modal="true" aria-label="派生新版本">
            <header className="compose-modal-head">
              <div>
                <span className="compose-modal-kicker">派生版本</span>
                <h2>从 {lastSnapshot?.version} 派生 {nextVersion}</h2>
              </div>
              <button
                type="button"
                className="compose-icon-btn"
                onClick={() => setDeriveOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </header>
            <p className="compose-modal-note">
              已签发版本不可修改。派生后生成新版本 {nextVersion}，原版本快照保持不变；调整题序后重新签发。
            </p>
            <footer className="compose-modal-actions">
              <button type="button" className="compose-btn" onClick={() => setDeriveOpen(false)}>
                取消
              </button>
              <button type="button" className="compose-btn is-primary" onClick={derivePaper}>
                确认派生
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
