import type {
  CognitiveLevel,
  CoverageTarget,
  DifficultyBand,
  DifficultyPlan,
  QuestionOption,
  QuestionType,
  ScoringPoint,
  SyllabusFormat,
  TraceL1,
} from '../types';

/**
 * 题型角色。课程的题型名称、分值与题量都可以自定义，但每个题型必须声明
 * 一个角色，供命题 Agent、七道闸门与组卷器选择通用的生成 / 校验模板。
 */
export type QuestionTypeRole = 'choice' | 'fill' | 'short' | 'algorithm' | 'other';

export interface CourseQuestionType {
  /** 稳定键，用于蓝图矩阵与章节题型配比 */
  key: string;
  label: QuestionType;
  short: string;
  role: QuestionTypeRole;
  /** 每题分值 */
  score: number;
  /** 建议用时（分钟） */
  minutes: number;
  cognitiveLevel: CognitiveLevel;
  /** 蓝图目标题量 */
  targetCount: number;
  /** 题型分值占比允许带宽（百分点） */
  band: number;
}

export interface CourseParagraphSeed {
  label?: string;
  text: string;
}

export interface CourseKnowledgePointSeed {
  id: string;
  name: string;
  chapter: string;
  requirement: string;
  cognitiveLevel: CognitiveLevel;
  weight?: number;
  outOfScope?: boolean;
  prerequisites?: string[];
  /** 大纲段落序号，0 起；缺省时自动分配 */
  paragraph?: number;
}

export interface CourseChapterSeed {
  title: string;
  hours: number;
  /** 章节知识点数量；缺省时按 points.length 计算 */
  knowledgePoints?: number;
  expectedDifficulty?: number;
  /** 题型 key → 题量 */
  counts: Record<string, number>;
  /** 大纲章节原文段落 */
  paragraphs: string[];
  /** 该章仅有章节名、未提取到具体要求的空大纲条目 */
  empty?: boolean;
  /** 该章知识点（用于生成大纲候选与知识点基线） */
  points?: Array<{
    name: string;
    requirement: string;
    paragraph?: number;
    cognitiveLevel?: CognitiveLevel;
    weight?: number;
    outOfScope?: boolean;
  }>;
}

export interface CourseHistorySeed {
  stem: string;
  options?: QuestionOption[];
  answer: string;
  analysis: string;
  scoringPoints: ScoringPoint[];
  /** 该历史题对应的题型标签，用于按课程题型过滤 */
  type?: QuestionType;
  chapter?: string;
}

export interface CourseBlockedProbe {
  /** 任务 ID，例如 T-14 */
  taskId: string;
  stem: string;
  options?: QuestionOption[];
  answer: string;
  analysis: string;
  scoringPoints?: ScoringPoint[];
}

export interface CourseDemoProfile {
  /** 从第几个任务开始生成 A/B 两个候选（0 起） */
  firstDoubleIndex?: number;
  /** 需要在审题阶段给出疑点的候选键，例如 T-12-B */
  reviewKeys?: string[];
  /** 仲裁可裁决的候选键 */
  resolvableKeys?: string[];
  /** 被超纲闸门拦截的任务 ID */
  blockedTaskIds?: string[];
  /** 需要展示 schema 重试的任务 ID */
  retryTaskId?: string;
  /** 被拦截候选的自定义题目内容；缺省时按超纲禁区自动生成 */
  blockedProbes?: CourseBlockedProbe[];
}

export interface CourseTemplate {
  id: string;
  name: string;
  examName: string;
  description: string;
  /** 是否为内置演示模板 */
  builtin: boolean;
  createdAt?: string;

  /* 大纲 */
  format: SyllabusFormat;
  fileName: string;
  pageCount: number;
  assessmentMethod: string;
  references: string[];
  chapters: CourseChapterSeed[];

  /* 考核结构 */
  totalScore: number;
  durationMinutes: number;
  questionTypes: CourseQuestionType[];
  difficultyPlan: DifficultyPlan;
  coverageTarget: CoverageTarget;
  /** 三维配比允许带宽（百分点） */
  ratioBand: number;
  /** 契约依据来源标签，例如“表 2-2” */
  sourceLabel: string;

  /* 知识点与题库 */
  knowledge?: CourseKnowledgePointSeed[];
  historySeeds?: CourseHistorySeed[];
  historyCount?: number;
  /** 额外超纲禁区（不在知识点库中的概念） */
  extraOutOfScope?: Array<{ id: string; name: string; chapter: string }>;
  /**
   * 是否把额外超纲禁区登记为知识点库中的超纲知识点。
   * 内置《数据结构》保持附录 B 的 42 个确立知识点，故为 false；
   * 其他课程默认 true，使超纲闸门有可回查的知识点登记。
   */
  extraOutOfScopeAsKnowledge?: boolean;
  /** 演示用候选注入配置；缺省时由课程包按比例生成 */
  demoProfile?: CourseDemoProfile;
}

/* ===== 课程包：课程模板在运行时展开后的只读数据 ===== */

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

export interface CourseChapterRuntime {
  id: string;
  no: number;
  title: string;
  hours: number;
  knowledgePoints: number;
  expectedDifficulty: number;
  targetScore: number;
  targetCounts: Record<string, number>;
  cognitiveMix: number[];
}

export interface OutOfScopeConcept {
  id: string;
  name: string;
  chapter: string;
  anchor: string;
  excerpt: string;
  inEstablishedSet: boolean;
}

export interface CourseCounts {
  chapters: number;
  totalHours: number;
  establishedKnowledgePoints: number;
  candidateKnowledgePoints: number;
  outOfScopeConcepts: number;
  historyQuestions: number;
  questionCount: number;
  totalScore: number;
  durationMinutes: number;
  byType: Record<string, number>;
  weightedExpectedDifficulty: number;
}

export interface CoursePack {
  template: CourseTemplate;
  paperId: string;
  outline: ParsedOutline;
  chapters: CourseChapterRuntime[];
  questionTypes: CourseQuestionType[];
  blueprint: import('../types').Blueprint;
  knowledge: import('../types').KnowledgePoint[];
  history: TraceL1[];
  outOfScope: OutOfScopeConcept[];
  counts: CourseCounts;
  demoProfile: Required<Pick<CourseDemoProfile, 'firstDoubleIndex' | 'reviewKeys' | 'resolvableKeys' | 'blockedTaskIds' | 'retryTaskId'>> & {
    blockedProbes: CourseBlockedProbe[];
  };
  /** 题型 → 契约项 ID，例如 单项选择题 → C-04 */
  contractIdByType: Record<string, string>;
  /** 难度档位 → 契约项 ID */
  contractIdByDifficulty: Record<string, string>;
  difficultyBands: DifficultyBand[];
  suggestionByType: Record<string, string>;
}
