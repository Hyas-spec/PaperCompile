import type {
  AgentName,
  ArbitrationAgentInput,
  ArbitrationAgentOutput,
  CandidateQuestion,
  ComposeAgentInput,
  ComposeAgentOutput,
  PlanningAgentInput,
  PlanningAgentOutput,
  PropositionAgentInput,
  PropositionAgentOutput,
  ReviewAgentInput,
  ReviewAgentOutput,
  ThreeStateConclusion,
  ValidationAgentInput,
  ValidationAgentOutput,
  ValidationGate,
} from '../types';
import { COURSE_PACK } from '../courses/active';
import { roleOfType } from '../pages/propositionData';

export class AgentSchemaError extends Error {
  readonly agent: AgentName;

  constructor(agent: AgentName, message: string) {
    super(message);
    this.name = 'AgentSchemaError';
    this.agent = agent;
  }
}

export const GATE_NAMES: ValidationGate[] = [
  '覆盖校验',
  '配比校验',
  '难度校验',
  '正确性校验',
  '超纲校验',
  '重复校验',
  '格式校验',
];

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const check = (condition: unknown, agent: AgentName, message: string): void => {
  if (!condition) throw new AgentSchemaError(agent, message);
};

const isThreeState = (value: unknown): value is ThreeStateConclusion =>
  value === '通过' || value === '需复核' || value === '拦截';

const assertCandidate = (candidate: CandidateQuestion): void => {
  check(isText(candidate.id), '命题 Agent', 'candidate.id 缺失');
  check(isText(candidate.questionNo), '命题 Agent', 'candidate.questionNo 缺失');
  check(isText(candidate.stem), '命题 Agent', 'candidate.stem 缺失');
  check(isText(candidate.answer), '命题 Agent', 'candidate.answer 缺失');
  check(isText(candidate.analysis), '命题 Agent', 'candidate.analysis 缺失');
  check(
    Array.isArray(candidate.scoringPoints) && candidate.scoringPoints.length > 0,
    '命题 Agent',
    'candidate.scoringPoints 缺失',
  );
  check(
    candidate.scoringPoints.every(
      (point) => isText(point.description) && point.score > 0,
    ),
    '命题 Agent',
    'candidate.scoringPoints 字段不完整',
  );
  check(
    isFiniteNumber(candidate.score) && candidate.score > 0,
    '命题 Agent',
    'candidate.score 无效',
  );
  check(
    isFiniteNumber(candidate.difficulty) &&
      candidate.difficulty >= 0 &&
      candidate.difficulty <= 1,
    '命题 Agent',
    'candidate.difficulty 无效',
  );
  check(isText(candidate.chapter), '命题 Agent', 'candidate.chapter 缺失');
  check(
    isText(candidate.knowledgePointId),
    '命题 Agent',
    'candidate.knowledgePointId 缺失',
  );
  check(
    isText(candidate.contractItemId),
    '命题 Agent',
    'candidate.contractItemId 缺失',
  );
  check(
    isText(candidate.propositionNote?.intent),
    '命题 Agent',
    '命题说明缺少考查意图',
  );
  check(
    isText(candidate.propositionNote?.difficultyBasis),
    '命题 Agent',
    '命题说明缺少难度依据',
  );
  check(
    isText(candidate.propositionNote?.commonErrors),
    '命题 Agent',
    '命题说明缺少常见错误预判',
  );
  check(
    isText(candidate.generation?.modelName) &&
      isText(candidate.generation?.modelVersion) &&
      isText(candidate.generation?.promptTemplate) &&
      isText(candidate.generation?.promptTemplateVersion) &&
      isText(candidate.generation?.inputSummary) &&
      isText(candidate.generation?.outputSummary) &&
      (typeof candidate.generation?.randomSeed === 'number' ||
        isText(candidate.generation?.randomSeed)),
    '命题 Agent',
    'candidate.generation 字段不完整',
  );

  if (roleOfType(candidate.type) === 'choice') {
    check(
      Array.isArray(candidate.options) && candidate.options.length === 4,
      '命题 Agent',
      '单项选择题必须包含 4 个选项',
    );
    check(
      candidate.options?.every(
        (option) => isText(option.label) && isText(option.content),
      ),
      '命题 Agent',
      '选项字段不完整',
    );
    const labels = new Set(candidate.options?.map((option) => option.label));
    check(labels.size === 4, '命题 Agent', '选项标签必须互异');
  }
};

export function validatePlanningInput(input: PlanningAgentInput): void {
  check(input.blueprint?.cells?.length > 0, '规划 Agent', '蓝图 cells 缺失');
  check(input.blueprint?.questionCount > 0, '规划 Agent', '蓝图题量缺失');
  check(input.contract?.items?.length > 0, '规划 Agent', '契约 items 缺失');
}

export function validatePlanningOutput(output: PlanningAgentOutput): void {
  check(Array.isArray(output.tasks), '规划 Agent', '任务单 tasks 缺失');
  check(output.tasks.length > 0, '规划 Agent', '任务单为空');
  for (const task of output.tasks) {
    check(isText(task.id), '规划 Agent', 'task.id 缺失');
    check(isText(task.chapter), '规划 Agent', `${task.id} 章节缺失`);
    check(isText(task.questionType), '规划 Agent', `${task.id} 题型缺失`);
    check(isText(task.difficulty), '规划 Agent', `${task.id} 难度缺失`);
    check(
      Array.isArray(task.context?.knowledgePointIds) &&
        task.context.knowledgePointIds.length > 0,
      '规划 Agent',
      `${task.id} 缺少知识点上下文`,
    );
    check(
      Array.isArray(task.context?.contractItemIds) &&
        task.context.contractItemIds.length > 0,
      '规划 Agent',
      `${task.id} 缺少契约上下文`,
    );
  }
}

export function validatePropositionInput(input: PropositionAgentInput): void {
  check(isText(input.task?.id), '命题 Agent', 'task.id 缺失');
  check(
    Array.isArray(input.task?.context?.knowledgePointIds),
    '命题 Agent',
    'task.context 缺失',
  );
}

export function validatePropositionOutput(output: PropositionAgentOutput): void {
  check(output?.candidate, '命题 Agent', 'candidate 缺失');
  assertCandidate(output.candidate);
}

export function validateReviewInput(input: ReviewAgentInput): void {
  const question = input.question;
  check(isText(question?.stem), '审题 Agent', '题干缺失');
  check(isText(question?.answer), '审题 Agent', '答案缺失');
  check(isText(question?.analysis), '审题 Agent', '解析缺失');
  check(
    !Object.prototype.hasOwnProperty.call(question, 'propositionNote'),
    '审题 Agent',
    '审题输入不得包含命题说明',
  );
}

export function validateReviewOutput(output: ReviewAgentOutput): void {
  check(isThreeState(output?.conclusion), '审题 Agent', '三态结论无效');
  check(Array.isArray(output?.issues), '审题 Agent', '疑点清单缺失');
  if (output.conclusion !== '通过') {
    check(output.issues.length > 0, '审题 Agent', '非通过结论必须携带疑点');
  }
  for (const issue of output.issues) {
    check(isText(issue.description), '审题 Agent', '疑点描述缺失');
    check(isText(issue.evidence), '审题 Agent', '疑点证据缺失');
  }
  if (output.recomputedAnswer !== undefined) {
    check(isText(output.recomputedAnswer), '审题 Agent', '复算答案为空');
  }
}

export function validateValidationInput(input: ValidationAgentInput): void {
  check(input.question?.id, '校验 Agent', 'question 缺失');
  check(input.blueprint?.cells?.length > 0, '校验 Agent', 'blueprint 缺失');
  check(input.contract?.items?.length > 0, '校验 Agent', 'contract 缺失');
  check(input.syllabus?.chapters?.length > 0, '校验 Agent', 'syllabus 缺失');
  check(
    Array.isArray(input.knowledgeBase) && input.knowledgeBase.length > 0,
    '校验 Agent',
    'knowledgeBase 缺失',
  );
  check(Array.isArray(input.historyBank), '校验 Agent', 'historyBank 缺失');
}

export function validateValidationOutput(output: ValidationAgentOutput): void {
  check(isThreeState(output?.overall), '校验 Agent', 'overall 结论无效');
  check(
    Array.isArray(output.results) && output.results.length === GATE_NAMES.length,
    '校验 Agent',
    '七道闸门结果不完整',
  );
  check(
    GATE_NAMES.every((gate) =>
      output.results.some((result) => result.gate === gate),
    ),
    '校验 Agent',
    '闸门项必须覆盖七道校验',
  );
  for (const result of output.results) {
    check(isThreeState(result.conclusion), '校验 Agent', `${result.gate} 结论无效`);
    check(
      Array.isArray(result.evidence) && result.evidence.length > 0,
      '校验 Agent',
      `${result.gate} 缺少证据`,
    );
    check(
      result.evidence.every((line) => isText(line)),
      '校验 Agent',
      `${result.gate} 证据为空`,
    );
  }
  const worst: ThreeStateConclusion = output.results.some(
    (result) => result.conclusion === '拦截',
  )
    ? '拦截'
    : output.results.some((result) => result.conclusion === '需复核')
      ? '需复核'
      : '通过';
  check(
    output.overall === worst,
    '校验 Agent',
    'overall 必须等于七道闸门的最坏结论',
  );
}

export function validateArbitrationInput(input: ArbitrationAgentInput): void {
  check(input.question?.id, '仲裁 Agent', 'question 缺失');
  check(input.propositionNote?.intent, '仲裁 Agent', '命题说明缺失');
  check(input.review?.conclusion, '仲裁 Agent', '审题结论缺失');
}

export function validateArbitrationOutput(output: ArbitrationAgentOutput): void {
  check(isThreeState(output?.conclusion), '仲裁 Agent', '裁决结论无效');
  check(isText(output.reason), '仲裁 Agent', '裁决理由缺失');
  check(
    Array.isArray(output.evidence) && output.evidence.length > 0,
    '仲裁 Agent',
    '裁决依据缺失',
  );
  check(
    output.evidence.every((line) => isText(line)),
    '仲裁 Agent',
    '裁决依据为空',
  );
  check(
    typeof output.escalatedToHuman === 'boolean',
    '仲裁 Agent',
    'escalatedToHuman 缺失',
  );
  if (output.escalatedToHuman) {
    check(output.conclusion === '需复核', '仲裁 Agent', '升级人工时必须为需复核');
  }
}

export function validateComposeInput(input: ComposeAgentInput): void {
  check(Array.isArray(input.finalQuestions), '组卷 Agent', 'finalQuestions 缺失');
  check(input.blueprint?.cells?.length > 0, '组卷 Agent', 'blueprint 缺失');
}

export function validateComposeOutput(output: ComposeAgentOutput): void {
  const draft = output?.draft;
  check(draft, '组卷 Agent', 'draft 缺失');
  check(Array.isArray(draft.questions), '组卷 Agent', '题目序列缺失');
  check(
    isFiniteNumber(draft.totalScore) && draft.totalScore >= 0,
    '组卷 Agent',
    '总分无效',
  );
  check(
    isFiniteNumber(draft.durationMinutes) && draft.durationMinutes > 0,
    '组卷 Agent',
    '考试时长无效',
  );
  check(
    draft.timeAllocation.length === COURSE_PACK.questionTypes.length &&
      draft.timeAllocation.every((item) => item.minutes >= 0),
    '组卷 Agent',
    '时间分配必须覆盖当前课程的全部题型',
  );
  const allocated = draft.timeAllocation.reduce(
    (total, item) => total + item.minutes,
    0,
  );
  check(
    Math.abs(allocated - draft.durationMinutes) < 1e-9,
    '组卷 Agent',
    '时间分配合计不等于考试时长',
  );
  check(draft.layout?.paperSize === 'A4', '组卷 Agent', '版式必须为 A4');
  check(
    typeof draft.layout?.doubleSided === 'boolean' &&
      typeof draft.layout?.answerAreaReserved === 'boolean',
    '组卷 Agent',
    '版式字段缺失',
  );
}
