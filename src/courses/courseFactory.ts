import type { CognitiveLevel } from '../types';
import type {
  CourseChapterSeed,
  CourseKnowledgePointSeed,
  CourseQuestionType,
  CourseTemplate,
} from './types';
import { COGNITIVE_LEVELS, distributeByWeight } from './coursePack';

export interface NewCourseChapterInput {
  title: string;
  hours: number;
}

export interface NewCourseTypeInput {
  label: string;
  score: number;
  count: number;
}

export interface NewCourseInput {
  name: string;
  examName: string;
  description: string;
  chapters: NewCourseChapterInput[];
  types: NewCourseTypeInput[];
  knowledgeText: string;
  outOfScopeText: string;
  durationMinutes: number;
  coverageRate: number;
  ratioBand: number;
  easyRatio: number;
  mediumRatio: number;
  hardRatio: number;
}

const ROLE_BY_INDEX = ['choice', 'fill', 'short', 'algorithm'] as const;
const COGNITIVE_BY_INDEX: CognitiveLevel[] = ['理解', '记忆', '应用', '分析'];
const SHORT_BY_INDEX = ['单选', '填空', '简答', '综合'];

const pad2 = (value: number): string => String(value).padStart(2, '0');

const safeInt = (value: number, fallback: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;

const splitLine = (line: string): string[] =>
  line
    .split(/\s*[|｜\t]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

const cognitiveOf = (value: string | undefined): CognitiveLevel =>
  COGNITIVE_LEVELS.includes(value as CognitiveLevel)
    ? (value as CognitiveLevel)
    : '理解';

const normalizeRatios = (
  easy: number,
  medium: number,
  hard: number,
): [number, number, number] => {
  const values = [easy, medium, hard].map((value) =>
    Number.isFinite(value) ? Math.max(0, value) : 0,
  );
  const sum = values.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return [30, 50, 20];
  if (Math.abs(sum - 100) < 0.001) return [values[0], values[1], values[2]];
  const scaled = values.map((value) => Math.round((value / sum) * 100));
  const delta = 100 - scaled.reduce((acc, value) => acc + value, 0);
  scaled[0] += delta;
  return [scaled[0], scaled[1], scaled[2]];
};

export function buildCustomTemplate(input: NewCourseInput): CourseTemplate {
  const name = input.name.trim() || '新课程';
  const examName = input.examName.trim() || '期末考试';
  const chapters = input.chapters
    .map((chapter) => ({
      title: chapter.title.trim(),
      hours: Math.max(1, safeInt(chapter.hours, 4)),
    }))
    .filter((chapter) => chapter.title.length > 0);

  if (chapters.length === 0) {
    chapters.push({ title: '第一章', hours: 8 });
  }

  const chapterIndexByTitle = new Map(
    chapters.map((chapter, index) => [chapter.title, index]),
  );

  const types: NewCourseTypeInput[] = input.types
    .map((type, index) => ({
      label: type.label.trim() || `题型 ${index + 1}`,
      score: Math.max(1, safeInt(type.score, 2)),
      count: Math.max(0, safeInt(type.count, 0)),
    }))
    .slice(0, 4);

  if (types.length === 0) types.push({ label: '单项选择题', score: 2, count: 10 });

  const hours = chapters.map((chapter) => chapter.hours);
  const chapterSeeds: CourseChapterSeed[] = chapters.map((chapter) => ({
    title: chapter.title,
    hours: chapter.hours,
    counts: {},
    paragraphs: [],
  }));

  types.forEach((type, typeIndex) => {
    const distributed = distributeByWeight(type.count, hours);
    chapterSeeds.forEach((chapter, index) => {
      chapter.counts[`${ROLE_BY_INDEX[typeIndex] ?? 'other'}-${typeIndex}`] = distributed[index];
    });
  });

  // 章节知识点：按“章节 | 知识点 | 认知层次”解析；缺省时为每章生成两个基线知识点。
  const pointSeeds: CourseKnowledgePointSeed[] = [];
  const counters = new Map<number, number>();
  const nextId = (chapterIndex: number): string => {
    const next = (counters.get(chapterIndex) ?? 0) + 1;
    counters.set(chapterIndex, next);
    return `ch-${pad2(chapterIndex + 1)}-kp-${pad2(next)}`;
  };

  const rawLines = input.knowledgeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (rawLines.length === 0) {
    chapters.forEach((chapter, chapterIndex) => {
      pointSeeds.push({
        id: nextId(chapterIndex),
        name: `${chapter.title}核心概念`,
        chapter: chapter.title,
        requirement: `掌握${chapter.title}的核心概念与基本方法。`,
        cognitiveLevel: '记忆',
        weight: 60,
        paragraph: 2,
      });
      pointSeeds.push({
        id: nextId(chapterIndex),
        name: `${chapter.title}综合应用`,
        chapter: chapter.title,
        requirement: `能运用${chapter.title}的方法分析并解决典型问题。`,
        cognitiveLevel: '应用',
        weight: 60,
        paragraph: 2,
      });
    });
  } else {
    rawLines.forEach((line) => {
      const parts = splitLine(line);
      let chapterIndex = 0;
      let pointName = parts[0] ?? '';
      let cognitive: CognitiveLevel = '理解';
      let requirement = '';

      if (parts.length >= 2) {
        const mapped = chapterIndexByTitle.get(parts[0]);
        if (mapped !== undefined) {
          chapterIndex = mapped;
          pointName = parts[1] ?? '';
          cognitive = cognitiveOf(parts[2]);
          requirement = parts[3] ?? '';
        } else {
          pointName = parts[0] ?? '';
          cognitive = cognitiveOf(parts[1]);
          requirement = parts[2] ?? '';
        }
      }

      if (!pointName) return;
      pointSeeds.push({
        id: nextId(chapterIndex),
        name: pointName,
        chapter: chapters[chapterIndex].title,
        requirement: requirement || `掌握「${pointName}」的基本概念、方法与典型应用。`,
        cognitiveLevel: cognitive,
        weight: 60,
        paragraph: 2,
      });
    });
  }

  // 有题量的章节必须有可审定知识点；缺失章节自动补两个基线知识点。
  chapters.forEach((chapter, chapterIndex) => {
    if (pointSeeds.some((seed) => seed.chapter === chapter.title)) return;
    pointSeeds.push(
      {
        id: nextId(chapterIndex),
        name: `${chapter.title}核心概念`,
        chapter: chapter.title,
        requirement: `掌握${chapter.title}的核心概念与基本方法。`,
        cognitiveLevel: '记忆',
        weight: 60,
        paragraph: 2,
      },
      {
        id: nextId(chapterIndex),
        name: `${chapter.title}方法与应用`,
        chapter: chapter.title,
        requirement: `能运用${chapter.title}的方法分析并解决典型问题。`,
        cognitiveLevel: '应用',
        weight: 60,
        paragraph: 2,
      },
    );
  });

  // 超纲禁区：按“章节 | 概念”登记为知识点库中的超纲知识点。
  const outOfScope: Array<{ id: string; name: string; chapter: string }> = [];
  input.outOfScopeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .forEach((line, index) => {
      const parts = splitLine(line);
      const mapped = parts.length > 1 ? chapterIndexByTitle.get(parts[0]) : undefined;
      const chapterIndex = mapped ?? chapters.length - 1;
      const conceptName = (mapped !== undefined ? parts[1] : parts[0])?.trim();
      if (!conceptName) return;
      outOfScope.push({
        id: `CO-X-${pad2(index + 1)}`,
        name: conceptName,
        chapter: chapters[chapterIndex].title,
      });
    });

  if (outOfScope.length === 0) {
    // 保留两个示例超纲概念，确保新课程也能演示超纲闸门。
    outOfScope.push(
      {
        id: 'CO-X-01',
        name: `${chapters[chapters.length - 1].title}前沿专题`,
        chapter: chapters[chapters.length - 1].title,
      },
      {
        id: 'CO-X-02',
        name: `${chapters[0].title}拓展方法`,
        chapter: chapters[0].title,
      },
    );
  }

  const knowledgePointsByChapter = new Map<string, number>();
  pointSeeds.forEach((seed) => {
    knowledgePointsByChapter.set(
      seed.chapter,
      (knowledgePointsByChapter.get(seed.chapter) ?? 0) + 1,
    );
  });
  outOfScope.forEach((concept) => {
    knowledgePointsByChapter.set(
      concept.chapter,
      (knowledgePointsByChapter.get(concept.chapter) ?? 0) + 1,
    );
  });

  // 把知识点回填到章节，保证大纲候选与知识点库使用同一批 id，避免占位候选重复。
  chapterSeeds.forEach((chapter) => {
    chapter.points = pointSeeds
      .filter((seed) => seed.chapter === chapter.title)
      .map((seed) => ({
        name: seed.name,
        requirement: seed.requirement,
        paragraph: seed.paragraph,
        cognitiveLevel: seed.cognitiveLevel,
        weight: seed.weight,
        outOfScope: seed.outOfScope,
      }));
  });

  const questionTypes: CourseQuestionType[] = types.map((type, index) => ({
    key: `${ROLE_BY_INDEX[index] ?? 'other'}-${index}`,
    label: type.label,
    short: SHORT_BY_INDEX[index] ?? `题型${index + 1}`,
    role: ROLE_BY_INDEX[index] ?? 'other',
    score: type.score,
    minutes: 0,
    cognitiveLevel: COGNITIVE_BY_INDEX[index] ?? '理解',
    targetCount: type.count,
    band: 3,
  }));

  const totalScore = types.reduce((sum, type) => sum + type.score * type.count, 0) || 100;
  const durationMinutes = Math.max(30, safeInt(input.durationMinutes, 120));
  const [easy, medium, hard] = normalizeRatios(
    input.easyRatio,
    input.mediumRatio,
    input.hardRatio,
  );

  const template: CourseTemplate = {
    id: `CUSTOM-${Date.now().toString(36).toUpperCase()}`,
    name,
    examName,
    description:
      input.description.trim() ||
      `自定义课程：${chapters.length} 章 / ${chapters.reduce(
        (sum, chapter) => sum + chapter.hours,
        0,
      )} 学时 / ${types.reduce((sum, type) => sum + type.count, 0)} 题。`,
    builtin: false,
    createdAt: new Date().toISOString(),
    format: 'markdown',
    fileName: `${name}-教学大纲.md`,
    pageCount: 4,
    assessmentMethod: `${examName}，闭卷，${durationMinutes} 分钟，满分 ${totalScore} 分`,
    references: ['课程组自编知识点库'],
    chapters: chapterSeeds.map((chapter) => ({
      ...chapter,
      knowledgePoints: knowledgePointsByChapter.get(chapter.title) ?? 1,
    })),
    totalScore,
    durationMinutes,
    questionTypes,
    difficultyPlan: {
      bands: [
        { level: '易', min: 0.8, max: 1, scoreRatio: easy },
        { level: '中', min: 0.6, max: 0.8, scoreRatio: medium },
        { level: '难', min: 0, max: 0.6, scoreRatio: hard },
      ],
      expected: 0.65,
      tolerance: 0.05,
    },
    coverageTarget: {
      minRate: Math.min(100, Math.max(50, safeInt(input.coverageRate, 90))),
      minPerChapter: 1,
    },
    ratioBand: Math.max(1, safeInt(input.ratioBand, 3)),
    sourceLabel: '课程模板',
    knowledge: pointSeeds,
    historyCount: 40,
    extraOutOfScope: outOfScope,
    extraOutOfScopeAsKnowledge: true,
  };

  return template;
}
