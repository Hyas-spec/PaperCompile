import type {
  Blueprint,
  CognitiveLevel,
  DifficultyBand,
  KnowledgePoint,
  QuestionType,
  Syllabus,
  TraceL1,
} from '../types';
import {
  CHAPTER_DEFS,
  MOCK_BLUEPRINT,
  MOCK_HISTORY,
  MOCK_KNOWLEDGE,
  MOCK_SYLLABUS,
  QUESTION_TYPE_DEFS,
} from '../pages/propositionData';
import { MOCK_OUTLINE } from '../pages/outlineData';

/* ===== 附录 B：演示课程口径 ===== */

export const DEMO_EXAM = {
  course: '数据结构',
  examName: '期中考试',
  assessmentMethod: '期中考试，闭卷，120 分钟，满分 100 分',
  closedBook: true,
  durationMinutes: 120,
  totalScore: 100,
  questionCount: 26,
} as const;

export interface BlueprintTableRow {
  chapter: string;
  hours: number;
  knowledgePoints: number;
  choice: number;
  fill: number;
  short: number;
  algorithm: number;
  score: number;
  expectedDifficulty: number;
}

const rows: BlueprintTableRow[] = CHAPTER_DEFS.map((chapter) => ({
  chapter: chapter.title,
  hours: chapter.hours,
  knowledgePoints: chapter.knowledgePoints,
  choice: chapter.counts.choice,
  fill: chapter.counts.fill,
  short: chapter.counts.short,
  algorithm: chapter.counts.algorithm,
  score: chapter.targetScore,
  expectedDifficulty: chapter.expectedDifficulty,
}));

const totalHours = rows.reduce((sum, row) => sum + row.hours, 0);
const totalKnowledgePoints = rows.reduce((sum, row) => sum + row.knowledgePoints, 0);
const totalChoice = rows.reduce((sum, row) => sum + row.choice, 0);
const totalFill = rows.reduce((sum, row) => sum + row.fill, 0);
const totalShort = rows.reduce((sum, row) => sum + row.short, 0);
const totalAlgorithm = rows.reduce((sum, row) => sum + row.algorithm, 0);
const totalScore = rows.reduce((sum, row) => sum + row.score, 0);
const rawWeightedExpectedDifficulty =
  rows.reduce((sum, row) => sum + row.score * row.expectedDifficulty, 0) / totalScore;
const weightedExpectedDifficulty = Number(
  rawWeightedExpectedDifficulty.toFixed(2),
);

/** 表 B-1：按章节的题型与分值分配。 */
export const DEMO_BLUEPRINT_TABLE: BlueprintTableRow[] = [
  ...rows,
  {
    chapter: '合计',
    hours: totalHours,
    knowledgePoints: totalKnowledgePoints,
    choice: totalChoice,
    fill: totalFill,
    short: totalShort,
    algorithm: totalAlgorithm,
    score: totalScore,
    expectedDifficulty: weightedExpectedDifficulty,
  },
];

export interface QuestionTypeStructure {
  type: QuestionType;
  count: number;
  scorePer: number;
  totalScore: number;
  minutes: number;
  cognitiveLevel: CognitiveLevel;
}

const MINUTES: Record<QuestionType, number> = {
  单项选择题: 30,
  填空题: 10,
  简答与分析题: 30,
  算法设计与分析题: 50,
};

export const DEMO_QUESTION_TYPE_STRUCTURE: QuestionTypeStructure[] =
  QUESTION_TYPE_DEFS.map((definition) => {
    const count = rows.reduce(
      (sum, row) => sum + row[definition.key],
      0,
    );
    return {
      type: definition.label,
      count,
      scorePer: definition.score,
      totalScore: count * definition.score,
      minutes: MINUTES[definition.label],
      cognitiveLevel: definition.cognitiveLevel,
    };
  });

export const DEMO_DIFFICULTY_BANDS: DifficultyBand[] = [
  { level: '易', min: 0.8, max: 1, scoreRatio: 30 },
  { level: '中', min: 0.6, max: 0.8, scoreRatio: 50 },
  { level: '难', min: 0, max: 0.6, scoreRatio: 20 },
];

export const DEMO_DIFFICULTY_TARGET = {
  bands: DEMO_DIFFICULTY_BANDS,
  weightedExpectedDifficulty,
  blueprintExpected: MOCK_BLUEPRINT.difficultyPlan.expected,
  blueprintTolerance: MOCK_BLUEPRINT.difficultyPlan.tolerance,
} as const;

/** 42 个确立知识点。 */
export const DEMO_ESTABLISHED_KNOWLEDGE_POINTS: KnowledgePoint[] = MOCK_KNOWLEDGE;

/** 47 个候选知识点：42 个确立 + 5 个仅有章节名的候选项。 */
export const DEMO_CANDIDATE_KNOWLEDGE_POINTS = MOCK_OUTLINE.candidates.map(
  (candidate) => ({
    id: candidate.id,
    name: candidate.name,
    chapter: candidate.chapter,
    chapterNo: candidate.chapterNo,
    anchor: candidate.paragraph.label,
    excerpt: candidate.paragraph.text,
    requirement: candidate.requirement,
    established: !candidate.empty,
    candidateState: candidate.empty ? '待确立' : '确立',
    outOfScope: MOCK_KNOWLEDGE.some(
      (point) => point.name === candidate.name && point.outOfScope,
    ),
  }),
);

export interface OutOfScopeConcept {
  id: string;
  name: string;
  chapter: string;
  anchor: string;
  excerpt: string;
  inEstablishedSet: boolean;
}

const establishedOutOfScope: OutOfScopeConcept[] = MOCK_KNOWLEDGE
  .filter((point) => point.outOfScope)
  .map((point) => ({
    id: point.id,
    name: point.name,
    chapter: point.chapter,
    anchor: point.sourceAnchors[0]?.anchor ?? '—',
    excerpt: point.sourceAnchors[0]?.excerpt ?? '—',
    inEstablishedSet: true,
  }));

const chapterAnchor = (chapter: string): OutOfScopeConcept => {
  const outlineChapter = MOCK_OUTLINE.chapters.find((item) => item.title === chapter);
  const paragraph = outlineChapter?.paragraphs[3] ?? outlineChapter?.paragraphs[0];
  return {
    id: '',
    name: '',
    chapter,
    anchor: paragraph?.label ?? '—',
    excerpt: paragraph?.text ?? '—',
    inEstablishedSet: false,
  };
};

const extraOutOfScope: OutOfScopeConcept[] = [
  { ...chapterAnchor('树与二叉树'), id: 'ch-05-kp-09', name: '平衡二叉树' },
  { ...chapterAnchor('树与二叉树'), id: 'ch-05-kp-10', name: '红黑树' },
  { ...chapterAnchor('线性表'), id: 'ch-02-kp-08', name: '广义表' },
  { ...chapterAnchor('排序'), id: 'ch-08-kp-05', name: '外部排序' },
];

/** 6 条超纲禁区：线索二叉树、B 树为知识点库中已标记项，另 4 条为演示禁区。 */
export const DEMO_OUT_OF_SCOPE_CONCEPTS: OutOfScopeConcept[] = [
  ...establishedOutOfScope,
  ...extraOutOfScope,
];

export const DEMO_BLUEPRINT: Blueprint = MOCK_BLUEPRINT;
export const DEMO_HISTORY_BANK: TraceL1[] = MOCK_HISTORY;

export interface DemoSyllabus extends Syllabus {
  fileName: string;
  pageCount: number;
}

export const DEMO_SYLLABUS: DemoSyllabus = {
  ...MOCK_SYLLABUS,
  fileName: MOCK_OUTLINE.fileName,
  pageCount: MOCK_OUTLINE.pageCount,
};

export const APPENDIX_B_COUNTS = {
  chapters: rows.length,
  totalHours,
  establishedKnowledgePoints: DEMO_ESTABLISHED_KNOWLEDGE_POINTS.length,
  candidateKnowledgePoints: DEMO_CANDIDATE_KNOWLEDGE_POINTS.length,
  outOfScopeConcepts: DEMO_OUT_OF_SCOPE_CONCEPTS.length,
  historyQuestions: DEMO_HISTORY_BANK.length,
  questionCount: totalChoice + totalFill + totalShort + totalAlgorithm,
  totalScore,
  durationMinutes: DEMO_EXAM.durationMinutes,
  choice: totalChoice,
  fill: totalFill,
  short: totalShort,
  algorithm: totalAlgorithm,
  difficultyBands: {
    easy: 30,
    medium: 50,
    hard: 20,
  },
  weightedExpectedDifficulty,
} as const;

export const APPENDIX_B_MOCK = {
  exam: DEMO_EXAM,
  syllabus: DEMO_SYLLABUS,
  blueprint: DEMO_BLUEPRINT,
  blueprintTable: DEMO_BLUEPRINT_TABLE,
  questionTypeStructure: DEMO_QUESTION_TYPE_STRUCTURE,
  difficultyTarget: DEMO_DIFFICULTY_TARGET,
  establishedKnowledgePoints: DEMO_ESTABLISHED_KNOWLEDGE_POINTS,
  candidateKnowledgePoints: DEMO_CANDIDATE_KNOWLEDGE_POINTS,
  outOfScopeConcepts: DEMO_OUT_OF_SCOPE_CONCEPTS,
  historyBank: DEMO_HISTORY_BANK,
  counts: APPENDIX_B_COUNTS,
} as const;
