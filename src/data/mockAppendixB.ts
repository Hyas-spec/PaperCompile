import type {
  Blueprint,
  CognitiveLevel,
  DifficultyBand,
  KnowledgePoint,
  QuestionType,
  Syllabus,
  TraceL1,
} from '../types';
import { COURSE_PACK } from '../courses/active';
import type { CourseQuestionType } from '../courses/types';

/* ===== 当前课程口径（内置《数据结构》仍对齐附录 B） ===== */

export const DEMO_EXAM = {
  course: COURSE_PACK.template.name,
  examName: COURSE_PACK.template.examName,
  assessmentMethod: COURSE_PACK.template.assessmentMethod,
  closedBook: true,
  durationMinutes: COURSE_PACK.counts.durationMinutes,
  totalScore: COURSE_PACK.counts.totalScore,
  questionCount: COURSE_PACK.counts.questionCount,
} as const;

export interface BlueprintTableRow {
  chapter: string;
  hours: number;
  knowledgePoints: number;
  counts: Record<string, number>;
  choice: number;
  fill: number;
  short: number;
  algorithm: number;
  score: number;
  expectedDifficulty: number;
}

const countOfRole = (chapter: (typeof COURSE_PACK.chapters)[number], role: string): number =>
  COURSE_PACK.questionTypes
    .filter((type) => type.role === role)
    .reduce((sum, type) => sum + (chapter.targetCounts[type.key] ?? 0), 0);

const rows: BlueprintTableRow[] = COURSE_PACK.chapters.map((chapter) => ({
  chapter: chapter.title,
  hours: chapter.hours,
  knowledgePoints: chapter.knowledgePoints,
  counts: { ...chapter.targetCounts },
  choice: countOfRole(chapter, 'choice'),
  fill: countOfRole(chapter, 'fill'),
  short: countOfRole(chapter, 'short'),
  algorithm: countOfRole(chapter, 'algorithm'),
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
const weightedExpectedDifficulty = COURSE_PACK.counts.weightedExpectedDifficulty;

/** 表 B-1：按章节的题型与分值分配。 */
export const DEMO_BLUEPRINT_TABLE: BlueprintTableRow[] = [
  ...rows,
  {
    chapter: '合计',
    hours: totalHours,
    knowledgePoints: totalKnowledgePoints,
    counts: Object.fromEntries(
      COURSE_PACK.questionTypes.map((type) => [type.key, type.targetCount]),
    ),
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

export const DEMO_QUESTION_TYPE_STRUCTURE: QuestionTypeStructure[] =
  COURSE_PACK.questionTypes.map((definition: CourseQuestionType) => ({
    type: definition.label,
    count: definition.targetCount,
    scorePer: definition.score,
    totalScore: definition.targetCount * definition.score,
    minutes: definition.minutes,
    cognitiveLevel: definition.cognitiveLevel,
  }));

export const DEMO_DIFFICULTY_BANDS: DifficultyBand[] = COURSE_PACK.difficultyBands;

export const DEMO_DIFFICULTY_TARGET = {
  bands: DEMO_DIFFICULTY_BANDS,
  weightedExpectedDifficulty,
  blueprintExpected: COURSE_PACK.template.difficultyPlan.expected,
  blueprintTolerance: COURSE_PACK.template.difficultyPlan.tolerance,
} as const;

/** 当前课程的确立知识点（《数据结构》为附录 B 的 42 个）。 */
export const DEMO_ESTABLISHED_KNOWLEDGE_POINTS: KnowledgePoint[] = COURSE_PACK.knowledge;

/** 当前课程的大纲候选知识点（《数据结构》为 47 个）。 */
export const DEMO_CANDIDATE_KNOWLEDGE_POINTS = COURSE_PACK.outline.candidates.map(
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
    outOfScope: COURSE_PACK.knowledge.some(
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

export const DEMO_OUT_OF_SCOPE_CONCEPTS: OutOfScopeConcept[] = COURSE_PACK.outOfScope;

export const DEMO_BLUEPRINT: Blueprint = COURSE_PACK.blueprint;
export const DEMO_HISTORY_BANK: TraceL1[] = COURSE_PACK.history;

export interface DemoSyllabus extends Syllabus {
  fileName: string;
  pageCount: number;
}

export const DEMO_SYLLABUS: DemoSyllabus = {
  id: `syllabus-${COURSE_PACK.template.id}`,
  course: `《${COURSE_PACK.template.name}》`,
  format: COURSE_PACK.template.format,
  chapters: COURSE_PACK.outline.chapters.map((chapter) => ({
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
  assessmentMethod: COURSE_PACK.template.assessmentMethod,
  references: [...COURSE_PACK.template.references],
  fileName: COURSE_PACK.outline.fileName,
  pageCount: COURSE_PACK.outline.pageCount,
};

export const APPENDIX_B_COUNTS = {
  chapters: rows.length,
  totalHours,
  establishedKnowledgePoints: DEMO_ESTABLISHED_KNOWLEDGE_POINTS.length,
  candidateKnowledgePoints: DEMO_CANDIDATE_KNOWLEDGE_POINTS.length,
  outOfScopeConcepts: DEMO_OUT_OF_SCOPE_CONCEPTS.length,
  historyQuestions: DEMO_HISTORY_BANK.length,
  questionCount: COURSE_PACK.counts.questionCount,
  totalScore,
  durationMinutes: DEMO_EXAM.durationMinutes,
  choice: totalChoice,
  fill: totalFill,
  short: totalShort,
  algorithm: totalAlgorithm,
  difficultyBands: Object.fromEntries(
    DEMO_DIFFICULTY_BANDS.map((band) => [band.level, band.scoreRatio]),
  ),
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
