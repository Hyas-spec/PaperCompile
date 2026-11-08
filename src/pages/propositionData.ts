import type {
  Blueprint,
  BlueprintCell,
  CognitiveLevel,
  Contract,
  ContractItem,
  DifficultyBand,
  KnowledgePoint,
  QuestionType,
  Syllabus,
  TraceL1,
} from '../types';
import { contractFromRows, DEFAULT_ROWS } from './contractData';
import { MOCK_OUTLINE } from './outlineData';

/* ===== 演示课程口径：对齐表 2-2、表 7-2、表 B-1 ===== */

export interface TypeDef {
  key: 'choice' | 'fill' | 'short' | 'algorithm';
  label: QuestionType;
  short: string;
  score: number;
  cognitiveLevel: CognitiveLevel;
}

export const QUESTION_TYPE_DEFS: TypeDef[] = [
  { key: 'choice', label: '单项选择题', short: '单选', score: 2, cognitiveLevel: '理解' },
  { key: 'fill', label: '填空题', short: '填空', score: 2, cognitiveLevel: '记忆' },
  { key: 'short', label: '简答与分析题', short: '简答', score: 5, cognitiveLevel: '应用' },
  { key: 'algorithm', label: '算法设计与分析题', short: '算法', score: 20, cognitiveLevel: '分析' },
];

export interface ChapterDef {
  title: string;
  hours: number;
  knowledgePoints: number;
  expectedDifficulty: number;
  targetScore: number;
  counts: Record<TypeDef['key'], number>;
}

/** 表 B-1：按章节的题型与分值分配。 */
export const CHAPTER_DEFS: ChapterDef[] = [
  { title: '绪论', hours: 4, knowledgePoints: 4, expectedDifficulty: 0.85, targetScore: 6, counts: { choice: 2, fill: 1, short: 0, algorithm: 0 } },
  { title: '线性表', hours: 8, knowledgePoints: 7, expectedDifficulty: 0.78, targetScore: 8, counts: { choice: 3, fill: 1, short: 0, algorithm: 0 } },
  { title: '栈与队列', hours: 6, knowledgePoints: 5, expectedDifficulty: 0.75, targetScore: 11, counts: { choice: 2, fill: 1, short: 1, algorithm: 0 } },
  { title: '串', hours: 4, knowledgePoints: 3, expectedDifficulty: 0.80, targetScore: 7, counts: { choice: 1, fill: 0, short: 1, algorithm: 0 } },
  { title: '树与二叉树', hours: 10, knowledgePoints: 8, expectedDifficulty: 0.62, targetScore: 28, counts: { choice: 3, fill: 1, short: 0, algorithm: 1 } },
  { title: '图', hours: 10, knowledgePoints: 7, expectedDifficulty: 0.60, targetScore: 26, counts: { choice: 2, fill: 1, short: 0, algorithm: 1 } },
  { title: '查找', hours: 6, knowledgePoints: 4, expectedDifficulty: 0.72, targetScore: 7, counts: { choice: 1, fill: 0, short: 1, algorithm: 0 } },
  { title: '排序', hours: 8, knowledgePoints: 4, expectedDifficulty: 0.70, targetScore: 7, counts: { choice: 1, fill: 0, short: 1, algorithm: 0 } },
];

const cells: BlueprintCell[] = [];for (const chapter of CHAPTER_DEFS) {
  for (const type of QUESTION_TYPE_DEFS) {
    const count = chapter.counts[type.key];
    if (count === 0) continue;
    cells.push({
      chapter: chapter.title,
      questionType: type.label,
      questionCount: count,
      score: count * type.score,
      difficulty: chapter.expectedDifficulty,
      cognitiveLevel: type.cognitiveLevel,
    });
  }
}

const bands: DifficultyBand[] = [
  { level: '易', min: 0.80, max: 1, scoreRatio: 30 },
  { level: '中', min: 0.60, max: 0.80, scoreRatio: 50 },
  { level: '难', min: 0, max: 0.60, scoreRatio: 20 },
];

export const MOCK_BLUEPRINT: Blueprint = {
  version: 'v1',
  totalScore: 100,
  durationMinutes: 120,
  questionCount: 26,
  cells,
  difficultyPlan: { bands, expected: 0.65, tolerance: 0.05 },
  coverageTarget: { minRate: 90, minPerChapter: 1 },
};

export const MOCK_SYLLABUS: Syllabus = {
  id: 'syllabus-data-structure',
  course: '《数据结构》',
  format: 'docx',
  chapters: MOCK_OUTLINE.chapters.map((chapter) => ({
    title: chapter.title,
    hours: chapter.hours,
    objectives: chapter.paragraphs
      .filter((paragraph) => paragraph.text.includes('教学目标'))
      .map((paragraph) => paragraph.text),
    assessmentRequirements: chapter.paragraphs
      .filter((paragraph) => paragraph.text.includes('考核要求'))
      .map((paragraph) => paragraph.text),
    anchors: chapter.paragraphs.map((paragraph) => ({
      anchor: paragraph.label,
      excerpt: paragraph.text,
    })),
  })),
  assessmentMethod: '期中考试，闭卷，120 分钟，满分 100 分',
  references: [],
};

const OUT_OF_SCOPE_NAMES = new Set(['线索二叉树', 'B 树']);

const cognitiveOf = (name: string): CognitiveLevel => {
  if (/(定义|基本术语|基本概念)/.test(name)) return '记忆';
  if (/(复杂度|比较|分析)/.test(name)) return '分析';
  if (/(遍历|KMP|最短路径|关键路径|哈夫曼|构造|插入|删除|排序)/.test(name)) return '应用';
  return '理解';
};

/** 42 个确立知识点；线索二叉树、B 树保留在库中并标记超纲禁区。 */
export const MOCK_KNOWLEDGE: KnowledgePoint[] = MOCK_OUTLINE.candidates
  .filter((candidate) => !candidate.empty)
  .map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    chapter: candidate.chapter,
    parentId: null,
    weight: 50,
    cognitiveLevel: cognitiveOf(candidate.name),
    prerequisites: [],
    outOfScope: OUT_OF_SCOPE_NAMES.has(candidate.name),
    state: '确立',
    sourceAnchors: [
      { anchor: candidate.paragraph.label, excerpt: candidate.paragraph.text },
    ],
  }));

const HISTORY_SEEDS: Array<Omit<TraceL1, 'questionNo'>> = [
  {
    stem: '下列关于线性表顺序存储与链式存储的叙述中，正确的是（ ）。',
    options: [
      { label: 'A', content: '顺序表插入删除不需要移动元素' },
      { label: 'B', content: '链表按序号访问的时间复杂度为 O(n)' },
      { label: 'C', content: '顺序表一定比链表节省空间' },
      { label: 'D', content: '链表必须占用连续存储空间' },
    ],
    answer: 'B',
    analysis: '链表按序号访问需从头结点依次查找，时间复杂度为 O(n)。',
    scoringPoints: [{ description: '存储结构比较', score: 2 }],
  },
  {
    stem: '简述栈与队列的主要区别，并各举一个典型应用。',
    answer: '栈先进后出，队列先进先出；栈可用于表达式求值与递归，队列可用于层次遍历与任务调度。',
    analysis: '按操作受限方式与应用场景作答。',
    scoringPoints: [
      { description: '结构区别', score: 2 },
      { description: '典型应用', score: 2 },
    ],
  },
  {
    stem: '已知二叉树的先序遍历序列与中序遍历序列，说明重构二叉树的步骤。',
    answer: '先序首元素为根，在中序中定位根并划分左右子树，递归处理左右区间。',
    analysis: '按根定位与区间划分过程作答。',
    scoringPoints: [
      { description: '根定位', score: 2 },
      { description: '递归划分', score: 3 },
    ],
  },
  {
    stem: '简述 Dijkstra 算法求解单源最短路径的基本思想，并分析其时间复杂度。',
    answer: '按路径长度递增次序逐步确定最短路径，邻接矩阵实现时间复杂度为 O(n²)。',
    analysis: '按贪心选择与松弛过程作答。',
    scoringPoints: [
      { description: '贪心思想', score: 3 },
      { description: '复杂度分析', score: 2 },
    ],
  },
  {
    stem: '简述折半查找的适用条件，并分析其平均查找长度。',
    answer: '要求有序顺序存储；平均查找长度约为 log₂n。',
    analysis: '按有序性、顺序存储与判定树作答。',
    scoringPoints: [
      { description: '适用条件', score: 2 },
      { description: '平均查找长度', score: 2 },
    ],
  },
  {
    stem: '简述快速排序的基本思想，并说明其最坏时间复杂度。',
    answer: '以基准元素划分，递归排序左右子序列；最坏时间复杂度为 O(n²)。',
    analysis: '按划分、递归与最坏情况作答。',
    scoringPoints: [
      { description: '划分思想', score: 2 },
      { description: '复杂度结论', score: 2 },
    ],
  },
];

/** 120 道历史题：与演示课程一致，用于重复校验的 mock 基线。 */
export const MOCK_HISTORY: TraceL1[] = Array.from({ length: 120 }, (_, index) => {
  const seed = HISTORY_SEEDS[index % HISTORY_SEEDS.length];
  return {
    ...seed,
    questionNo: `H-${String(index + 1).padStart(3, '0')}`,
    options: seed.options?.map((option) => ({ ...option })),
    scoringPoints: seed.scoringPoints.map((point) => ({ ...point })),
  };
});

export const PROPOSITION_OVERVIEW = {
  blueprintVersion: MOCK_BLUEPRINT.version,
  questionCount: MOCK_BLUEPRINT.questionCount,
  totalScore: MOCK_BLUEPRINT.totalScore,
  durationMinutes: MOCK_BLUEPRINT.durationMinutes,
  contractItems: contractFromRows(DEFAULT_ROWS).items.length,
  knowledgePoints: MOCK_KNOWLEDGE.length,
  historyCount: MOCK_HISTORY.length,
};

const REQUIREMENT_BY_ID = new Map(
  MOCK_OUTLINE.candidates.map((candidate) => [
    candidate.id,
    candidate.requirement,
  ]),
);

export const requirementOfPoint = (point: KnowledgePoint): string =>
  REQUIREMENT_BY_ID.get(point.id) ||
  point.sourceAnchors[0]?.excerpt ||
  `掌握${point.name}的基本要求。`;

export const CHAPTER_ORDER = CHAPTER_DEFS.map((chapter) => chapter.title);
export const TYPE_ORDER = QUESTION_TYPE_DEFS.map((type) => type.label);

export const scoreOfType = (label: QuestionType): number =>
  QUESTION_TYPE_DEFS.find((type) => type.label === label)?.score ?? 0;

export const cognitiveOfType = (label: QuestionType): CognitiveLevel =>
  QUESTION_TYPE_DEFS.find((type) => type.label === label)?.cognitiveLevel ?? '理解';

export const expectedDifficultyOfCell = (
  chapter: string,
  questionType: QuestionType,
): number =>
  MOCK_BLUEPRINT.cells.find(
    (cell) => cell.chapter === chapter && cell.questionType === questionType,
  )?.difficulty ?? MOCK_BLUEPRINT.difficultyPlan.expected;

export interface PropositionContext {
  blueprint: Blueprint;
  contract: Contract;
  syllabus: Syllabus;
  knowledgeBase: KnowledgePoint[];
  historyBank: TraceL1[];
  contractByItem: Map<string, ContractItem>;
  knowledgeById: Map<string, KnowledgePoint>;
  chapterOrder: string[];
}

export function buildPropositionContext(
  contract?: Contract | null,
  knowledgePoints?: KnowledgePoint[] | null,
): PropositionContext {
  const activeContract =
    contract && contract.items.length > 0
      ? contract
      : contractFromRows(DEFAULT_ROWS);
  const knowledgeBase =
    knowledgePoints && knowledgePoints.length > 0
      ? knowledgePoints
      : MOCK_KNOWLEDGE;

  return {
    blueprint: MOCK_BLUEPRINT,
    contract: activeContract,
    syllabus: MOCK_SYLLABUS,
    knowledgeBase,
    historyBank: MOCK_HISTORY,
    contractByItem: new Map(activeContract.items.map((item) => [item.id, item])),
    knowledgeById: new Map(knowledgeBase.map((point) => [point.id, point])),
    chapterOrder: CHAPTER_ORDER,
  };
}
