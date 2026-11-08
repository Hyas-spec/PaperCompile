import type {
  Blueprint,
  BlueprintCell,
  CognitiveLevel,
  DifficultyBand,
  KnowledgePoint,
  TraceL1,
} from '../types';
import type {
  CourseBlockedProbe,
  CourseChapterRuntime,
  CourseChapterSeed,
  CourseCounts,
  CourseKnowledgePointSeed,
  CoursePack,
  CourseQuestionType,
  CourseTemplate,
  OutlineCandidate,
  OutlineChapter,
  OutOfScopeConcept,
  ParsedOutline,
  QuestionTypeRole,
} from './types';

export const COGNITIVE_LEVELS: CognitiveLevel[] = ['记忆', '理解', '应用', '分析', '综合'];

const COGNITIVE_DIFFICULTY: Record<CognitiveLevel, number> = {
  记忆: 0.85,
  理解: 0.76,
  应用: 0.66,
  分析: 0.56,
  综合: 0.5,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const pad2 = (value: number): string => String(value).padStart(2, '0');

const round2 = (value: number): number => Math.round(value * 100) / 100;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const roleOf = (type: CourseQuestionType): QuestionTypeRole => type.role ?? 'other';

/** 按权重把总数分配到各章节，余数给小数部分最大的章节。 */
export function distributeByWeight(total: number, weights: number[]): number[] {
  const safeTotal = Math.max(0, Math.round(total));
  const sum = weights.reduce((acc, weight) => acc + Math.max(0, weight), 0);
  if (safeTotal === 0 || sum === 0) return weights.map(() => 0);

  const raw = weights.map((weight) => (Math.max(0, weight) / sum) * safeTotal);
  const base = raw.map((value) => Math.floor(value));
  let remainder = safeTotal - base.reduce((acc, value) => acc + value, 0);

  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

  for (let index = 0; index < order.length && remainder > 0; index += 1) {
    base[order[index].index] += 1;
    remainder -= 1;
  }
  return base;
}

/** 把分值拆成若干整数评分点，保证合计等于题型分值。 */
export function splitScore(total: number, parts: number): number[] {
  const count = Math.max(1, parts);
  const safe = Math.max(1, Math.round(total));
  const base = Math.floor(safe / count);
  const result = Array.from({ length: count }, () => base);
  let remainder = safe - base * count;
  for (let index = 0; index < result.length && remainder > 0; index += 1) {
    result[index] += 1;
    remainder -= 1;
  }
  return result;
}

/** 题型角色 → 章节认知层次估算，用于新课程自动生成难度。 */
const cognitiveMixOf = (points: KnowledgePoint[]): number[] => {
  const counts = COGNITIVE_LEVELS.map(() => 0);
  points.forEach((point) => {
    const index = COGNITIVE_LEVELS.indexOf(point.cognitiveLevel);
    if (index >= 0) counts[index] += 1;
  });
  const total = counts.reduce((acc, value) => acc + value, 0);
  return counts.map((value) => (total > 0 ? value / total : 0));
};

const cognitiveOfName = (name: string): CognitiveLevel => {
  if (/(定义|概念|术语|分类|格式|组成|特征)/.test(name)) return '记忆';
  if (/(比较|分析|区别|优缺点|关系)/.test(name)) return '分析';
  if (/(算法|计算|过程|实现|应用|调度|划分|转换|遍历|设计)/.test(name)) return '应用';
  if (/(综合|建模|方案)/.test(name)) return '综合';
  return '理解';
};

/* ===== 课程模板标准化 ===== */

function normalizeTemplate(input: CourseTemplate): CourseTemplate {
  const template = clone(input);
  const hours = template.chapters.map((chapter) => Math.max(1, chapter.hours));

  template.questionTypes = template.questionTypes.map((type) => ({
    ...type,
    targetCount: Math.max(0, Math.round(type.targetCount ?? 0)),
    score: Math.max(1, Math.round(type.score ?? 1)),
    minutes: Math.max(0, Math.round(type.minutes ?? 0)),
    band: Number.isFinite(type.band) ? type.band : template.ratioBand ?? 3,
  }));

  if (template.questionTypes.length === 0) {
    template.questionTypes = [
      {
        key: 'choice',
        label: '单项选择题',
        short: '单选',
        role: 'choice',
        score: 2,
        minutes: 30,
        cognitiveLevel: '理解',
        targetCount: 10,
        band: 3,
      },
    ];
  }

  // 章节题量：按学时权重自动补齐到题型目标题量。
  for (const type of template.questionTypes) {
    const sum = template.chapters.reduce(
      (acc, chapter) => acc + Math.max(0, chapter.counts?.[type.key] ?? 0),
      0,
    );
    if (sum !== type.targetCount) {
      const distributed = distributeByWeight(type.targetCount, hours);
      template.chapters.forEach((chapter, index) => {
        chapter.counts = { ...chapter.counts, [type.key]: distributed[index] };
      });
    } else {
      template.chapters.forEach((chapter) => {
        chapter.counts = {
          ...chapter.counts,
          [type.key]: Math.max(0, chapter.counts?.[type.key] ?? 0),
        };
      });
    }
  }

  // 建议用时合计必须等于考试时长。
  const minuteSum = template.questionTypes.reduce(
    (acc, type) => acc + Math.max(0, type.minutes),
    0,
  );
  if (minuteSum !== template.durationMinutes) {
    const weights = template.questionTypes.map(
      (type) => Math.max(1, type.score * Math.max(1, type.targetCount)),
    );
    const distributed = distributeByWeight(template.durationMinutes, weights);
    template.questionTypes.forEach((type, index) => {
      type.minutes = distributed[index];
    });
  }

  // 满分以章节题量 × 题型分值重新汇总，避免契约与蓝图口径不一致。
  const computedTotal = template.chapters.reduce((sum, chapter) => {
    return (
      sum +
      template.questionTypes.reduce(
        (chapterSum, type) =>
          chapterSum + (chapter.counts?.[type.key] ?? 0) * type.score,
        0,
      )
    );
  }, 0);
  template.totalScore = computedTotal > 0 ? computedTotal : template.totalScore || 100;

  if (!template.chapters[0]?.title) {
    template.chapters = [
      {
        title: '第一章',
        hours: 16,
        counts: {},
        paragraphs: [],
      },
    ];
  }

  template.ratioBand = Number.isFinite(template.ratioBand) ? template.ratioBand : 3;
  template.coverageTarget = {
    minRate: clamp(template.coverageTarget?.minRate ?? 90, 0, 100),
    minPerChapter: Math.max(0, template.coverageTarget?.minPerChapter ?? 1),
  };

  return template;
}

/* ===== 大纲 ===== */

const paragraphText = (chapter: CourseChapterSeed): string[] => {
  if (chapter.paragraphs?.length > 0) return chapter.paragraphs;
  const names = (chapter.points ?? []).map((point) => point.name).join('、');
  return [
    `第 ${chapter.title}（${chapter.hours} 学时）。本章围绕核心概念、典型方法与综合应用展开。`,
    `教学目标：掌握${chapter.title}的基本概念与基本方法，能分析典型问题。`,
    `考核要求：能说明${chapter.title}的核心概念，能完成基本分析与应用。`,
    `具体内容：${names || chapter.title}。`,
  ];
};

function buildOutline(template: CourseTemplate): ParsedOutline {
  const chapters: OutlineChapter[] = template.chapters.map((chapter, index) => {
    const no = index + 1;
    const id = `ch-${pad2(no)}`;
    return {
      id,
      no,
      title: chapter.title,
      hours: chapter.hours,
      paragraphs: paragraphText(chapter).map((text, paragraphIndex) => ({
        id: `${id}-p${paragraphIndex + 1}`,
        label: `第 ${no} 章 · 段 ${paragraphIndex + 1}`,
        text,
      })),
    };
  });

  const candidates: OutlineCandidate[] = [];
  template.chapters.forEach((chapter, chapterIndex) => {
    const runtimeChapter = chapters[chapterIndex];
    const points = chapter.points ?? [];
    const knowledgePoints = chapter.knowledgePoints ?? points.length;

    points.forEach((point, pointIndex) => {
      const paragraphIndex = clamp(
        point.paragraph ?? (runtimeChapter.paragraphs.length > 2 ? 2 : 0),
        0,
        Math.max(0, runtimeChapter.paragraphs.length - 1),
      );
      candidates.push({
        id: `${runtimeChapter.id}-kp-${pad2(pointIndex + 1)}`,
        name: point.name,
        chapterId: runtimeChapter.id,
        chapter: runtimeChapter.title,
        chapterNo: runtimeChapter.no,
        paragraph: runtimeChapter.paragraphs[paragraphIndex],
        requirement: point.requirement,
        empty: false,
      });
    });

    if (chapter.empty) {
      candidates.push({
        id: `${runtimeChapter.id}-empty`,
        name: runtimeChapter.title,
        chapterId: runtimeChapter.id,
        chapter: runtimeChapter.title,
        chapterNo: runtimeChapter.no,
        paragraph: runtimeChapter.paragraphs[0],
        requirement: '',
        empty: true,
      });
    }

    if (points.length === 0 && chapter.points === undefined && knowledgePoints > 0) {
      // 章节未提供知识点时生成可审定的占位候选。
      candidates.push({
        id: `${runtimeChapter.id}-kp-01`,
        name: `${runtimeChapter.title}核心概念`,
        chapterId: runtimeChapter.id,
        chapter: runtimeChapter.title,
        chapterNo: runtimeChapter.no,
        paragraph: runtimeChapter.paragraphs[0],
        requirement: `掌握${runtimeChapter.title}的核心概念与基本方法。`,
        empty: false,
      });
    }
  });

  return {
    fileName: template.fileName,
    pageCount: template.pageCount,
    chapters,
    candidates,
  };
}

/* ===== 知识点 ===== */

function deriveKnowledgeFromOutline(
  template: CourseTemplate,
  outline: ParsedOutline,
): CourseKnowledgePointSeed[] {
  return outline.candidates
    .filter((candidate) => !candidate.empty)
    .map((candidate, index) => {
      const chapter = template.chapters.find(
        (item) => item.title === candidate.chapter,
      );
      const seed = chapter?.points?.find((point) => point.name === candidate.name);
      return {
        id: candidate.id,
        name: candidate.name,
        chapter: candidate.chapter,
        requirement: candidate.requirement,
        cognitiveLevel: seed?.cognitiveLevel ?? cognitiveOfName(candidate.name),
        weight: seed?.weight ?? (index % 5 === 0 ? 60 : 50),
        outOfScope: Boolean(seed?.outOfScope),
        prerequisites: [],
        paragraph: 0,
      };
    });
}

const anchorOf = (
  seed: CourseKnowledgePointSeed,
  outline: ParsedOutline,
  knowledgeByCandidate: Map<string, OutlineCandidate>,
): { anchor: string; excerpt: string } => {
  const candidate =
    knowledgeByCandidate.get(seed.id) ??
    outline.candidates.find(
      (item) => item.chapter === seed.chapter && item.name === seed.name,
    );
  if (candidate) {
    return { anchor: candidate.paragraph.label, excerpt: candidate.paragraph.text };
  }
  const chapter = outline.chapters.find((item) => item.title === seed.chapter);
  const paragraph = chapter?.paragraphs[0];
  return {
    anchor: paragraph?.label ?? `${seed.chapter} · 知识点库`,
    excerpt: paragraph?.text ?? `知识点库登记的「${seed.name}」。`,
  };
};

function buildKnowledge(
  template: CourseTemplate,
  outline: ParsedOutline,
): KnowledgePoint[] {
  const candidateById = new Map(outline.candidates.map((item) => [item.id, item]));
  const seeds =
    template.knowledge && template.knowledge.length > 0
      ? template.knowledge
      : deriveKnowledgeFromOutline(template, outline);

  const points: KnowledgePoint[] = seeds.map((seed) => {
    const anchor = anchorOf(seed, outline, candidateById);
    return {
      id: seed.id,
      name: seed.name,
      chapter: seed.chapter,
      parentId: null,
      weight: clamp(seed.weight ?? 60, 0, 100),
      cognitiveLevel: seed.cognitiveLevel ?? cognitiveOfName(seed.name),
      prerequisites: [...(seed.prerequisites ?? [])].filter((id) => id !== seed.id),
      outOfScope: Boolean(seed.outOfScope),
      state: '确立',
      sourceAnchors: [anchor],
    };
  });

  // 补齐大纲中已确立但知识点库未登记的知识点，避免覆盖校验误拦截。
  outline.candidates
    .filter((candidate) => !candidate.empty)
    .forEach((candidate) => {
      const exists = points.some(
        (point) =>
          point.id === candidate.id ||
          (point.chapter === candidate.chapter && point.name === candidate.name),
      );
      if (exists) return;
      points.push({
        id: candidate.id,
        name: candidate.name,
        chapter: candidate.chapter,
        parentId: null,
        weight: 50,
        cognitiveLevel: cognitiveOfName(candidate.name),
        prerequisites: [],
        outOfScope: false,
        state: '确立',
        sourceAnchors: [
          { anchor: candidate.paragraph.label, excerpt: candidate.paragraph.text },
        ],
      });
    });

  // 额外超纲禁区：登记为知识点库中的超纲知识点，供超纲闸门回查。
  if (template.extraOutOfScopeAsKnowledge !== false) {
    (template.extraOutOfScope ?? []).forEach((extra) => {
      if (points.some((point) => point.name === extra.name)) return;
      const chapter = outline.chapters.find((item) => item.title === extra.chapter);
      const paragraph = chapter?.paragraphs[0];
      points.push({
        id: extra.id,
        name: extra.name,
        chapter: extra.chapter,
        parentId: null,
        weight: 30,
        cognitiveLevel: '理解',
        prerequisites: [],
        outOfScope: true,
        state: '确立',
        sourceAnchors: [
          {
            anchor: paragraph?.label ?? `${extra.chapter} · 知识点库`,
            excerpt: paragraph?.text ?? `知识点库登记的超纲禁区「${extra.name}」。`,
          },
        ],
      });
    });
  }

  // 通用先修关系：每章首点承接上一章首点，其余点以本章首点为先修。
  const pointsByChapter = new Map<string, KnowledgePoint[]>();
  points.forEach((point) => {
    const list = pointsByChapter.get(point.chapter) ?? [];
    list.push(point);
    pointsByChapter.set(point.chapter, list);
  });

  let previousFirst: KnowledgePoint | undefined;
  outline.chapters.forEach((chapter) => {
    const chapterPoints = pointsByChapter.get(chapter.title) ?? [];
    const first = chapterPoints[0];
    if (!first) return;
    chapterPoints.forEach((point, index) => {
      const seed = seeds.find((item) => item.id === point.id);
      if (seed?.prerequisites !== undefined) return;
      point.prerequisites =
        index === 0 ? (previousFirst ? [previousFirst.id] : []) : [first.id];
    });
    previousFirst = first;
  });

  return points;
}

/* ===== 蓝图 ===== */

function buildBlueprint(
  template: CourseTemplate,
  knowledge: KnowledgePoint[],
): { blueprint: Blueprint; chapters: CourseChapterRuntime[] } {
  const cells: BlueprintCell[] = [];
  const difficultyTarget = template.difficultyPlan.expected;

  const rawChapters: CourseChapterRuntime[] = template.chapters.map((chapter, index) => {
    const chapterPoints = knowledge.filter(
      (point) => point.chapter === chapter.title && !point.outOfScope,
    );
    const mix = cognitiveMixOf(chapterPoints.length > 0 ? chapterPoints : knowledge.filter(
      (point) => point.chapter === chapter.title,
    ));
    const targetCounts: Record<string, number> = {};
    let targetScore = 0;
    template.questionTypes.forEach((type) => {
      const count = Math.max(0, chapter.counts?.[type.key] ?? 0);
      targetCounts[type.key] = count;
      targetScore += count * type.score;
      if (count > 0) {
        cells.push({
          chapter: chapter.title,
          questionType: type.label,
          questionCount: count,
          score: count * type.score,
          difficulty: 0.65,
          cognitiveLevel: type.cognitiveLevel,
        });
      }
    });

    const rawDifficulty =
      chapter.expectedDifficulty ??
      (chapterPoints.length > 0
        ? chapterPoints.reduce(
            (sum, point) => sum + COGNITIVE_DIFFICULTY[point.cognitiveLevel],
            0,
          ) / chapterPoints.length
        : difficultyTarget);

    return {
      id: `ch-${pad2(index + 1)}`,
      no: index + 1,
      title: chapter.title,
      hours: chapter.hours,
      knowledgePoints: chapter.knowledgePoints ?? (chapter.points ?? []).length,
      expectedDifficulty: rawDifficulty,
      targetScore,
      targetCounts,
      cognitiveMix: mix,
    };
  });

  // 自定义课程没有声明章节期望难度时，把加权期望难度校准到课程目标。
  const totalScore = rawChapters.reduce((sum, chapter) => sum + chapter.targetScore, 0);
  const needsCalibration = template.chapters.some(
    (chapter) => chapter.expectedDifficulty === undefined,
  );
  if (needsCalibration && totalScore > 0) {
    const weighted =
      rawChapters.reduce(
        (sum, chapter) => sum + chapter.targetScore * chapter.expectedDifficulty,
        0,
      ) / totalScore;
    const delta = difficultyTarget - weighted;
    rawChapters.forEach((chapter) => {
      chapter.expectedDifficulty = round2(
        clamp(chapter.expectedDifficulty + delta, 0.4, 0.92),
      );
    });
  }

  const chapterByTitle = new Map(rawChapters.map((chapter) => [chapter.title, chapter]));
  cells.forEach((cell) => {
    cell.difficulty = chapterByTitle.get(cell.chapter)?.expectedDifficulty ?? difficultyTarget;
  });

  const questionCount = rawChapters.reduce(
    (sum, chapter) =>
      sum + Object.values(chapter.targetCounts).reduce((count, value) => count + value, 0),
    0,
  );

  const blueprint: Blueprint = {
    version: 'v1',
    totalScore,
    durationMinutes: template.durationMinutes,
    questionCount,
    cells,
    difficultyPlan: {
      bands: clone(template.difficultyPlan.bands),
      expected: difficultyTarget,
      tolerance: template.difficultyPlan.tolerance,
    },
    coverageTarget: { ...template.coverageTarget },
  };

  return { blueprint, chapters: rawChapters };
}

/* ===== 超纲禁区 ===== */

function buildOutOfScope(
  template: CourseTemplate,
  knowledge: KnowledgePoint[],
  outline: ParsedOutline,
): OutOfScopeConcept[] {
  const result: OutOfScopeConcept[] = [];
  const seen = new Set<string>();

  knowledge
    .filter((point) => point.outOfScope)
    .forEach((point) => {
      if (seen.has(point.name)) return;
      seen.add(point.name);
      result.push({
        id: point.id,
        name: point.name,
        chapter: point.chapter,
        anchor: point.sourceAnchors[0]?.anchor ?? '—',
        excerpt: point.sourceAnchors[0]?.excerpt ?? '—',
        inEstablishedSet: true,
      });
    });

  (template.extraOutOfScope ?? []).forEach((extra) => {
    if (seen.has(extra.name)) return;
    seen.add(extra.name);
    const chapter = outline.chapters.find((item) => item.title === extra.chapter);
    const paragraph = chapter?.paragraphs[0];
    result.push({
      id: extra.id,
      name: extra.name,
      chapter: extra.chapter,
      anchor: paragraph?.label ?? '—',
      excerpt: paragraph?.text ?? '—',
      inEstablishedSet: false,
    });
  });

  return result;
}

/* ===== 历史题库 ===== */

const genericHistorySeeds = (template: CourseTemplate): TraceL1[] => {
  const seeds: TraceL1[] = [];
  const typeByRole = new Map<string, CourseQuestionType>();
  template.questionTypes.forEach((type) => typeByRole.set(roleOf(type), type));

  template.chapters.forEach((chapter, index) => {
    const no = index + 1;
    const choice = typeByRole.get('choice');
    if (choice) {
      seeds.push({
        questionNo: '',
        stem: `在「${chapter.title}」历年试题中，关于第 ${no} 章综合应用的下列叙述，正确的是（ ）。`,
        options: [
          { label: 'A', content: '需要结合本章概念与过程进行分析' },
          { label: 'B', content: '只需记忆结论，不必理解过程' },
          { label: 'C', content: '与本章其他知识点没有关联' },
          { label: 'D', content: '不属于本课程考核范围' },
        ],
        answer: 'A',
        analysis: '本题考查章节综合应用，需要结合概念与过程分析。',
        scoringPoints: [{ description: '章节综合应用', score: choice.score }],
      });
    }
    const fill = typeByRole.get('fill');
    if (fill) {
      seeds.push({
        questionNo: '',
        stem: `「${chapter.title}」的核心结论是 ______。`,
        answer: '需结合本章概念与典型过程作答。',
        analysis: '按章节核心结论作答。',
        scoringPoints: [{ description: '章节核心结论', score: fill.score }],
      });
    }
    const short = typeByRole.get('short');
    if (short) {
      seeds.push({
        questionNo: '',
        stem: `结合「${chapter.title}」，说明一个典型方法的基本思想与适用条件。`,
        answer: '需说明基本思想、执行过程与适用条件。',
        analysis: '按思想、过程与适用条件分点作答。',
        scoringPoints: splitScore(short.score, 2).map((score, itemIndex) => ({
          description: itemIndex === 0 ? '基本思想' : '适用条件',
          score,
        })),
      });
    }
    const algorithm = typeByRole.get('algorithm');
    if (algorithm) {
      seeds.push({
        questionNo: '',
        stem: `围绕「${chapter.title}」，设计一个分析方案，并说明其时间与空间复杂度。`,
        answer: '需给出建模过程、算法步骤、正确性依据与复杂度结论。',
        analysis: '按建模、步骤、正确性与复杂度组织答案。',
        scoringPoints: splitScore(algorithm.score, 4).map((score, itemIndex) => ({
          description: ['建模与思路', '算法过程', '正确性依据', '复杂度分析'][itemIndex],
          score,
        })),
      });
    }
  });

  return seeds;
};

function buildHistory(template: CourseTemplate, chapterTitles: string[]): TraceL1[] {
  const seeds =
    template.historySeeds && template.historySeeds.length > 0
      ? template.historySeeds
      : genericHistorySeeds(template);
  const count = Math.max(
    template.historyCount ?? Math.max(40, chapterTitles.length * 8),
    seeds.length,
  );

  return Array.from({ length: count }, (_, index) => {
    const seed = seeds[index % seeds.length];
    return {
      questionNo: `H-${String(index + 1).padStart(3, '0')}`,
      stem: seed.stem,
      options: seed.options?.map((option) => ({ ...option })),
      answer: seed.answer,
      analysis: seed.analysis,
      scoringPoints: seed.scoringPoints.map((point) => ({ ...point })),
    };
  });
}

/* ===== 演示候选注入配置 ===== */

interface FlatTask {
  id: string;
  chapter: string;
  type: CourseQuestionType;
  score: number;
}

const flattenTasks = (blueprint: Blueprint, types: CourseQuestionType[]): FlatTask[] => {
  const tasks: FlatTask[] = [];
  const byLabel = new Map(types.map((type) => [type.label, type]));
  let index = 0;
  blueprint.cells.forEach((cell) => {
    const type = byLabel.get(cell.questionType);
    if (!type) return;
    for (let count = 0; count < cell.questionCount; count += 1) {
      index += 1;
      tasks.push({
        id: `T-${String(index).padStart(2, '0')}`,
        chapter: cell.chapter,
        type,
        score: type.score,
      });
    }
  });
  return tasks;
};

const makeBlockedProbe = (
  task: FlatTask,
  conceptName: string,
): CourseBlockedProbe => {
  const role = roleOf(task.type);
  if (role === 'choice') {
    return {
      taskId: task.id,
      stem: `关于「${conceptName}」，下列说法正确的是（ ）。`,
      options: [
        { label: 'A', content: `${conceptName}属于本课程大纲内的基础内容` },
        { label: 'B', content: `${conceptName}只适用于特定实现，不影响分析` },
        { label: 'C', content: `${conceptName}与本章知识点没有关联` },
        { label: 'D', content: `${conceptName}不属于考核范围` },
      ],
      answer: 'A',
      analysis: `考查「${conceptName}」的概念辨析。`,
      scoringPoints: [{ description: '概念辨析', score: task.score }],
    };
  }
  if (role === 'fill') {
    return {
      taskId: task.id,
      stem: `「${conceptName}」的核心要求是 ______。`,
      answer: `需按${conceptName}的定义与过程作答。`,
      analysis: `考查「${conceptName}」的关键结论。`,
      scoringPoints: [{ description: '关键结论', score: task.score }],
    };
  }
  return {
    taskId: task.id,
    stem: `简述「${conceptName}」的基本思想，并分析其适用场景。`,
    answer: `需说明${conceptName}的基本思想、执行过程与适用条件。`,
    analysis: '按基本思想、过程要点与适用条件分点作答。',
    scoringPoints: splitScore(task.score, 3).map((score, index) => ({
      description: ['基本思想', '过程要点', '适用条件'][index],
      score,
    })),
  };
};

function buildDemoProfile(
  template: CourseTemplate,
  blueprint: Blueprint,
  outOfScope: OutOfScopeConcept[],
): CoursePack['demoProfile'] {
  const tasks = flattenTasks(blueprint, template.questionTypes);
  const override = template.demoProfile ?? {};
  const defaultFirstDouble = Math.round((tasks.length * 11) / 26);
  const firstDoubleIndex = clamp(
    override.firstDoubleIndex ?? defaultFirstDouble,
    0,
    tasks.length,
  );
  const bTasks = tasks.slice(firstDoubleIndex);

  const reviewKeys =
    override.reviewKeys && override.reviewKeys.length > 0
      ? [...override.reviewKeys]
      : Array.from({ length: Math.min(9, bTasks.length) }, (_, index) => {
          const position = Math.floor((index * bTasks.length) / Math.min(9, bTasks.length));
          return `${bTasks[Math.min(position, bTasks.length - 1)].id}-B`;
        }).filter((key, index, list) => list.indexOf(key) === index && bTasks.length > 0);

  const resolvableKeys =
    override.resolvableKeys && override.resolvableKeys.length > 0
      ? [...override.resolvableKeys]
      : reviewKeys.slice(0, 3);

  const outOfScopeNames = outOfScope.map((concept) => concept.name);
  let blockedTaskIds = override.blockedTaskIds ? [...override.blockedTaskIds] : [];

  if (blockedTaskIds.length === 0 && outOfScopeNames.length > 0) {
    const candidates = bTasks.filter(
      (task) => !reviewKeys.includes(`${task.id}-B`),
    );
    const preferred = candidates.filter(
      (task) => roleOf(task.type) === 'algorithm' || roleOf(task.type) === 'choice',
    );
    const picked = (preferred.length >= 2 ? preferred : candidates).slice(-2);
    blockedTaskIds = picked.map((task) => task.id);
  }

  const blockedProbes: CourseBlockedProbe[] = [];
  blockedTaskIds.forEach((taskId, index) => {
    const overrideProbe = override.blockedProbes?.find((probe) => probe.taskId === taskId);
    if (overrideProbe) {
      blockedProbes.push(clone(overrideProbe));
      return;
    }
    const task = tasks.find((item) => item.id === taskId);
    const concept = outOfScopeNames[index % Math.max(1, outOfScopeNames.length)];
    if (task && concept) blockedProbes.push(makeBlockedProbe(task, concept));
  });

  const retryTaskId =
    override.retryTaskId ?? tasks[Math.min(12, Math.max(0, tasks.length - 1))]?.id ?? '';

  return {
    firstDoubleIndex,
    reviewKeys,
    resolvableKeys,
    blockedTaskIds,
    retryTaskId,
    blockedProbes,
  };
}

/* ===== 课程包组装 ===== */

export function createCoursePack(rawTemplate: CourseTemplate): CoursePack {
  const template = normalizeTemplate(rawTemplate);
  const outline = buildOutline(template);
  const knowledge = buildKnowledge(template, outline);
  const { blueprint, chapters } = buildBlueprint(template, knowledge);
  const outOfScope = buildOutOfScope(template, knowledge, outline);
  const history = buildHistory(template, outline.chapters.map((chapter) => chapter.title));
  const demoProfile = buildDemoProfile(template, blueprint, outOfScope);

  const contractIdByType: Record<string, string> = {};
  const typeCount = template.questionTypes.length;
  template.questionTypes.forEach((type, index) => {
    contractIdByType[type.label] = `C-${pad2(4 + index)}`;
  });
  const contractIdByDifficulty: Record<string, string> = {
    易: `C-${pad2(4 + typeCount)}`,
    中: `C-${pad2(5 + typeCount)}`,
    难: `C-${pad2(6 + typeCount)}`,
  };

  const totalScore = blueprint.totalScore;
  const weightedExpectedDifficulty =
    totalScore > 0
      ? round2(
          chapters.reduce(
            (sum, chapter) => sum + chapter.targetScore * chapter.expectedDifficulty,
            0,
          ) / totalScore,
        )
      : 0;

  const counts: CourseCounts = {
    chapters: chapters.length,
    totalHours: chapters.reduce((sum, chapter) => sum + chapter.hours, 0),
    establishedKnowledgePoints: knowledge.length,
    candidateKnowledgePoints: outline.candidates.length,
    outOfScopeConcepts: outOfScope.length,
    historyQuestions: history.length,
    questionCount: blueprint.questionCount,
    totalScore,
    durationMinutes: blueprint.durationMinutes,
    byType: Object.fromEntries(
      template.questionTypes.map((type) => [type.label, type.targetCount]),
    ),
    weightedExpectedDifficulty,
  };

  const suggestionByType: Record<string, string> = {};
  template.questionTypes.forEach((type, index) => {
    const others = template.questionTypes.filter((_, itemIndex) => itemIndex !== index);
    const short = others.find((item) => roleOf(item) === 'short');
    const fill = others.find((item) => roleOf(item) === 'fill');
    suggestionByType[type.label] = (short ?? fill ?? others[0])?.label ?? '其他题型';
  });

  return {
    template,
    paperId: `PC-${template.id.split('-')[0] || 'COURSE'}-MID-001`,
    outline,
    chapters,
    questionTypes: template.questionTypes,
    blueprint,
    knowledge,
    history,
    outOfScope,
    counts,
    demoProfile,
    contractIdByType,
    contractIdByDifficulty,
    difficultyBands: clone(template.difficultyPlan.bands) as DifficultyBand[],
    suggestionByType,
  };
}

export const typeByLabel = (
  pack: Pick<CoursePack, 'questionTypes'>,
  label: string,
): CourseQuestionType | undefined => pack.questionTypes.find((type) => type.label === label);

export const roleOfType = (
  pack: Pick<CoursePack, 'questionTypes'>,
  label: string,
): QuestionTypeRole => roleOf(typeByLabel(pack, label) ?? pack.questionTypes[0]) ?? 'other';

export const minutesOfType = (
  pack: Pick<CoursePack, 'questionTypes'>,
  label: string,
): number => typeByLabel(pack, label)?.minutes ?? 0;
