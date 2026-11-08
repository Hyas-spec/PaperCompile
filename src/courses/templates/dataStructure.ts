import type { CognitiveLevel } from '../../types';
import type {
  CourseChapterSeed,
  CourseHistorySeed,
  CourseKnowledgePointSeed,
  CourseTemplate,
} from '../types';

/* ===== 内置演示模板：《数据结构》期中考试（附录 B） ===== */

interface PointSeed {
  name: string;
  paragraph: number;
  requirement: string;
}

interface ChapterSeed {
  title: string;
  hours: number;
  knowledgePoints: number;
  expectedDifficulty: number;
  counts: Record<string, number>;
  paragraphs: string[];
  points: PointSeed[];
  empty?: boolean;
}

const CHAPTER_SEEDS: ChapterSeed[] = [
  {
    title: '绪论',
    hours: 4,
    knowledgePoints: 4,
    expectedDifficulty: 0.85,
    counts: { choice: 2, fill: 1, short: 0, algorithm: 0 },
    paragraphs: [
      '第 1 章 绪论（4 学时）。本章介绍数据结构与算法的基本概念，说明逻辑结构、存储结构及算法分析在后续课程中的作用。',
      '教学目标：理解数据结构的研究对象与基本术语，掌握算法的基本特性，能对简单算法进行时间与空间复杂度分析。',
      '考核要求：能区分逻辑结构与存储结构，能说明数据结构与算法的关系，能对给定算法进行复杂度分析。',
      '具体内容：数据结构与算法基本概念、逻辑结构与存储结构、算法特性与评价、时间复杂度与空间复杂度。',
    ],
    points: [
      { name: '数据结构与算法基本概念', paragraph: 2, requirement: '掌握数据结构、算法及其基本特征。' },
      { name: '逻辑结构与存储结构', paragraph: 1, requirement: '理解逻辑结构与存储结构的区别与联系。' },
      { name: '算法特性与评价', paragraph: 2, requirement: '掌握算法的有穷性、确定性、可行性等特性及评价方法。' },
      { name: '时间复杂度与空间复杂度', paragraph: 2, requirement: '掌握常见算法的时间复杂度与空间复杂度分析。' },
    ],
    empty: true,
  },
  {
    title: '线性表',
    hours: 8,
    knowledgePoints: 7,
    expectedDifficulty: 0.78,
    counts: { choice: 3, fill: 1, short: 0, algorithm: 0 },
    paragraphs: [
      '第 2 章 线性表（8 学时）。线性表是最基本的线性结构，本章讨论其顺序存储与链式存储及基本操作。',
      '教学目标：掌握线性表的逻辑结构、顺序存储与链式存储，能实现基本操作并分析时间与空间效率。',
      '考核要求：能分别实现顺序表与单链表的查找、插入、删除，能比较两种存储结构的适用场景。',
      '具体内容：线性表定义与基本操作、顺序表、单链表、双向链表与循环链表、顺序表与链表的比较。',
    ],
    points: [
      { name: '线性表的定义与基本操作', paragraph: 3, requirement: '掌握线性表的定义、逻辑特征与基本操作。' },
      { name: '顺序表的存储与实现', paragraph: 2, requirement: '掌握顺序表的存储结构及基本操作实现。' },
      { name: '顺序表的插入与删除', paragraph: 2, requirement: '能实现顺序表的插入、删除并分析元素移动次数。' },
      { name: '单链表的存储与实现', paragraph: 2, requirement: '掌握单链表的结点结构与基本操作实现。' },
      { name: '单链表的插入与删除', paragraph: 2, requirement: '能实现单链表的插入、删除并正确维护指针。' },
      { name: '双向链表与循环链表', paragraph: 3, requirement: '理解双向链表与循环链表的结构特点与操作差异。' },
      { name: '顺序表与链表的比较', paragraph: 2, requirement: '能从时间、空间与适用场景比较顺序表与链表。' },
    ],
    empty: true,
  },
  {
    title: '栈与队列',
    hours: 6,
    knowledgePoints: 5,
    expectedDifficulty: 0.75,
    counts: { choice: 2, fill: 1, short: 1, algorithm: 0 },
    paragraphs: [
      '第 3 章 栈与队列（6 学时）。栈与队列是两种受限的线性表，在表达式求值、递归与图的遍历中广泛应用。',
      '教学目标：掌握栈与队列的特性、顺序与链式实现，能分析其在典型问题中的应用。',
      '考核要求：能实现顺序栈、链栈与循环队列的基本操作，能说明栈与队列的适用场景。',
      '具体内容：栈的定义与基本操作、顺序栈与链栈、队列的定义与基本操作、循环队列、栈与队列的典型应用。',
    ],
    points: [
      { name: '栈的定义与基本操作', paragraph: 3, requirement: '掌握栈的先进后出特性与基本操作。' },
      { name: '顺序栈与链栈', paragraph: 3, requirement: '掌握顺序栈与链栈的存储结构与实现。' },
      { name: '队列的定义与基本操作', paragraph: 3, requirement: '掌握队列的先进先出特性与基本操作。' },
      { name: '循环队列', paragraph: 2, requirement: '掌握循环队列的判空、判满与入队出队操作。' },
      { name: '栈与队列的典型应用', paragraph: 2, requirement: '能运用栈与队列分析表达式求值、递归等典型问题。' },
    ],
  },
  {
    title: '串',
    hours: 4,
    knowledgePoints: 3,
    expectedDifficulty: 0.8,
    counts: { choice: 1, fill: 0, short: 1, algorithm: 0 },
    paragraphs: [
      '第 4 章 串（4 学时）。串是特殊的线性表，本章讨论串的存储、模式匹配与 KMP 算法。',
      '教学目标：掌握串的存储结构与基本操作，理解模式匹配问题，掌握 KMP 算法的 next 数组构造。',
      '考核要求：能实现串的基本操作与模式匹配，能分析 KMP 算法的时间复杂度。',
      '具体内容：串的定义与存储、模式匹配基本概念、KMP 算法。',
    ],
    points: [
      { name: '串的定义与存储', paragraph: 3, requirement: '掌握串的定义、基本操作与存储结构。' },
      { name: '模式匹配基本概念', paragraph: 3, requirement: '理解模式匹配的问题定义与朴素匹配算法。' },
      { name: 'KMP 算法', paragraph: 2, requirement: '掌握 next 数组的构造与 KMP 匹配过程。' },
    ],
    empty: true,
  },
  {
    title: '树与二叉树',
    hours: 10,
    knowledgePoints: 8,
    expectedDifficulty: 0.62,
    counts: { choice: 3, fill: 1, short: 0, algorithm: 1 },
    paragraphs: [
      '第 5 章 树与二叉树（10 学时）。树是重要的非线性结构，本章重点讨论二叉树的性质、存储、遍历与应用。',
      '教学目标：掌握树与二叉树的基本性质、存储结构与遍历方法，理解线索二叉树、哈夫曼树与树和森林的转换。',
      '考核要求：能推导二叉树性质、实现遍历、构造哈夫曼编码，能由遍历序列重构二叉树。',
      '具体内容：树的定义与基本术语、二叉树的定义与性质、二叉树的顺序存储与链式存储、二叉树的遍历、线索二叉树、树与森林的转换、哈夫曼树与哈夫曼编码、由遍历序列重构二叉树。',
    ],
    points: [
      { name: '树的定义与基本术语', paragraph: 3, requirement: '掌握树的定义、基本术语与表示方法。' },
      { name: '二叉树的定义与性质', paragraph: 3, requirement: '掌握二叉树的定义、性质与特殊二叉树。' },
      { name: '二叉树的顺序存储与链式存储', paragraph: 3, requirement: '掌握二叉树的顺序存储与链式存储结构。' },
      { name: '二叉树的遍历', paragraph: 2, requirement: '掌握先序、中序、后序与层次遍历。' },
      { name: '线索二叉树', paragraph: 1, requirement: '理解线索二叉树的线索化过程与遍历方法。' },
      { name: '树与森林的转换', paragraph: 3, requirement: '掌握树、森林与二叉树之间的转换。' },
      { name: '哈夫曼树与哈夫曼编码', paragraph: 2, requirement: '掌握哈夫曼树的构造与哈夫曼编码。' },
      { name: '由遍历序列重构二叉树', paragraph: 2, requirement: '能由先序、中序等遍历序列重构二叉树。' },
    ],
  },
  {
    title: '图',
    hours: 10,
    knowledgePoints: 7,
    expectedDifficulty: 0.6,
    counts: { choice: 2, fill: 1, short: 0, algorithm: 1 },
    paragraphs: [
      '第 6 章 图（10 学时）。图用于描述多对多关系，本章讨论图的存储、遍历与典型应用算法。',
      '教学目标：掌握图的存储结构与遍历方法，理解最小生成树、最短路径、拓扑排序与关键路径。',
      '考核要求：能实现邻接矩阵与邻接表、DFS 与 BFS，能求解最小生成树与最短路径，能进行拓扑排序与关键路径分析。',
      '具体内容：图的定义与基本术语、图的存储结构、图的遍历、最小生成树、最短路径、拓扑排序、关键路径。',
    ],
    points: [
      { name: '图的定义与基本术语', paragraph: 3, requirement: '掌握图的定义、基本术语与分类。' },
      { name: '图的存储结构', paragraph: 3, requirement: '掌握邻接矩阵与邻接表的存储结构。' },
      { name: '图的遍历', paragraph: 2, requirement: '掌握深度优先遍历与广度优先遍历。' },
      { name: '最小生成树', paragraph: 2, requirement: '掌握 Prim 与 Kruskal 算法的思想与过程。' },
      { name: '最短路径', paragraph: 2, requirement: '掌握 Dijkstra 与 Floyd 算法的思想与过程。' },
      { name: '拓扑排序', paragraph: 2, requirement: '掌握 AOV 网与拓扑排序算法。' },
      { name: '关键路径', paragraph: 2, requirement: '掌握 AOE 网与关键路径的求解。' },
    ],
  },
  {
    title: '查找',
    hours: 6,
    knowledgePoints: 4,
    expectedDifficulty: 0.72,
    counts: { choice: 1, fill: 0, short: 1, algorithm: 0 },
    paragraphs: [
      '第 7 章 查找（6 学时）。本章讨论顺序查找、折半查找、二叉排序树、哈希表与 B 树等查找结构。',
      '教学目标：掌握常见查找结构的基本概念、构造方法与效率分析，能根据场景选择查找方法。',
      '考核要求：能构造二叉排序树、设计哈希表处理冲突，能分析查找成功与失败的平均查找长度。',
      '具体内容：顺序查找与折半查找、二叉排序树、哈希表、B 树。',
    ],
    points: [
      { name: '顺序查找与折半查找', paragraph: 3, requirement: '掌握顺序查找与折半查找的过程与效率。' },
      { name: '二叉排序树', paragraph: 2, requirement: '掌握二叉排序树的构造、查找与删除。' },
      { name: '哈希表', paragraph: 2, requirement: '掌握哈希函数构造与冲突处理方法。' },
      { name: 'B 树', paragraph: 2, requirement: '了解 B 树的定义、查找与插入调整。' },
    ],
    empty: true,
  },
  {
    title: '排序',
    hours: 8,
    knowledgePoints: 4,
    expectedDifficulty: 0.7,
    counts: { choice: 1, fill: 0, short: 1, algorithm: 0 },
    paragraphs: [
      '第 8 章 排序（8 学时）。本章讨论插入、交换、选择与归并四类排序方法及其稳定性。',
      '教学目标：掌握各类排序算法的思想、实现与复杂度分析，能根据场景选择排序方法。',
      '考核要求：能实现插入、交换、选择与归并排序，能分析时间复杂度、空间复杂度与稳定性。',
      '具体内容：插入排序、交换排序、选择排序、归并排序。',
    ],
    points: [
      { name: '插入排序', paragraph: 3, requirement: '掌握直接插入排序与希尔排序的思想与实现。' },
      { name: '交换排序', paragraph: 3, requirement: '掌握冒泡排序与快速排序的思想与实现。' },
      { name: '选择排序', paragraph: 3, requirement: '掌握简单选择排序与堆排序的思想与实现。' },
      { name: '归并排序', paragraph: 3, requirement: '掌握二路归并排序的思想与实现。' },
    ],
    empty: true,
  },
];

const CHAPTER_WEIGHTS: Record<number, number> = {
  1: 40,
  2: 60,
  3: 60,
  4: 50,
  5: 80,
  6: 80,
  7: 50,
  8: 50,
};

const KEY_POINT_PATTERN = /(遍历|最短路径|关键路径|哈夫曼|KMP|B 树|排序)/;
const OUT_OF_SCOPE_NAMES = new Set(['线索二叉树', 'B 树']);

const cognitiveOf = (name: string): CognitiveLevel => {
  if (/(基本概念|定义|术语)/.test(name)) return '记忆';
  if (/(复杂度|算法特性|比较)/.test(name)) return '分析';
  if (/(遍历|KMP|最短路径|关键路径|哈夫曼|构造|插入|删除|排序)/.test(name)) return '应用';
  return '理解';
};

/**
 * 从大纲候选派生 42 个知识点，并保留说明书中的演示口径：
 * 章节权重、认知层次、超纲禁区，以及同名合并 / 层次倒挂 / 孤立节点三条提示。
 */
function buildKnowledgeSeeds(): CourseKnowledgePointSeed[] {
  const seeds: CourseKnowledgePointSeed[] = [];

  CHAPTER_SEEDS.forEach((chapter, chapterIndex) => {
    chapter.points.forEach((point, pointIndex) => {
      const id = `ch-${String(chapterIndex + 1).padStart(2, '0')}-kp-${String(
        pointIndex + 1,
      ).padStart(2, '0')}`;
      seeds.push({
        id,
        name: point.name,
        chapter: chapter.title,
        requirement: point.requirement,
        cognitiveLevel: cognitiveOf(point.name),
        weight: Math.min(
          100,
          (CHAPTER_WEIGHTS[chapterIndex + 1] ?? 50) +
            (KEY_POINT_PATTERN.test(point.name) ? 10 : 0),
        ),
        outOfScope: OUT_OF_SCOPE_NAMES.has(point.name),
        prerequisites: [],
        paragraph: point.paragraph,
      });
    });
  });

  const byChapter = new Map<string, CourseKnowledgePointSeed[]>();
  seeds.forEach((seed) => {
    const list = byChapter.get(seed.chapter) ?? [];
    list.push(seed);
    byChapter.set(seed.chapter, list);
  });

  let previousFirst: CourseKnowledgePointSeed | undefined;
  CHAPTER_SEEDS.forEach((chapter) => {
    const chapterSeeds = byChapter.get(chapter.title) ?? [];
    const first = chapterSeeds[0];
    if (!first) return;
    chapterSeeds.forEach((seed, index) => {
      seed.prerequisites = index === 0 ? (previousFirst ? [previousFirst.id] : []) : [first.id];
    });
    previousFirst = first;
  });

  // 演示数据：保留一条跨章先修，供层次倒挂提示。
  const treeTraversal = seeds.find((seed) => seed.name === '二叉树的遍历');
  const graphTraversal = seeds.find((seed) => seed.name === '图的遍历');
  if (treeTraversal && graphTraversal) {
    treeTraversal.prerequisites = [
      ...new Set([...(treeTraversal.prerequisites ?? []), graphTraversal.id]),
    ];
  }

  // 演示数据：关键路径保留为孤立节点，供孤立节点提示。
  const keyPath = seeds.find((seed) => seed.name === '关键路径');
  if (keyPath) keyPath.prerequisites = [];

  // 演示数据：制造同名知识点，供同名合并提示。
  const reconstructed = seeds.find((seed) => seed.name === '由遍历序列重构二叉树');
  if (reconstructed) reconstructed.name = '二叉树的遍历';

  return seeds;
}

const HISTORY_SEEDS: CourseHistorySeed[] = [
  {
    type: '单项选择题',
    chapter: '线性表',
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
    type: '简答与分析题',
    chapter: '栈与队列',
    stem: '简述栈与队列的主要区别，并各举一个典型应用。',
    answer: '栈先进后出，队列先进先出；栈可用于表达式求值与递归，队列可用于层次遍历与任务调度。',
    analysis: '按操作受限方式与应用场景作答。',
    scoringPoints: [
      { description: '结构区别', score: 2 },
      { description: '典型应用', score: 3 },
    ],
  },
  {
    type: '简答与分析题',
    chapter: '树与二叉树',
    stem: '已知二叉树的先序遍历序列与中序遍历序列，说明重构二叉树的步骤。',
    answer: '先序首元素为根，在中序中定位根并划分左右子树，递归处理左右区间。',
    analysis: '按根定位与区间划分过程作答。',
    scoringPoints: [
      { description: '根定位', score: 2 },
      { description: '递归划分', score: 3 },
    ],
  },
  {
    type: '算法设计与分析题',
    chapter: '图',
    stem: '简述 Dijkstra 算法求解单源最短路径的基本思想，并分析其时间复杂度。',
    answer: '按路径长度递增次序逐步确定最短路径，邻接矩阵实现时间复杂度为 O(n²)。',
    analysis: '按贪心选择与松弛过程作答。',
    scoringPoints: [
      { description: '贪心思想', score: 10 },
      { description: '复杂度分析', score: 10 },
    ],
  },
  {
    type: '简答与分析题',
    chapter: '查找',
    stem: '简述折半查找的适用条件，并分析其平均查找长度。',
    answer: '要求有序顺序存储；平均查找长度约为 log₂n。',
    analysis: '按有序性、顺序存储与判定树作答。',
    scoringPoints: [
      { description: '适用条件', score: 2 },
      { description: '平均查找长度', score: 3 },
    ],
  },
  {
    type: '简答与分析题',
    chapter: '排序',
    stem: '简述快速排序的基本思想，并说明其最坏时间复杂度。',
    answer: '以基准元素划分，递归排序左右子序列；最坏时间复杂度为 O(n²)。',
    analysis: '按划分、递归与最坏情况作答。',
    scoringPoints: [
      { description: '划分思想', score: 2 },
      { description: '复杂度结论', score: 3 },
    ],
  },
];

export const DATA_STRUCTURE_TEMPLATE: CourseTemplate = {
  id: 'DS-2025',
  name: '数据结构',
  examName: '期中考试',
  description: '附录 B 内置演示模板：8 章 / 56 学时 / 42 个确立知识点 / 26 题 / 100 分。',
  builtin: true,
  format: 'docx',
  fileName: '数据结构-教学大纲.docx',
  pageCount: 6,
  assessmentMethod: '期中考试，闭卷，120 分钟，满分 100 分',
  references: ['《数据结构（C 语言版）》', '课程组自编知识点库'],
  chapters: CHAPTER_SEEDS.map<CourseChapterSeed>((chapter) => ({
    title: chapter.title,
    hours: chapter.hours,
    knowledgePoints: chapter.knowledgePoints,
    expectedDifficulty: chapter.expectedDifficulty,
    counts: chapter.counts,
    paragraphs: chapter.paragraphs,
    points: chapter.points,
    empty: chapter.empty,
  })),
  totalScore: 100,
  durationMinutes: 120,
  questionTypes: [
    {
      key: 'choice',
      label: '单项选择题',
      short: '单选',
      role: 'choice',
      score: 2,
      minutes: 30,
      cognitiveLevel: '理解',
      targetCount: 15,
      band: 3,
    },
    {
      key: 'fill',
      label: '填空题',
      short: '填空',
      role: 'fill',
      score: 2,
      minutes: 10,
      cognitiveLevel: '记忆',
      targetCount: 5,
      band: 3,
    },
    {
      key: 'short',
      label: '简答与分析题',
      short: '简答',
      role: 'short',
      score: 5,
      minutes: 30,
      cognitiveLevel: '应用',
      targetCount: 4,
      band: 3,
    },
    {
      key: 'algorithm',
      label: '算法设计与分析题',
      short: '算法',
      role: 'algorithm',
      score: 20,
      minutes: 50,
      cognitiveLevel: '分析',
      targetCount: 2,
      band: 3,
    },
  ],
  difficultyPlan: {
    bands: [
      { level: '易', min: 0.8, max: 1, scoreRatio: 30 },
      { level: '中', min: 0.6, max: 0.8, scoreRatio: 50 },
      { level: '难', min: 0, max: 0.6, scoreRatio: 20 },
    ],
    expected: 0.65,
    tolerance: 0.05,
  },
  coverageTarget: { minRate: 90, minPerChapter: 1 },
  ratioBand: 3,
  sourceLabel: '表 2-2',
  extraOutOfScopeAsKnowledge: false,
  knowledge: buildKnowledgeSeeds(),
  historySeeds: HISTORY_SEEDS,
  historyCount: 120,
  extraOutOfScope: [
    { id: 'ch-05-kp-09', name: '平衡二叉树', chapter: '树与二叉树' },
    { id: 'ch-05-kp-10', name: '红黑树', chapter: '树与二叉树' },
    { id: 'ch-02-kp-08', name: '广义表', chapter: '线性表' },
    { id: 'ch-08-kp-05', name: '外部排序', chapter: '排序' },
  ],
  demoProfile: {
    firstDoubleIndex: 11,
    reviewKeys: [
      'T-12-B',
      'T-13-B',
      'T-15-B',
      'T-16-B',
      'T-17-B',
      'T-18-B',
      'T-19-B',
      'T-21-B',
      'T-22-B',
    ],
    resolvableKeys: ['T-12-B', 'T-19-B', 'T-22-B'],
    blockedTaskIds: ['T-14', 'T-24'],
    retryTaskId: 'T-13',
    blockedProbes: [
      {
        taskId: 'T-14',
        stem: '关于线索二叉树，下列说法正确的是（ ）。',
        options: [
          { label: 'A', content: '线索二叉树利用空指针域存放前驱与后继信息' },
          { label: 'B', content: '线索二叉树必须使用三叉链表' },
          { label: 'C', content: '线索二叉树不能进行遍历' },
          { label: 'D', content: '线索二叉树只适用于完全二叉树' },
        ],
        answer: 'A',
        analysis: '线索二叉树通过线索化利用空指针域，支持按前驱后继遍历。',
      },
      {
        taskId: 'T-24',
        stem: '简述 B 树与二叉排序树的区别，并分析 B 树的查找效率。',
        answer:
          'B 树是多路平衡查找树，结点可含多个关键字与子树；二叉排序树是二叉结构。B 树查找效率与树高相关，通常为 O(log n)。',
        analysis: '按多路平衡、结点结构与查找复杂度三个维度比较。',
        scoringPoints: [
          { description: '结构区别', score: 2 },
          { description: '查找效率', score: 2 },
          { description: '表达完整', score: 1 },
        ],
      },
    ],
  },
};
