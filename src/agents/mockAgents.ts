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
  TYPE_ORDER,
  cognitiveOfType,
  expectedDifficultyOfCell,
  requirementOfPoint,
  scoreOfType,
} from '../pages/propositionData';
import { runValidator, type ValidatorInput } from './validator';

/* ===== 规划 Agent ===== */

export interface MockPlanningInput extends PlanningAgentInput {
  knowledgeBase: KnowledgePoint[];
}

const TYPE_CONTRACT: Record<QuestionType, string> = {
  单项选择题: 'C-04',
  填空题: 'C-05',
  简答与分析题: 'C-06',
  算法设计与分析题: 'C-07',
};

const DIFFICULTY_CONTRACT: Record<DifficultyLevel, string> = {
  易: 'C-11',
  中: 'C-12',
  难: 'C-13',
};

const difficultyOfCell = (
  cell: BlueprintCell,
  hardAlgorithmChapter: string | undefined,
): DifficultyLevel => {
  if (cell.questionType === '单项选择题') return '易';
  if (cell.questionType === '算法设计与分析题') {
    return cell.chapter === hardAlgorithmChapter ? '难' : '中';
  }
  return '中';
};

export function planAgent(input: MockPlanningInput): PlanningAgentOutput {
  const algorithmCells = input.blueprint.cells.filter(
    (cell) => cell.questionType === '算法设计与分析题',
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
    const points = input.knowledgeBase.filter(
      (point) => point.chapter === cell.chapter && !point.outOfScope,
    );
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
            TYPE_CONTRACT[cell.questionType],
            DIFFICULTY_CONTRACT[difficulty],
            'C-08',
            'C-09',
            'C-10',
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
  if (type === '单项选择题') return '易把存储结构差异与操作效率差异混淆。';
  if (type === '填空题') return '易漏写关键条件，或把复杂度结论写成近似值。';
  if (type === '简答与分析题') return '只给结论，缺少推导过程与适用条件。';
  return '只写代码，未说明建模过程、正确性依据与复杂度。';
};

const choiceOptions = (
  point: KnowledgePoint,
  variant: 'A' | 'B',
): { options: QuestionOption[]; answer: string } => {
  const correct =
    requirementOfPoint(point) || `${point.name}属于本章要求掌握的内容。`;
  const distractors = [
    `${point.name}只适用于顺序存储。`,
    `${point.name}与时间复杂度无关。`,
    `${point.name}不属于本课程考核范围。`,
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
  chapter: string,
  variant: 'A' | 'B',
): string => {
  if (chapter === '树与二叉树') {
    return variant === 'B'
      ? '给定一棵二叉树的先序与中序遍历序列，请完成：（1）重构该二叉树；（2）写出后序遍历序列；（3）判断该树是否为完全二叉树，并说明判定口径。'
      : '给定一棵二叉树，请完成：（1）写出先序遍历过程；（2）写出中序遍历过程；（3）分析遍历算法的时间复杂度。';
  }
  return variant === 'B'
    ? `以「${point.name}」为背景，设计一个求解算法，完成：（1）说明建模过程；（2）写出伪代码；（3）分析最坏与平均时间复杂度。`
    : `以「${point.name}」为背景，设计一个求解算法，完成：（1）描述算法思想；（2）写出伪代码；（3）分析时间复杂度。`;
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
  const blockedByT14 =
    round === 1 && task.id === 'T-14' && variant === 'B';
  const blockedByT24 =
    round === 1 && task.id === 'T-24' && variant === 'B';
  const stemOverride = blockedByT14
    ? '关于线索二叉树，下列说法正确的是（ ）。'
    : blockedByT24
      ? '简述 B 树与二叉排序树的区别，并分析 B 树的查找效率。'
      : null;

  let stem = '';
  let options: QuestionOption[] | undefined;
  let answer = '';
  let analysis = '';
  let scoringPoints = [{ description: '答案要点', score: scoreOfType(task.questionType) }];

  if (stemOverride) {
    stem = stemOverride;
    if (blockedByT14) {
      options = [
        { label: 'A', content: '线索二叉树利用空指针域存放前驱与后继信息' },
        { label: 'B', content: '线索二叉树必须使用三叉链表' },
        { label: 'C', content: '线索二叉树不能进行遍历' },
        { label: 'D', content: '线索二叉树只适用于完全二叉树' },
      ];
      answer = 'A';
      analysis = '线索二叉树通过线索化利用空指针域，支持按前驱后继遍历。';
    } else {
      answer =
        'B 树是多路平衡查找树，结点可含多个关键字与子树；二叉排序树是二叉结构。B 树查找效率与树高相关，通常为 O(log n)。';
      analysis = '按多路平衡、结点结构与查找复杂度三个维度比较。';
      scoringPoints = [
        { description: '结构区别', score: 2 },
        { description: '查找效率', score: 2 },
        { description: '表达完整', score: 1 },
      ];
    }
  } else if (task.questionType === '单项选择题') {
    stem =
      variant === 'B'
        ? `关于「${point.name}」的下列说法中，正确的是（ ）。`
        : `关于「${point.name}」，下列说法正确的是（ ）。`;
    const choice = choiceOptions(point, variant);
    options = choice.options;
    answer = choice.answer;
    analysis = `本题考查「${point.name}」。正确项对应大纲要求：${requirementOfPoint(point)}`;
    scoringPoints = [{ description: '概念辨析', score: 2 }];
  } else if (task.questionType === '填空题') {
    stem = `「${point.name}」的核心要求是 ______。`;
    answer = requirementOfPoint(point);
    analysis = `按「${point.name}」在大纲中的考核要求作答。`;
    scoringPoints = [{ description: '关键定义与结论', score: 2 }];
  } else if (task.questionType === '简答与分析题') {
    stem = `简述「${point.name}」的基本思想，并说明其适用场景。`;
    answer = `${requirementOfPoint(point)}适用场景需结合本章知识结构说明。`;
    analysis = '按基本思想、过程要点与适用场景分点作答。';
    scoringPoints = [
      { description: '基本思想', score: 2 },
      { description: '适用场景', score: 2 },
      { description: '表达完整', score: 1 },
    ];
  } else {
    stem = algorithmStem(point, task.chapter, variant);
    answer =
      task.chapter === '树与二叉树'
        ? '按先序确定根、中序划分左右子树；后序遍历为左右根；完全二叉树需按层序检查结点连续性。'
        : `围绕「${point.name}」建立模型，按步骤执行并做复杂度分析；需给出正确性依据与最坏情况结论。`;
    analysis = '按建模、算法过程、正确性依据与复杂度四个评分点组织答案。';
    scoringPoints = [
      { description: '建模与思路', score: 5 },
      { description: '算法过程', score: 5 },
      { description: '正确性依据', score: 5 },
      { description: '复杂度分析', score: 5 },
    ];
  }

  // 演示结构化 schema 的失败重试：T-13 的首个候选首次输出缺少答案。
  if (round === 1 && task.id === 'T-13' && variant === 'A' && input.attempt === 0) {
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
    contractItemId: TYPE_CONTRACT[task.questionType],
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
        task.questionType === '单项选择题'
          ? '干扰项分别对应存储结构、复杂度与课程范围三类常见误判。'
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

const REVIEW_KEYS = new Set([
  'T-12-B',
  'T-13-B',
  'T-15-B',
  'T-16-B',
  'T-17-B',
  'T-18-B',
  'T-19-B',
  'T-21-B',
  'T-22-B',
]);
const RESOLVABLE_KEYS = new Set(['T-12-B', 'T-19-B', 'T-22-B']);

export function reviewAgent(input: ReviewAgentInput): ReviewAgentOutput {
  if (!REVIEW_KEYS.has(input.question.questionNo)) {
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
  } else if (input.question.stem.includes('完全二叉树')) {
    issue = {
      description: '第（3）问未限定完全二叉树的判定口径',
      evidence: '第（3）问的判定条件未给出，存在多种解释。',
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

  if (RESOLVABLE_KEYS.has(input.question.questionNo)) {
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
      timeAllocation: [
        { questionType: '单项选择题', minutes: 30 },
        { questionType: '填空题', minutes: 10 },
        { questionType: '简答与分析题', minutes: 30 },
        { questionType: '算法设计与分析题', minutes: 50 },
      ],
      layout: {
        paperSize: 'A4',
        doubleSided: true,
        answerAreaReserved: true,
      },
    },
  };
}
