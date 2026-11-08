import type {
  Blueprint,
  CognitiveLevel,
  Contract,
  ContractItem,
  KnowledgePoint,
  QuestionType,
  Syllabus,
  TraceL1,
} from '../types';
import type { CourseChapterRuntime, QuestionTypeRole } from '../courses/types';
import { COURSE_PACK } from '../courses/active';
import { contractFromRows, DEFAULT_ROWS } from './contractData';

/* ===== 当前课程的题型与章节口径 ===== */

export interface TypeDef {
  key: string;
  label: QuestionType;
  short: string;
  score: number;
  cognitiveLevel: CognitiveLevel;
  role: QuestionTypeRole;
  minutes: number;
  targetCount: number;
  band: number;
}

export const QUESTION_TYPE_DEFS: TypeDef[] = COURSE_PACK.questionTypes.map((type) => ({
  key: type.key,
  label: type.label,
  short: type.short,
  score: type.score,
  cognitiveLevel: type.cognitiveLevel,
  role: type.role,
  minutes: type.minutes,
  targetCount: type.targetCount,
  band: type.band,
}));

export type ChapterDef = CourseChapterRuntime;

export const CHAPTER_DEFS: ChapterDef[] = COURSE_PACK.chapters;

export const MOCK_BLUEPRINT: Blueprint = COURSE_PACK.blueprint;

export const MOCK_SYLLABUS: Syllabus = {
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
};

export const MOCK_KNOWLEDGE: KnowledgePoint[] = COURSE_PACK.knowledge;
export const MOCK_HISTORY: TraceL1[] = COURSE_PACK.history;

export const PROPOSITION_OVERVIEW = {
  blueprintVersion: MOCK_BLUEPRINT.version,
  questionCount: MOCK_BLUEPRINT.questionCount,
  totalScore: MOCK_BLUEPRINT.totalScore,
  durationMinutes: MOCK_BLUEPRINT.durationMinutes,
  contractItems: contractFromRows(DEFAULT_ROWS).items.length,
  knowledgePoints: MOCK_KNOWLEDGE.length,
  historyCount: MOCK_HISTORY.length,
  chapterCount: CHAPTER_DEFS.length,
  typeCount: QUESTION_TYPE_DEFS.length,
};

const REQUIREMENT_BY_ID = new Map(
  COURSE_PACK.outline.candidates.map((candidate) => [candidate.id, candidate.requirement]),
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

export const roleOfType = (label: QuestionType): QuestionTypeRole =>
  QUESTION_TYPE_DEFS.find((type) => type.label === label)?.role ?? 'other';

export const minutesOfType = (label: QuestionType): number =>
  QUESTION_TYPE_DEFS.find((type) => type.label === label)?.minutes ?? 0;

export const contractIdOfType = (label: QuestionType): string =>
  COURSE_PACK.contractIdByType[label] ??
  COURSE_PACK.contractIdByType[QUESTION_TYPE_DEFS[0]?.label ?? ''] ??
  'C-04';

export const contractIdOfDifficulty = (level: string): string =>
  COURSE_PACK.contractIdByDifficulty[level] ??
  COURSE_PACK.contractIdByDifficulty['易'] ??
  'C-11';

const CONTRACT_TYPE_COUNT = COURSE_PACK.questionTypes.length;
export const CONTRACT_COVERAGE_ID = `C-${String(4 + CONTRACT_TYPE_COUNT).padStart(2, '0')}`;
export const CONTRACT_CHAPTER_ID = `C-${String(5 + CONTRACT_TYPE_COUNT).padStart(2, '0')}`;
export const CONTRACT_EXPECTED_ID = `C-${String(6 + CONTRACT_TYPE_COUNT).padStart(2, '0')}`;

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
    contract && contract.items.length > 0 ? contract : contractFromRows(DEFAULT_ROWS);
  const knowledgeBase =
    knowledgePoints && knowledgePoints.length > 0 ? knowledgePoints : MOCK_KNOWLEDGE;

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
