import type {
  ArbitrationAgentInput,
  ArbitrationAgentOutput,
  BlueprintCell,
  CandidateQuestion,
  ComposeAgentInput,
  ComposeAgentOutput,
  DifficultyLevel,
  KnowledgePoint,
  PlanningAgentInput,
  PlanningAgentOutput,
  PropositionAgentInput,
  PropositionAgentOutput,
  PropositionTask,
  QuestionOption,
  QuestionType,
  ReviewAgentInput,
  ReviewAgentOutput,
  TraceL1,
  ValidationAgentOutput,
} from '../types';
import {
  CHAPTER_ORDER,
  CONTRACT_CHAPTER_ID,
  CONTRACT_COVERAGE_ID,
  CONTRACT_EXPECTED_ID,
  TYPE_ORDER,
  cognitiveOfType,
  contractIdOfDifficulty,
  contractIdOfType,
  expectedDifficultyOfCell,
  requirementOfPoint,
  roleOfType,
  scoreOfType,
} from '../pages/propositionData';
import { COURSE_PACK } from '../courses/active';
import { splitScore } from '../courses/coursePack';
import { runValidator, type ValidatorInput } from './validator';

/* ===== 规划 Agent ===== */

export interface MockPlanningInput extends PlanningAgentInput {
  knowledgeBase: KnowledgePoint[];
}

const difficultyOfCell = (
  cell: BlueprintCell,
  hardAlgorithmChapter: string | undefined,
): DifficultyLevel => {
  const role = roleOfType(cell.questionType);
  if (role === 'choice') return '易';
  if (role === 'algorithm') {
    return cell.chapter === hardAlgorithmChapter ? '难' : '中';
  }
  return '中';
};

export function planAgent(input: MockPlanningInput): PlanningAgentOutput {
  const algorithmCells = input.blueprint.cells.filter(
    (cell) => roleOfType(cell.questionType) === 'algorithm',
  );
  const hardAlgorithmChapter = algorithmCells.reduce<BlueprintCell | null>(
    (lowest, cell) =>
      !lowest || cell.difficulty < lowest.difficulty ? cell : lowest,
    null,
  )?.chapter;

  const tasks: PropositionTask[] = [];
  const chapterCursor = new Map<string, number>();
  let taskNo = 0;

  for (const cell of input.blueprint.cells) {
    const available = input.knowledgeBase.filter(
      (point) => point.chapter === cell.chapter && !point.outOfScope,
    );
    // 若某章只有超纲禁区知识点，仍生成候选交给超纲闸门拦截，避免整批任务失败。
    const points =
      available.length > 0
        ? available
        : input.knowledgeBase.filter((point) => point.chapter === cell.chapter);
    if (points.length === 0) {
      throw new Error(`章节「${cell.chapter}」缺少可用知识点，无法拆分任务单`);
    }

    for (let index = 0; index < cell.questionCount; index += 1) {
      taskNo += 1;
      const cursor = chapterCursor.get(cell.chapter) ?? 0;
      const point = points[cursor % points.length];
      chapterCursor.set(cell.chapter, cursor + 1);
      const difficulty = difficultyOfCell(cell, hardAlgorithmChapter);

      tasks.push({
        id: `T-${String(taskNo).padStart(2, '0')}`,
        chapter: cell.chapter,
        questionType: cell.questionType,
        difficulty,
        context: {
          knowledgePointIds: [point.id],
          contractItemIds: [
            contractIdOfType(cell.questionType),
            contractIdOfDifficulty(difficulty),
            CONTRACT_COVERAGE_ID,
            CONTRACT_CHAPTER_ID,
            CONTRACT_EXPECTED_ID,
          ],
        },
      });
    }
  }

  return { tasks };
}

/* ===== 命题 Agent ===== */

export interface MockPropositionInput extends PropositionAgentInput {
  variant: 'A' | 'B';
  attempt: number;
  round: number;
  knowledgeBase: KnowledgePoint[];
}

const difficultyCoefficient = (level: DifficultyLevel): number => {
  if (level === '易') return 0.85;
  if (level === '难') return 0.5;
  return 0.65;
};

const commonErrorsOf = (type: QuestionType): string => {
  const role = roleOfType(type);
  if (role === 'choice') return '易把相近概念的条件与适用范围混淆。';
  if (role === 'fill') return '易漏写关键条件，或把结论写成近似表述。';
  if (role === 'short') return '只给结论，缺少推导过程与适用条件。';
  if (role === 'algorithm') return '只写步骤，未说明建模过程、正确性依据与复杂度。';
  return '作答结构不完整，缺少关键条件与依据。';
};

const choiceOptions = (
  point: KnowledgePoint,
  variant: 'A' | 'B',
): { options: QuestionOption[]; answer: string } => {
  const correct =
    requirementOfPoint(point) || `${point.name}属于本章要求掌握的内容。`;
  const distractors = [
    `「${point.name}」只适用于某一种特定场景，不能推广。`,
    `「${point.name}」与本章其他知识点没有关联。`,
    `「${point.name}」不属于本课程考核范围。`,
  ];
  if (variant === 'B') {
    return {
      options: [
        { label: 'A', content: distractors[0] },
        { label: 'B', content: correct },
        { label: 'C', content: distractors[1] },
        { label: 'D', content: distractors[2] },
      ],
      answer: 'B',
    };
  }
  return {
    options: [
      { label: 'A', content: correct },
      { label: 'B', content: distractors[0] },
      { label: 'C', content: distractors[1] },
      { label: 'D', content: distractors[2] },
    ],
    answer: 'A',
  };
};

const algorithmStem = (
  point: KnowledgePoint,
  _chapter: string,
  variant: 'A' | 'B',
): string => {
  return variant === 'B'
    ? `以「${point.name}」为背景，设计一个求解方案，完成：（1）说明建模过程；（2）写出关键步骤或伪代码；（3）分析最坏与平均时间复杂度。`
    : `以「${point.name}」为背景，设计一个求解方案，完成：（1）描述基本思路；（2）写出关键步骤或伪代码；（3）分析时间复杂度。`;
};

export function propositionAgent(
  input: MockPropositionInput,
): PropositionAgentOutput {
  const { task, variant, round } = input;
  const point =
    input.knowledgeBase.find(
      (candidate) => candidate.id === task.context.knowledgePointIds[0],
    ) ?? input.knowledgeBase[0];
  if (!point) throw new Error('命题上下文缺少知识点');

  const key = `${task.id}-${variant}${round > 1 ? `-r${round}` : ''}`;
  const role = roleOfType(task.questionType);
  const score = scoreOfType(task.questionType);
  const profile = COURSE_PACK.demoProfile;
  const probe =
    round === 1 && variant === 'B'
      ? profile.blockedProbes.find((item) => item.taskId === task.id)
      : undefined;

  let stem = '';
  let options: QuestionOption[] | undefined;
  let answer = '';
  let analysis = '';
  let scoringPoints = [{ description: '答案要点', score }];

  if (probe) {
    stem = probe.stem;
    options = probe.options?.map((option) => ({ ...option }));
    answer = probe.answer;
    analysis = probe.analysis;
    scoringPoints =
      probe.scoringPoints && probe.scoringPoints.length > 0
        ? probe.scoringPoints.map((point) => ({ ...point }))
        : [{ description: '超纲概念辨析', score }];
  } else if (role === 'choice') {
    stem =
      variant === 'B'
        ? `关于「${point.name}」的下列说法中，正确的是（ ）。`
        : `关于「${point.name}」，下列说法正确的是（ ）。`;
    const choice = choiceOptions(point, variant);
    options = choice.options;
    answer = choice.answer;
    analysis = `本题考查「${point.name}」。正确项对应大纲要求：${requirementOfPoint(point)}`;
    scoringPoints = [{ description: '概念辨析', score }];
  } else if (role === 'fill') {
    stem = `「${point.name}」的核心要求是 ______。`;
    answer = requirementOfPoint(point);
    analysis = `按「${point.name}」在大纲中的考核要求作答。`;
    scoringPoints = [{ description: '关键定义与结论', score }];
  } else if (role === 'short') {
    stem = `简述「${point.name}」的基本思想，并说明其适用场景。`;
    answer = `${requirementOfPoint(point)}适用场景需结合本章知识结构说明。`;
    analysis = '按基本思想、过程要点与适用场景分点作答。';
    scoringPoints = splitScore(score, 3).map((part, index) => ({
      description: ['基本思想', '适用场景', '表达完整'][index],
      score: part,
    }));
  } else if (role === 'algorithm') {
    stem = algorithmStem(point, task.chapter, variant);
    answer = `围绕「${point.name}」建立模型，按步骤执行并做复杂度分析；需给出正确性依据与最坏情况结论。`;
    analysis = '按建模、算法过程、正确性依据与复杂度四个评分点组织答案。';
    scoringPoints = splitScore(score, 4).map((part, index) => ({
      description: ['建模与思路', '算法过程', '正确性依据', '复杂度分析'][index],
      score: part,
    }));
  } else {
    stem = `结合「${point.name}」，说明其基本思想与适用条件。`;
    answer = `${requirementOfPoint(point)}需说明适用条件与限制。`;
    analysis = '按基本思想、适用条件与限制作答。';
    scoringPoints = splitScore(score, 2).map((part, index) => ({
      description: ['基本思想', '适用条件'][index],
      score: part,
    }));
  }

  // 演示结构化 schema 的失败重试：当前课程配置的重试任务首个候选首次缺少答案。
  if (
    round === 1 &&
    task.id === profile.retryTaskId &&
    variant === 'A' &&
    input.attempt === 0
  ) {
    answer = '';
  }

  const candidate: CandidateQuestion = {
    id: `cand-${key}`,
    questionNo: key,
    version: round === 1 ? 'v1' : `v1.${round - 1}`,
    type: task.questionType,
    score: scoreOfType(task.questionType),
    difficulty: difficultyCoefficient(task.difficulty),
    chapter: task.chapter,
    knowledgePointId: point.id,
    cognitiveLevel: cognitiveOfType(task.questionType),
    contractItemId: contractIdOfType(task.questionType),
    stem,
    options,
    answer,
    analysis,
    scoringPoints,
    propositionNote: {
      intent: `考查「${point.name}」的${task.questionType}能力，对应 ${task.chapter} × ${task.questionType} × ${task.difficulty}。`,
      difficultyBasis: `按命题蓝图「${task.chapter}」的期望难度 ${expectedDifficultyOfCell(
        task.chapter,
        task.questionType,
      ).toFixed(2)} 与 ${task.difficulty} 档目标分配。`,
      distractorDesign:
        role === 'choice'
          ? '干扰项分别对应条件误读、知识点孤立与范围误判三类常见误判。'
          : undefined,
      commonErrors: commonErrorsOf(task.questionType),
    },
    generation: {
      modelName: 'mock-papercompile',
      modelVersion: 'mock-1.0',
      promptTemplate: 'proposition.md',
      promptTemplateVersion: 'v1',
      inputSummary: `${task.id} ${task.chapter} × ${task.questionType} × ${task.difficulty}`,
      outputSummary: `候选 ${key}`,
      randomSeed: key,
    },
  };

  return { candidate };
}

/* ===== 审题 Agent：只接收 L1 题目 ===== */

export function toTraceL1(candidate: CandidateQuestion): TraceL1 {
  return {
    questionNo: candidate.questionNo,
    stem: candidate.stem,
    options: candidate.options?.map((option) => ({ ...option })),
    answer: candidate.answer,
    analysis: candidate.analysis,
    scoringPoints: candidate.scoringPoints.map((point) => ({ ...point })),
  };
}

export function reviewAgent(input: ReviewAgentInput): ReviewAgentOutput {
  const reviewKeys = new Set(COURSE_PACK.demoProfile.reviewKeys);
  if (!reviewKeys.has(input.question.questionNo)) {
    return {
      conclusion: '通过',
      issues: [],
      recomputedAnswer: input.question.answer,
    };
  }

  const options = input.question.options ?? [];
  let issue = {
    description: '作答口径未限定，存在多种合理解法',
    evidence: '题干未限定比较维度或作答形式，答案可能不唯一。',
  };

  if (options.length > 0) {
    issue = {
      description: '选项 C 与 D 在边界条件下等价',
      evidence: 'C、D 在边界值处指向同一判定结果，需确认选项互斥性。',
    };
  } else if (input.question.stem.includes('复杂度')) {
    issue = {
      description: '复杂度分析口径未限定（最坏 / 平均）',
      evidence: '题干未说明复杂度分析口径，答案可能不唯一。',
    };
  }

  return {
    conclusion: '需复核',
    issues: [issue],
    recomputedAnswer: input.question.answer,
  };
}

/* ===== 校验 Agent：调用 validator 的七道闸门 ===== */

export function validationAgent(
  input: ValidatorInput,
): ValidationAgentOutput {
  return runValidator(input).report;
}

/* ===== 仲裁 Agent ===== */

export function arbitrationAgent(
  input: ArbitrationAgentInput,
): ArbitrationAgentOutput {
  const issueText = input.review.issues
    .map((issue) => `${issue.description}（${issue.evidence}）`)
    .join('；');
  const optionText = input.question.options?.length
    ? input.question.options.map((option) => option.label).join(' / ')
    : '无选项';

  if (COURSE_PACK.demoProfile.resolvableKeys.includes(input.question.questionNo)) {
    return {
      conclusion: '通过',
      reason:
        '独立复算与选项互斥性检查支持命题答案，审题疑点属于表述层面，不改变答案唯一性。',
      evidence: [
        `复算答案：${input.question.answer}`,
        `选项标签：${optionText}`,
        `审题疑点：${issueText}`,
        `命题说明：${input.propositionNote.intent}`,
      ],
      escalatedToHuman: false,
    };
  }

  if (input.review.conclusion === '拦截') {
    return {
      conclusion: '拦截',
      reason: '审题疑点足以影响答案正确性，且复算无法排除歧义。',
      evidence: [
        `复算答案：${input.question.answer}`,
        `审题疑点：${issueText}`,
        `命题说明：${input.propositionNote.intent}`,
      ],
      escalatedToHuman: false,
    };
  }

  return {
    conclusion: '需复核',
    reason: '审题疑点涉及判定口径，现有证据不足以裁决，升级人工。',
    evidence: [
      `复算答案：${input.question.answer}`,
      `审题疑点：${issueText}`,
      `命题说明：${input.propositionNote.intent}`,
      '现有规则无法判定该口径，按协同机制转入教师复核。',
    ],
    escalatedToHuman: true,
  };
}

/* ===== 组卷 Agent ===== */

export function composeAgent(input: ComposeAgentInput): ComposeAgentOutput {
  const typeOrder = new Map(TYPE_ORDER.map((type, index) => [type, index]));
  const chapterOrder = new Map(
    CHAPTER_ORDER.map((chapter, index) => [chapter, index]),
  );
  const questions = [...input.finalQuestions].sort((left, right) => {
    const typeDiff =
      (typeOrder.get(left.type) ?? 0) - (typeOrder.get(right.type) ?? 0);
    if (typeDiff !== 0) return typeDiff;
    const chapterDiff =
      (chapterOrder.get(left.chapter) ?? 0) -
      (chapterOrder.get(right.chapter) ?? 0);
    if (chapterDiff !== 0) return chapterDiff;
    return left.questionNo.localeCompare(right.questionNo);
  });

  return {
    draft: {
      questions,
      totalScore: questions.reduce((total, question) => total + question.score, 0),
      durationMinutes: input.blueprint.durationMinutes,
      timeAllocation: COURSE_PACK.questionTypes.map((type) => ({
        questionType: type.label,
        minutes: type.minutes,
      })),
      layout: {
        paperSize: 'A4',
        doubleSided: true,
        answerAreaReserved: true,
      },
    },
  };
}
