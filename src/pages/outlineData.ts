export interface OutlineParagraph {
  id: string;
  label: string;
  text: string;
}

export interface OutlineChapter {
  id: string;
  no: number;
  title: string;
  hours: number;
  paragraphs: OutlineParagraph[];
}

export interface OutlineCandidate {
  id: string;
  name: string;
  chapterId: string;
  chapter: string;
  chapterNo: number;
  paragraph: OutlineParagraph;
  requirement: string;
  empty: boolean;
}

export interface ParsedOutline {
  fileName: string;
  pageCount: number;
  chapters: OutlineChapter[];
  candidates: OutlineCandidate[];
}

interface PointSeed {
  name: string;
  paragraph: number;
  requirement: string;
}

interface ChapterSeed {
  title: string;
  hours: number;
  paragraphs: string[];
  points: PointSeed[];
  empty?: boolean;
}

/**
 * 内置《数据结构》教学大纲文本。
 * 模拟解析结果：8 章、56 学时、47 个候选知识点，其中 5 条仅有章节名。
 */
const CHAPTER_SEEDS: ChapterSeed[] = [
  {
    title: '绪论',
    hours: 4,
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

/** 模拟解析：只读取内置大纲文本，不接入真实 docx。 */
export function parseMockSyllabus(): ParsedOutline {
  const chapters: OutlineChapter[] = CHAPTER_SEEDS.map((seed, chapterIndex) => {
    const no = chapterIndex + 1;
    const id = `ch-${String(no).padStart(2, '0')}`;
    return {
      id,
      no,
      title: seed.title,
      hours: seed.hours,
      paragraphs: seed.paragraphs.map((text, paragraphIndex) => ({
        id: `${id}-p${paragraphIndex + 1}`,
        label: `第 ${no} 章 · 段 ${paragraphIndex + 1}`,
        text,
      })),
    };
  });

  const candidates: OutlineCandidate[] = [];

  CHAPTER_SEEDS.forEach((seed, chapterIndex) => {
    const chapter = chapters[chapterIndex];

    seed.points.forEach((point, pointIndex) => {
      const paragraph = chapter.paragraphs[point.paragraph];
      candidates.push({
        id: `${chapter.id}-kp-${String(pointIndex + 1).padStart(2, '0')}`,
        name: point.name,
        chapterId: chapter.id,
        chapter: chapter.title,
        chapterNo: chapter.no,
        paragraph,
        requirement: point.requirement,
        empty: false,
      });
    });

    if (seed.empty) {
      const paragraph = chapter.paragraphs[0];
      candidates.push({
        id: `${chapter.id}-empty`,
        name: chapter.title,
        chapterId: chapter.id,
        chapter: chapter.title,
        chapterNo: chapter.no,
        paragraph,
        requirement: '',
        empty: true,
      });
    }
  });

  return {
    fileName: '数据结构-教学大纲.docx',
    pageCount: 6,
    chapters,
    candidates,
  };
}

export const MOCK_OUTLINE = parseMockSyllabus();
